import * as vscode from 'vscode';
import * as path from 'path';
import { ConversionOrchestrator } from './conversion/orchestrator';
import { PythonEnvironmentManager } from './python/environmentManager';
import { ConfigurationManager } from './config/configurationManager';
import { ErrorHandler } from './utils/errorHandler';

let orchestrator: ConversionOrchestrator | null = null;
let initializePromise: Promise<void> | null = null;
let errorHandler: ErrorHandler | null = null;

async function performInitialization(context: vscode.ExtensionContext): Promise<void> {
    console.log('MarkItDown extension is being activated');

    try {
        // Initialize core components
        const configManager = new ConfigurationManager();
        errorHandler = new ErrorHandler();
        const pythonManager = new PythonEnvironmentManager(context, errorHandler);

        // Initialize Python environment
        await pythonManager.initialize();

        // Create conversion orchestrator
        orchestrator = new ConversionOrchestrator(
            pythonManager,
            configManager,
            errorHandler
        );

        vscode.window.showInformationMessage('MarkItDown extension activated successfully!');
        console.log('MarkItDown extension activated successfully');

    } catch (error) {
        if (!errorHandler) {
            errorHandler = new ErrorHandler();
        }
        errorHandler.handleError(error, 'Failed to activate MarkItDown extension');
        throw error;
    }
}

export async function activate(context: vscode.ExtensionContext) {
    // Ensure initialization only happens once
    if (!initializePromise) {
        initializePromise = performInitialization(context);
    }

    // Register commands immediately (before initialization completes)
    const convertCommand = vscode.commands.registerCommand(
        'markitdown.convertFile',
        async (uri?: vscode.Uri) => {
            try {
                // Wait for initialization to complete
                if (!initializePromise) {
                    vscode.window.showErrorMessage('MarkItDown extension not initialized');
                    return;
                }

                await initializePromise;

                if (!orchestrator) {
                    vscode.window.showErrorMessage('MarkItDown orchestrator not available');
                    return;
                }

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
                        // Track batch conversion results
                        const results: {
                            succeeded: string[];
                            failed: Array<{ path: string; error: string }>;
                        } = {
                            succeeded: [],
                            failed: []
                        };

                        // Process all files and collect results
                        for (const fileUri of fileUris) {
                            try {
                                await orchestrator.convertFile(fileUri);
                                results.succeeded.push(fileUri.fsPath);
                            } catch (error) {
                                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                                results.failed.push({
                                    path: fileUri.fsPath,
                                    error: errorMessage
                                });
                            }
                        }

                        // Report aggregate results
                        if (results.failed.length > 0) {
                            const totalFiles = fileUris.length;
                            const succeededCount = results.succeeded.length;
                            const failedCount = results.failed.length;

                            let message = `Batch conversion completed: ${succeededCount} of ${totalFiles} files converted successfully.`;

                            if (failedCount > 0) {
                                message += `\n\nFailed files (${failedCount}):`;
                                results.failed.forEach(f => {
                                    const fileName = path.basename(f.path);
                                    message += `\n- ${fileName}: ${f.error}`;
                                });
                            }

                            vscode.window.showWarningMessage(
                                `Batch conversion: ${succeededCount}/${totalFiles} succeeded`,
                                'Show Details'
                            ).then(selection => {
                                if (selection === 'Show Details' && errorHandler) {
                                    errorHandler.outputChannel.show();
                                }
                            });

                            console.log(message);
                        } else if (results.succeeded.length > 1) {
                            vscode.window.showInformationMessage(
                                `Successfully converted ${results.succeeded.length} files to Markdown`
                            );
                        }
                    }
                }
            } catch (error) {
                if (errorHandler) {
                    errorHandler.handleError(error, 'Failed to convert file');
                } else {
                    vscode.window.showErrorMessage(`Failed to convert file: ${error}`);
                }
            }
        }
    );

    context.subscriptions.push(convertCommand);

    // Wait for initialization to complete
    await initializePromise;
}

export function deactivate() {
    console.log('MarkItDown extension is being deactivated');
    if (orchestrator) {
        orchestrator.dispose();
    }
}