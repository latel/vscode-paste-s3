import * as vscode from 'vscode';
import _ from 'lodash';

import { ResourcePasteOrDropProvider } from './provider.mjs';
import { S3Uploader } from './s3Uploader.mjs';
import { getLogger } from './logger.mjs';
import { UploadCache } from './utils.mjs';

export async function activate(context: vscode.ExtensionContext) {
	const logger = getLogger();
	logger.info('paste-s3 extension is activating...');
	context.subscriptions.push(vscode.commands.registerCommand('paste-s3.testS3Connection', () => {
		logger.info('Testing S3 connection...');
		const uploader = new S3Uploader(context);
		uploader.testConnection();
	}));
	context.subscriptions.push(vscode.commands.registerCommand('paste-s3.clearCache', async () => {
		const cache = new UploadCache(context);
		await cache.clearCache();
		vscode.window.showInformationMessage('Upload cache cleared successfully');
	}));
	const provider = new ResourcePasteOrDropProvider(context);
	context.subscriptions.push(provider.register());
	context.subscriptions.push(logger);

	const myExtension = vscode.extensions.getExtension('okwang.paste-s3');
	const currentVersion = myExtension!.packageJSON.version;
	const lastVersion = context.globalState.get<string>('pasteS3.version');
	if (_.isEmpty(lastVersion)) {
		logger.info('First time installation detected');
		const result = await vscode.window.showInformationMessage('Thank you for installing Paste S3! Please check the S3 settings:', 'Open settings');
		if (result === 'Open settings') {
			await vscode.commands.executeCommand('workbench.action.openSettings', 'pasteS3.s3');
		}
	}
	if (currentVersion !== lastVersion) {
		logger.info(`Version updated from ${lastVersion} to ${currentVersion}`);
		context.globalState.update('pasteS3.version', currentVersion);
	}
	logger.info('paste-s3 extension activated successfully');
}

// This method is called when your extension is deactivated
export function deactivate() {
	const logger = getLogger();
	logger.info('paste-s3 extension is deactivating');
}
