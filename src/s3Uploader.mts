import * as vscode from 'vscode';
import * as path from 'path';
import _ from 'lodash';
import { S3Client, DeleteObjectCommand, HeadObjectCommand, S3ServiceException, S3ClientConfig } from '@aws-sdk/client-s3';
import { Upload } from "@aws-sdk/lib-storage";
import { filesize } from 'filesize';
import { ResourceFile, ResourceUploader, ResourceUploadResult, S3Options } from './common.mjs';
import { UploadCache, calculateFileHash } from './utils.mjs';
import { getLogger } from './logger.mjs';

export class S3Uploader implements ResourceUploader {
    private client: S3Client;
    private s3Option: S3Options;
    private cache: UploadCache;
    private static readonly RESERVED_CLIENT_OPTIONS = ['credentials', 'region', 'endpoint'];

    constructor(context: vscode.ExtensionContext) {
        const logger = getLogger();
        logger.debug('Initializing S3Uploader...');
        this.cache = new UploadCache(context);
        const s3Section = vscode.workspace.getConfiguration('pasteS3.s3');
        const region = s3Section.get<string>('region');
        if (_.isEmpty(region)) {
            const error = 'Region is required';
            logger.error(error);
            throw new Error(error);
        }
        const bucket = s3Section.get<string>('bucket');
        if (_.isEmpty(bucket)) {
            const error = 'Bucket is required';
            logger.error(error);
            throw new Error(error);
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
        // Mask sensitive data
        const logOptions = _.cloneDeep(this.s3Option);
        logOptions.accessKeyId = logOptions.accessKeyId ? '******' : undefined;
        logOptions.secretAccessKey = logOptions.secretAccessKey ? '******' : undefined;
        logger.info(`S3Uploader initialized with options: ${JSON.stringify(logOptions)}`);
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
        const logger = getLogger();
        try {
            logger.debug(`Checking if object exists: ${key}`);
            const headObjectCommand = new HeadObjectCommand({
                Bucket: this.s3Option.bucket,
                Key: key
            });
            await this.client.send(headObjectCommand);
            logger.debug(`Object exists: ${key}`);
            return true; // Object exists
        } catch (error) {
            if (error instanceof S3ServiceException && error.name === 'NotFound') {
                logger.debug(`Object does not exist: ${key}`);
                return false; // Object does not exist
            }
            logger.error(`Error checking object existence: ${key}`, error);
            throw error;
        }
    }

    public async uploadBuffer(buffer: Uint8Array, key: string, contentType?: string): Promise<void> {
        const logger = getLogger();
        if (this.s3Option.skipExisting) {
            if (await this.checkIfObjectExists(key)) {
                logger.info(`Skipping upload, object already exists: ${key}`);
                return; // Skip upload if the object already exists
            }
        }
        logger.info(`Starting S3 upload: ${key} (${filesize(buffer.length)}, ${contentType || 'unknown type'})`);
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
            logger.info(`S3 upload completed successfully: ${key}`);
        } finally {
            clearTimeout(timeout);
        }
    }

    public async deleteObject(key: string): Promise<void> {
        const logger = getLogger();
        logger.info(`Deleting S3 object: ${key}`);
        await this.client.send(new DeleteObjectCommand({
            Bucket: this.s3Option.bucket,
            Key: key
        }));
        logger.info(`Successfully deleted S3 object: ${key}`);
    }

    public async testConnection(): Promise<void> {
        const logger = getLogger();
        logger.info('Testing S3 connection...');
        const payload = new Uint8Array(100 * 1000);
        const prefix = vscode.workspace.getConfiguration('pasteS3.s3').get<string>('prefix') ?? '';
        const key = `${prefix}paste-s3-test.txt`;
        try {
            logger.debug(`Uploading test payload: ${key}`);
            await this.uploadBuffer(payload, key);
        } catch (e) {
            logger.error('Unable to upload test payload', e);
            vscode.window.showErrorMessage(`Unable to upload test payload: ${e}`);
            return;
        }
        try {
            logger.debug(`Deleting test payload: ${key}`);
            await this.deleteObject(key);
        } catch (e) {
            logger.error('Unable to delete test payload', e);
            vscode.window.showWarningMessage(`A test payload (${payload}) has been successfully uploaded, but unable to delete it: ${e}`);
            return;
        }
        logger.info('S3 connection test successful');
        vscode.window.showInformationMessage('Your S3 connection is working fine');
    }

    private replacePathVariables(pathStr: string | undefined, name: string, date: Date = new Date()): string {
        if (!pathStr) {
            return '';
        }
        const year = date.getFullYear().toString();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        
        return pathStr
            .replace(/\$\{year\}/g, year)
            .replace(/\$\{month\}/g, month)
            .replace(/\$\{day\}/g, day)
            .replace(/\$\{basename\}/g, name);
    }

    public generateKey(name: string, extension: string, date: Date = new Date()): string {
        let prefix = this.replacePathVariables(this.s3Option.prefix ?? '', name, date);
        // Remove leading slashes to avoid creating empty "root" folder
        prefix = prefix.replace(/^\/+/, '');
        
        if (this.s3Option.omitExtension || _.isEmpty(extension)) {
            return `${prefix}${name}`;
        } else {
            return `${prefix}${name}.${extension}`;
        }
    }

    public generatePublicUrl(name: string, extension: string, date: Date = new Date()): string {
        let publicUrlBase = this.s3Option.publicUrlBase;
        if (publicUrlBase) {
            publicUrlBase = this.replacePathVariables(publicUrlBase, name, date);
            if (!publicUrlBase.endsWith('/')) {
                publicUrlBase += '/';
            }

            // Get the prefix that would be used in the key
            let prefix = this.replacePathVariables(this.s3Option.prefix ?? '', name, date);
            prefix = prefix.replace(/^\/+/, '');
            
            // Check if properties of prefix (like "2024/" or "img-") are already in the base
            // If the base ends with the prefix, we assume the user manually added it (backward compatibility)
            // Otherwise, we append the full key (which includes the prefix)
            const shouldUseKey = !_.isEmpty(prefix) && !publicUrlBase.endsWith(prefix);

            if (shouldUseKey) {
                const key = this.generateKey(name, extension, date);
                return `${publicUrlBase}${key}`;
            } else {
                if (this.s3Option.omitExtension || _.isEmpty(extension)) {
                    return `${publicUrlBase}${name}`;
                } else {
                    return `${publicUrlBase}${name}.${extension}`;
                }
            }
        } else {
            const endpoint = this.s3Option.endpoint ?? `https://s3.${this.s3Option.region}.amazonaws.com`;
            return vscode.Uri.joinPath(vscode.Uri.parse(endpoint), this.s3Option.bucket, this.generateKey(name, extension, date)).toString();
        }
    }

    public async uploadFile(file: ResourceFile, doucumentUri: vscode.Uri, edit: vscode.WorkspaceEdit): Promise<ResourceUploadResult> {
        const logger = getLogger();
        // Calculate hash for cache lookup
        const fileHash = calculateFileHash(file);
        
        // Check if we have a cached URL for this file
        const cachedUrl = this.cache.getCachedUrl(fileHash);
        if (cachedUrl) {
            logger.info(`Using cached URL for file hash ${fileHash}: ${cachedUrl}`);
            // Return cached URL without uploading
            // Note: No undo provided for cached results since no upload occurred
            return {
                uri: cachedUrl,
                isCacheHit: true
            };
        }
        
        // No cache hit, proceed with upload
        const now = new Date();
        const key = this.generateKey(file.name, file.extension, now);
        await this.uploadBuffer(file.data, key, file.mime);
        const url = this.generatePublicUrl(file.name, file.extension, now);
        
        // Cache the URL for future use
        logger.debug(`Caching URL for file hash ${fileHash}: ${url}`);
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