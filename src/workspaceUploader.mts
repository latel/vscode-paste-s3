import * as vscode from 'vscode';
import { ResourceFile, ResourceUploader, ResourceUploadResult, WorkspaceOptions } from "./common.mjs";
import { UploadCache, calculateFileHash } from './utils.mjs';
import { getLogger } from './logger.mjs';

export class WorkspaceUploader implements ResourceUploader {
    options: WorkspaceOptions;
    cache: UploadCache;
    
    constructor(context: vscode.ExtensionContext){
        const logger = getLogger();
        logger.debug('Initializing WorkspaceUploader...');
        this.cache = new UploadCache(context);
        const workspaceSection = vscode.workspace.getConfiguration('paste-s3.workspace');
        this.options = {
            path: workspaceSection.get<string>('path') ?? '',
            linkBase: workspaceSection.get<string>('linkBase') ?? '',
        };
        logger.info(`WorkspaceUploader initialized: path=${this.options.path}, linkBase=${this.options.linkBase}`);
    }

    async uploadFile(file: ResourceFile, doucumentUri: vscode.Uri, edit: vscode.WorkspaceEdit): Promise<ResourceUploadResult> {
        const logger = getLogger();
        // Calculate hash for cache lookup
        const fileHash = calculateFileHash(file);
        
        // Check if we have a cached URL for this file
        const cachedUrl = this.cache.getCachedUrl(fileHash);
        if (cachedUrl) {
            logger.info(`Using cached URL for file hash ${fileHash}: ${cachedUrl}`);
            // Return cached URL without creating file
            return {
                uri: cachedUrl
            };
        }
        
        // No cache hit, proceed with file creation
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(doucumentUri);
        if (!workspaceFolder) {
            const error = 'No workspace folder found';
            logger.error(error);
            throw new Error(error);
        }
        const filename = file.extension ? `${file.name}.${file.extension}` : file.name;
        const destUri = vscode.Uri.joinPath(workspaceFolder.uri, this.options.path, filename);
        logger.info(`Saving file to workspace: ${destUri.fsPath} (${file.data.length} bytes)`);
        edit.createFile(destUri, { overwrite: true, contents: file.data });
        
        const url = `${this.options.linkBase}${filename}`;
        
        // Cache the URL for future use
        logger.debug(`Caching URL for file hash ${fileHash}: ${url}`);
        await this.cache.setCachedUrl(fileHash, url);
        
        logger.info(`Workspace file created successfully: ${filename} -> ${url}`);
        return {
            uri: url
        };
    }
}