import * as vscode from 'vscode';
import { ConversionOrchestrator } from './conversion/orchestrator';
import { PythonEnvironmentManager } from './python/environmentManager';
import { ConfigurationManager } from './config/configurationManager';
import { ErrorHandler } from './utils/errorHandler';

let orchestrator: ConversionOrchestrator;

export async function activate(context: vscode.ExtensionContext) {
    console.log('MarkItDown extension is being activated');

    try {
        // Initialize core components
        const configManager = new ConfigurationManager();
        const errorHandler = new ErrorHandler();
        const pythonManager = new PythonEnvironmentManager(context, errorHandler);
        
        // Initialize Python environment
        await pythonManager.initialize();
        
        // Create conversion orchestrator
        orchestrator = new ConversionOrchestrator(
            pythonManager,
            configManager,
            errorHandler
        );

        // Register commands
        const convertCommand = vscode.commands.registerCommand(
            'markitdown.convertFile',
            async (uri?: vscode.Uri) => {
                try {
                    if (uri) {
                        // Called from context menu with specific file
                        await orchestrator.convertFile(uri);
                    } else {
                        // Called from command palette - show file picker
                        const fileUris = await vscode.window.showOpenDialog({
                            canSelectMany: true,
                            openLabel: 'Convert to Markdown',
                            filters: {
                                'Supported Files': [
                                    'pdf', 'docx', 'pptx', 'xlsx', 'html',
                                    'csv', 'json', 'xml', 'png', 'jpg', 'jpeg',
                                    'gif', 'mp3', 'wav', 'zip'
                                ]
                            }
                        });

                        if (fileUris && fileUris.length > 0) {
                            for (const fileUri of fileUris) {
                                await orchestrator.convertFile(fileUri);
                            }
                        }
                    }
                } catch (error) {
                    errorHandler.handleError(error, 'Failed to convert file');
                }
            }
        );

        context.subscriptions.push(convertCommand);

        vscode.window.showInformationMessage('MarkItDown extension activated successfully!');
        console.log('MarkItDown extension activated successfully');

    } catch (error) {
        const errorHandler = new ErrorHandler();
        errorHandler.handleError(error, 'Failed to activate MarkItDown extension');
        throw error;
    }
}

export function deactivate() {
    console.log('MarkItDown extension is being deactivated');
    if (orchestrator) {
        orchestrator.dispose();
    }
}