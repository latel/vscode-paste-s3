import * as vscode from 'vscode';
import _ from 'lodash';

import { ResourcePasteOrDropProvider } from './provider.mjs';
import { S3Uploader } from './s3Uploader.mjs';
import { getLogger } from './logger.mjs';

export async function activate(context: vscode.ExtensionContext) {
	const logger = getLogger();
	logger.info('Paste and Upload extension is activating...');
	context.subscriptions.push(vscode.commands.registerCommand('paste-s3.testS3Connection', () => {
		logger.info('Testing S3 connection...');
		const uploader = new S3Uploader(context);
		uploader.testConnection();
	}));
	const provider = new ResourcePasteOrDropProvider(context);
	context.subscriptions.push(provider.register());
	context.subscriptions.push(logger);

	const myExtension = vscode.extensions.getExtension('duanyll.paste-s3');
	const currentVersion = myExtension!.packageJSON.version;
	const lastVersion = context.globalState.get<string>('paste-s3.version');
	if (_.isEmpty(lastVersion)) {
		logger.info('First time installation detected');
		const result = await vscode.window.showInformationMessage('Thank you for installing Paste S3! Please check the S3 settings:', 'Open settings');
		if (result === 'Open settings') {
			await vscode.commands.executeCommand('workbench.action.openSettings', 'paste-s3.s3');
		}
	}
	if (currentVersion !== lastVersion) {
		logger.info(`Version updated from ${lastVersion} to ${currentVersion}`);
		context.globalState.update('paste-s3.version', currentVersion);
	}
	logger.info('Paste and Upload extension activated successfully');
}

// This method is called when your extension is deactivated
export function deactivate() {
	const logger = getLogger();
	logger.info('Paste and Upload extension is deactivating');
}
