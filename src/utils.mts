import * as vscode from 'vscode';
import _ from 'lodash';
import axios, { AxiosProgressEvent, AxiosResponseHeaders } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { nanoid } from 'nanoid';
import MD5 from 'md5.js';

import { FileNamingMethod, IncompleteResourceFile, ResourceFile } from './common.mjs';
import { getLogger } from './logger.mjs';

/**
 * Hash provider that prioritizes xxHash series, then system crypto functions for best performance
 * Falls back to md5.js if system crypto is unavailable
 * 
 * Note: Tool detection runs synchronously during module initialization for simplicity.
 * This is acceptable since it only checks for command availability, which is fast.
 */
let systemCrypto: typeof import('crypto') | null = null;
let childProcess: typeof import('child_process') | null = null;
let selectedHashAlgorithm: string | null = null;
let selectedHashCommand: string | null = null;

// Try to load child_process for command-line hash tools
try {
    childProcess = require('child_process');
} catch (error) {
    const logger = getLogger();
    logger.debug('child_process not available');
}

// Check for xxHash command-line tools
if (childProcess) {
    const xxhashTools = ['xxhsum', 'xxh128sum', 'xxh64sum', 'xxh32sum'];
    
    for (const tool of xxhashTools) {
        try {
            // Try to run the command with --version to check if it exists
            // This is more cross-platform than using 'which'
            // Add timeout to prevent indefinite blocking during startup
            childProcess.execFileSync(tool, ['--version'], { 
                stdio: 'pipe',
                timeout: 1000 // 1 second timeout
            });
            selectedHashCommand = tool;
            const logger = getLogger();
            logger.debug(`Using xxHash command-line tool: ${tool}`);
            break;
        } catch (error) {
            // Tool not available or timed out, continue to next
        }
    }
}

// If no xxHash command-line tool found, try to load system crypto
if (!selectedHashCommand) {
    try {
        systemCrypto = require('crypto');
        if (systemCrypto) {
            const availableHashes = systemCrypto.getHashes();
            
            // Priority order: xxHash series (if available in crypto) > blake2b512 > blake2s256 > md5 (by performance)
            // For file deduplication, we don't need cryptographic security
            const hashPriority = ['xxh128', 'xxh64', 'xxh32', 'blake2b512', 'blake2s256', 'md5'];
            
            for (const algo of hashPriority) {
                if (availableHashes.includes(algo)) {
                    selectedHashAlgorithm = algo;
                    const logger = getLogger();
                    logger.debug(`Using system crypto hash: ${algo}`);
                    break;
                }
            }
            
            // If none of our preferred algorithms are available, don't use system crypto
            // This ensures we fall back to md5.js which is known to work
            if (!selectedHashAlgorithm) {
                systemCrypto = null;
                const logger = getLogger();
                logger.debug('Preferred hash algorithms not available in system crypto, using md5.js fallback');
            }
        }
    } catch (error) {
        const logger = getLogger();
        logger.debug('System crypto not available, using md5.js fallback');
    }
}

/**
 * Calculate hash for data using the best available method
 * Priority: xxHash command-line tools > system crypto > md5.js
 * 
 * Note: This function uses synchronous operations for simplicity and consistency.
 * For large files, this will block the event loop during hash calculation.
 * This is acceptable for the paste-s3 use case where files are typically
 * small to medium sized (images, etc.), and the operation is user-initiated.
 * 
 * @param data Buffer to hash
 * @returns Hex-encoded hash string
 */
function calculateHash(data: Uint8Array): string {
    // Try to use command-line hash tool (e.g., xxHash)
    if (selectedHashCommand && childProcess) {
        try {
            // Use execFileSync instead of execSync for better security
            // Pass the command and arguments separately to avoid shell injection
            const result = childProcess.execFileSync(selectedHashCommand, [], {
                input: data,
                encoding: 'utf8',
                stdio: ['pipe', 'pipe', 'pipe'],
                maxBuffer: 50 * 1024 * 1024 // 50MB buffer for large file hashing
            });
            // Parse the output to get just the hash (first token)
            // xxHash tools typically output: <hash>  <filename> or just <hash>
            const trimmedOutput = result.trim();
            if (!trimmedOutput) {
                throw new Error('Empty output from hash command');
            }
            const hash = trimmedOutput.split(/\s+/)[0];
            
            // Validate that the hash looks like a valid hash (mostly hexadecimal)
            // Some tools might include prefixes or formatting, so be flexible
            const cleanHash = hash.replace(/^(0x|xxh\d+:)/i, '');
            // Note: Minimum 8 characters covers all xxHash variants (xxh32=8, xxh64=16, xxh128=32)
            if (/^[0-9a-f]+$/i.test(cleanHash) && cleanHash.length >= 8) {
                return cleanHash.toLowerCase();
            } else {
                throw new Error(`Invalid hash format: ${hash}`);
            }
        } catch (error) {
            const logger = getLogger();
            logger.warn(`Failed to use ${selectedHashCommand}, falling back to next method:`, error);
            // Fall through to next method
        }
    }
    
    // Try to use system crypto
    if (systemCrypto && selectedHashAlgorithm) {
        // Use system crypto for better performance
        return systemCrypto.createHash(selectedHashAlgorithm).update(data).digest('hex');
    } else {
        // Fallback to md5.js
        return new MD5().update(data).digest('hex');
    }
}

const extensionConfig = vscode.workspace.getConfiguration('pasteS3');

export async function inspectDataTransfer(dataTransfer: vscode.DataTransfer) {
    const logger = getLogger();
    let count = 0;
    for (const i of dataTransfer) {
        count++;
        const [mime, item] = i;
        let itemStr = "";
        const itemFile = item.asFile();
        if (itemFile) {
            itemStr = `[File] ${itemFile.name}, ${itemFile.uri}`;
        } else {
            itemStr = await item.asString();
            if (itemStr.length > 100) {
                itemStr = `${itemStr.substring(0, 100)} ... (${itemStr.length} bytes)`;
            }
        }
        logger.debug(`[${count}] ${mime}: ${itemStr}`);
    }
    logger.debug(`Total ${count} items in data transfer`);
}

export function extractBasenameAndExtension(filePath: string): [string, string] {
    const sep = /[\/\\]/;
    const parts = filePath.split(sep);
    const fileName = parts.pop()!;
    const lastDot = fileName.lastIndexOf('.');
    if (lastDot === -1) {
        return [fileName, ''];
    } else {
        return [fileName.substring(0, lastDot), fileName.substring(lastDot + 1)];
    }
}

export async function generateFileName(method: FileNamingMethod, file: IncompleteResourceFile): Promise<string> {
    switch (method) {
        case 'md5':
        case 'md5Short':
            const hash = calculateHash(file.data);
            return method === 'md5' ? hash : hash.substring(0, 8);
        case 'uuid':
            return uuidv4();
        case 'nanoid':
            return nanoid();
        case 'unixTimestamp':
            return Date.now().toString();
        case 'readableTimestamp':
            return new Date().toISOString().replace(/[:.]/g, '-');
        case 'prompt':
            const input = await vscode.window.showInputBox({
                prompt: 'Enter new file name for upload',
                value: file.name
            }) ?? '';
            return input;
    }
}

export function inspectResouceFiles(files: IncompleteResourceFile[]) {
    for (const file of files) {
        console.log(`[${file.mime}] ${file.name}.${file.extension} (${file.data.length} bytes)`);
    }
    console.log(`Total ${files.length} files`);
}

function inferFilename(url: string, headers: AxiosResponseHeaders): string {
    const contentDisposition = headers['content-disposition'];
    if (contentDisposition) {
        const filenameMatch = /filename\*?=['"]?([^'"]+)['"]?/.exec(contentDisposition);
        if (filenameMatch && filenameMatch[1]) {
            try {
                return decodeURIComponent(filenameMatch[1]);
            } catch (e) {
                return filenameMatch[1];
            }
        }
    }

    try {
        const urlPath = new URL(url).pathname;
        const lastSegment = urlPath.split('/').pop();
        if (lastSegment) {
            return decodeURIComponent(lastSegment);
        }
    } catch (e) {
        const logger = getLogger();
        logger.warn('Could not parse URL to infer filename:', e);
    }
    
    return "image";
}

const acceptHeader = "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8";

/**
 * Calculate hash for a file's data
 * This is used for cache lookups to identify identical files
 * Uses the best available hash algorithm (xxHash command-line tools > system crypto > md5.js fallback)
 */
export function calculateFileHash(file: ResourceFile): string {
    return calculateHash(file.data);
}

/**
 * Upload cache manager to avoid re-uploading the same file
 * 
 * Design notes:
 * - Uses timestamp-based LRU eviction when cache reaches MAX_CACHE_SIZE
 * - Eviction triggers on write when at capacity (acceptable for 1000 entries)
 * - Cache persists across VSCode sessions via globalState
 * - No undo functionality for cached uploads (since no actual upload occurs)
 */
export class UploadCache {
    // Use in-memory storage instead of globalState
    private static cache: Record<string, { url: string, timestamp: number }> = {};
    private static readonly MAX_CACHE_SIZE = 1000; // Maximum number of cached entries

    constructor(context?: vscode.ExtensionContext) {
        // Context is no longer needed for in-memory cache
    }

    /**
     * Get cached URL for a file hash
     */
    getCachedUrl(hash: string): string | undefined {
        const entry = UploadCache.cache[hash];
        return entry?.url;
    }

    /**
     * Store a file hash to URL mapping in cache
     */
    async setCachedUrl(hash: string, url: string): Promise<void> {
        // Simple size limit: if cache is too large, clear oldest entries by timestamp
        if (Object.keys(UploadCache.cache).length >= UploadCache.MAX_CACHE_SIZE) {
            const entries = Object.entries(UploadCache.cache);
            // Sort by timestamp (oldest first) and remove oldest half
            entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
            const half = Math.floor(entries.length / 2);
            UploadCache.cache = Object.fromEntries(entries.slice(half));
        }
        
        UploadCache.cache[hash] = { url, timestamp: Date.now() };
    }

    /**
     * Clear all cached entries
     */
    async clearCache(): Promise<void> {
        UploadCache.cache = {};
    }
}

export async function headContentType(url: string): Promise<string | undefined> {
    const response = await axios.head(url, {
        headers: {
            Accept: acceptHeader
        }
    });
    return response.headers['content-type'];
}

export async function downloadFileWithProgress(url: string): Promise<IncompleteResourceFile> {
    const abortController = new AbortController();

    let progressReporter = (progressEvent: AxiosProgressEvent) => {};
    const onDownloadProgress = (progressEvent: AxiosProgressEvent) => {
        progressReporter(progressEvent);
    };

    const downloadPromise = axios.get<ArrayBuffer>(url, {
        responseType: 'arraybuffer',
        signal: abortController.signal,
        onDownloadProgress,
        headers: {
            Accept: acceptHeader
        }
    });

    const timeout = setTimeout(() => {
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Downloading from ${new URL(url).hostname}`,
            cancellable: true
        }, (progress, token) => {
            token.onCancellationRequested(() => {
                abortController.abort();
                const logger = getLogger();
                logger.info('User cancelled the download');
            });

            let lastReportedPercentage = 0;
            progressReporter = (event: AxiosProgressEvent) => {
                if (event.total) {
                    const currentPercentage = Math.round((event.loaded * 100) / event.total);
                    const increment = currentPercentage - lastReportedPercentage;
                    if (increment > 0) {
                        progress.report({ increment, message: `${currentPercentage}%` });
                        lastReportedPercentage = currentPercentage;
                    }
                }
            };
            return downloadPromise;
        });
    }, 1000);

    try {
        const response = await downloadPromise;
        const filename = inferFilename(url, response.headers as AxiosResponseHeaders);
        const contentType = response.headers['content-type'] || 'application/octet-stream';
        return { data: Buffer.from(response.data), name: filename, mime: contentType };
    } catch (error) {
        if (axios.isCancel(error)) {
            throw new Error('Download was cancelled by the user.');
        }
        throw error;
    } finally {
        clearTimeout(timeout);
    }
}
