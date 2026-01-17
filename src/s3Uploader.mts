import * as vscode from 'vscode';
import _ from 'lodash';
import { S3Client, DeleteObjectCommand, HeadObjectCommand, S3ServiceException, S3ClientConfig } from '@aws-sdk/client-s3';
import { Upload } from "@aws-sdk/lib-storage";
import { filesize } from 'filesize';
import { ResourceFile, ResourceUploader, ResourceUploadResult, S3Options } from './common.mjs';
import { UploadCache, calculateFileHash } from './utils.mjs';

export class S3Uploader implements ResourceUploader {
    private client: S3Client;
    private s3Option: S3Options;
    private cache: UploadCache;
    private static readonly RESERVED_CLIENT_OPTIONS = ['credentials', 'region', 'endpoint'];

    constructor(context: vscode.ExtensionContext) {
        this.cache = new UploadCache(context);
        const s3Section = vscode.workspace.getConfiguration('paste-and-upload.s3');
        const region = s3Section.get<string>('region');
        if (_.isEmpty(region)) {
            throw new Error('Region is required');
        }
        const bucket = s3Section.get<string>('bucket');
        if (_.isEmpty(bucket)) {
            throw new Error('Bucket is required');
        }
        const emptyToUndefined = (value: string | undefined) => _.isEmpty(value) ? undefined : value;
        this.s3Option = {
            region: region as string,
            endpoint: emptyToUndefined(s3Section.get<string>('endpoint')),
            accessKeyId: emptyToUndefined(s3Section.get<string>('accessKeyId')),
            secretAccessKey: emptyToUndefined(s3Section.get<string>('secretAccessKey')),
            bucket: bucket as string,
            prefix: emptyToUndefined(s3Section.get<string>('prefix')),
            publicUrlBase: emptyToUndefined(s3Section.get<string>('publicUrlBase')),
            omitExtension: s3Section.get<boolean>('omitExtension'),
            skipExisting: s3Section.get<boolean>('skipExisting'),
            forcePathStyle: s3Section.get<boolean>('forcePathStyle'),
            clientOptions: this.parseClientOptions(s3Section.get<string>('clientOptions'))
        };
        this.client = this.createClient();
    }

    private parseClientOptions(clientOptionsJson?: string): Record<string, any> | undefined {
        // Handle undefined, null, empty string, or default empty object '{}'
        if (!clientOptionsJson) {
            return undefined;
        }
        
        const trimmed = clientOptionsJson.trim();
        if (trimmed === '' || trimmed === '{}') {
            return undefined;
        }
        
        try {
            const parsed = JSON.parse(trimmed);
            if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
                vscode.window.showWarningMessage('S3 client options must be a JSON object. Ignoring invalid configuration.');
                return undefined;
            }
            
            // Prevent overriding critical security settings
            const hasReservedKeys = S3Uploader.RESERVED_CLIENT_OPTIONS.some(key => key in parsed);
            if (hasReservedKeys) {
                vscode.window.showWarningMessage(`S3 client options cannot override ${S3Uploader.RESERVED_CLIENT_OPTIONS.join(', ')}. Use the dedicated settings instead. Ignoring invalid configuration.`);
                return undefined;
            }
            
            return parsed;
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : 'Invalid JSON format';
            vscode.window.showWarningMessage(`Failed to parse S3 client options: ${errorMessage}. Ignoring invalid configuration.`);
            return undefined;
        }
    }

    private createClient(): S3Client {
        const credentials = (this.s3Option.accessKeyId && this.s3Option.secretAccessKey) ? {
            accessKeyId: this.s3Option.accessKeyId,
            secretAccessKey: this.s3Option.secretAccessKey
        } : undefined;
        
        // Base configuration
        const baseConfig: S3ClientConfig = {
            region: this.s3Option.region,
            endpoint: this.s3Option.endpoint,
            credentials
        };
        
        // Add forcePathStyle only if explicitly set
        if (this.s3Option.forcePathStyle !== undefined) {
            baseConfig.forcePathStyle = this.s3Option.forcePathStyle;
        }
        
        // Merge with additional client options
        const finalConfig = this.s3Option.clientOptions 
            ? { ...baseConfig, ...this.s3Option.clientOptions }
            : baseConfig;
        
        return new S3Client(finalConfig);
    }

    private async checkIfObjectExists(key: string): Promise<boolean> {
        try {
            const headObjectCommand = new HeadObjectCommand({
                Bucket: this.s3Option.bucket,
                Key: key
            });
            await this.client.send(headObjectCommand);
            return true; // Object exists
        } catch (error) {
            if (error instanceof S3ServiceException && error.name === 'NotFound') {
                return false; // Object does not exist
            }
            throw error;
        }
    }

    public async uploadBuffer(buffer: Uint8Array, key: string, contentType?: string): Promise<void> {
        if (this.s3Option.skipExisting) {
            if (await this.checkIfObjectExists(key)) {
                return; // Skip upload if the object already exists
            }
        }
        const upload = new Upload({
            client: this.client,
            params: {
                Bucket: this.s3Option.bucket,
                Key: key,
                Body: buffer,
                ContentType: contentType
            }
        });
        // Show progress bar if the upload is still running after 1 second
        const donePromise = upload.done();
        const stillRunning = true;
        const timeout = setTimeout(() => {
            if (!stillRunning) {
                return;
            }
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Uploading paste data (${filesize(buffer.length)})`,
                cancellable: true
            }, (progress, token) => {
                token.onCancellationRequested(() => {
                    upload.abort();
                });
                upload.on('httpUploadProgress', ({loaded, total}) => {
                    progress.report({increment: (loaded ?? 0) / (total ?? buffer.length) * 100});
                });
                return donePromise;
            });
        }, 1000);
        try {
            await donePromise;
        } finally {
            clearTimeout(timeout);
        }
    }

    public async deleteObject(key: string): Promise<void> {
        await this.client.send(new DeleteObjectCommand({
            Bucket: this.s3Option.bucket,
            Key: key
        }));
    }

    public async testConnection(): Promise<void> {
        const payload = new Uint8Array(100 * 1000);
        const prefix = vscode.workspace.getConfiguration('paste-and-upload.s3').get<string>('prefix') ?? '';
        const key = `${prefix}paste-and-upload-test.txt`;
        try {
            await this.uploadBuffer(payload, key);
        } catch (e) {
            vscode.window.showErrorMessage(`Unable to upload test payload: ${e}`);
            return;
        }
        try {
            await this.deleteObject(key);
        } catch (e) {
            vscode.window.showWarningMessage(`A test payload (${payload}) has been successfully uploaded, but unable to delete it: ${e}`);
            return;
        }
        vscode.window.showInformationMessage('Your S3 connection is working fine');
    }

    public generateKey(name: string, extension: string): string {
        const prefix = this.s3Option.prefix ?? '';
        if (this.s3Option.omitExtension || _.isEmpty(extension)) {
            return `${prefix}${name}`;
        } else {
            return `${prefix}${name}.${extension}`;
        }
    }

    public generatePublicUrl(name: string, extension: string): string {
        const publicUrlBase = this.s3Option.publicUrlBase;
        if (publicUrlBase) {
            if (this.s3Option.omitExtension || _.isEmpty(extension)) {
                return `${publicUrlBase}${name}`;
            } else {
                return `${publicUrlBase}${name}.${extension}`;
            }
        } else {
            const endpoint = this.s3Option.endpoint ?? `https://s3.${this.s3Option.region}.amazonaws.com`;
            return vscode.Uri.joinPath(vscode.Uri.parse(endpoint), this.s3Option.bucket, this.generateKey(name, extension)).toString();
        }
    }

    public async uploadFile(file: ResourceFile): Promise<ResourceUploadResult> {
        // Calculate hash for cache lookup
        const fileHash = calculateFileHash(file);
        
        // Check if we have a cached URL for this file
        const cachedUrl = this.cache.getCachedUrl(fileHash);
        if (cachedUrl) {
            console.log(`Using cached URL for file hash ${fileHash}: ${cachedUrl}`);
            // Return cached URL without uploading
            return {
                uri: cachedUrl,
                // Note: We don't provide undo for cached uploads since the file wasn't uploaded this time
            };
        }
        
        // No cache hit, proceed with upload
        const key = this.generateKey(file.name, file.extension);
        await this.uploadBuffer(file.data, key, file.mime);
        const url = this.generatePublicUrl(file.name, file.extension);
        
        // Cache the URL for future use
        await this.cache.setCachedUrl(fileHash, url);
        
        return {
            uri: url,
            undoTitle: key,
            undo: async () => {
                await this.deleteObject(key);
            }
        };
    }
}