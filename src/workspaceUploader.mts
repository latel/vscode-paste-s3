import * as vscode from 'vscode';
import { ResourceFile, ResourceUploader, ResourceUploadResult, WorkspaceOptions } from "./common.mjs";
import { UploadCache, calculateFileHash } from './utils.mjs';

export class WorkspaceUploader implements ResourceUploader {
    options: WorkspaceOptions;
    cache: UploadCache;
    
    constructor(context: vscode.ExtensionContext){
        this.cache = new UploadCache(context);
        const workspaceSection = vscode.workspace.getConfiguration('paste-and-upload.workspace');
        this.options = {
            path: workspaceSection.get<string>('path') ?? '',
            linkBase: workspaceSection.get<string>('linkBase') ?? '',
        };
    }

    async uploadFile(file: ResourceFile, doucumentUri: vscode.Uri, edit: vscode.WorkspaceEdit): Promise<ResourceUploadResult> {
        // Calculate hash for cache lookup
        const fileHash = calculateFileHash(file);
        
        // Check if we have a cached URL for this file
        const cachedUrl = this.cache.getCachedUrl(fileHash);
        if (cachedUrl) {
            console.log(`Using cached URL for file hash ${fileHash}: ${cachedUrl}`);
            // Return cached URL without creating file
            return {
                uri: cachedUrl
            };
        }
        
        // No cache hit, proceed with file creation
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(doucumentUri);
        if (!workspaceFolder) {
            throw new Error('No workspace folder found');
        }
        const filename = file.extension ? `${file.name}.${file.extension}` : file.name;
        const destUri = vscode.Uri.joinPath(workspaceFolder.uri, this.options.path, filename);
        edit.createFile(destUri, { overwrite: true, contents: file.data });
        
        const url = `${this.options.linkBase}${filename}`;
        
        // Cache the URL for future use
        await this.cache.setCachedUrl(fileHash, url);
        
        return {
            uri: url
        };
    }
}