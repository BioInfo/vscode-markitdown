import * as vscode from 'vscode';
import * as path from 'path';
import { ConversionOrchestrator } from './conversion/orchestrator';
import { PythonEnvironmentManager } from './python/environmentManager';
import { ConfigurationManager } from './config/configurationManager';
import { ErrorHandler } from './utils/errorHandler';

let orchestrator: ConversionOrchestrator | null = null;
let initializePromise: Promise<ConversionOrchestrator> | null = null;
let errorHandler: ErrorHandler | null = null;

async function performInitialization(
    context: vscode.ExtensionContext,
    progress: vscode.Progress<{ message?: string; increment?: number }>
): Promise<ConversionOrchestrator> {
    console.log('MarkItDown: initializing');

    const configManager = new ConfigurationManager();
    if (!errorHandler) {
        errorHandler = new ErrorHandler();
    }
    const pythonManager = new PythonEnvironmentManager(context, errorHandler);

    await pythonManager.initialize(progress);

    orchestrator = new ConversionOrchestrator(pythonManager, configManager, errorHandler);
    console.log('MarkItDown: initialized');
    return orchestrator;
}

/**
 * Lazily initialize on first use, wrapped in a progress notification. The
 * first run creates a venv and installs markitdown (tens of seconds to a few
 * minutes), so doing this silently made the extension look hung. Subsequent
 * calls reuse the cached promise and return immediately.
 */
function ensureInitialized(context: vscode.ExtensionContext): Promise<ConversionOrchestrator> {
    if (!initializePromise) {
        initializePromise = (async () => {
            try {
                return await vscode.window.withProgress(
                    {
                        location: vscode.ProgressLocation.Notification,
                        title: 'MarkItDown: setting up (first run)',
                        cancellable: false
                    },
                    (progress) => performInitialization(context, progress)
                );
            } catch (error) {
                // Reset so a later invocation can retry after the user fixes
                // the underlying problem (e.g. installs Python).
                initializePromise = null;
                throw error;
            }
        })();
    }
    return initializePromise;
}

export function activate(context: vscode.ExtensionContext) {
    const convertCommand = vscode.commands.registerCommand(
        'markitdown.convertFile',
        async (uri?: vscode.Uri, selectedUris?: vscode.Uri[]) => {
            try {
                const orch = await ensureInitialized(context);

                // Explorer multi-select passes the clicked uri plus the full
                // selection as the second arg; prefer the selection when present.
                let targets: vscode.Uri[];
                if (selectedUris && selectedUris.length > 0) {
                    targets = selectedUris;
                } else if (uri) {
                    targets = [uri];
                } else {
                    const picked = await vscode.window.showOpenDialog({
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
                    if (!picked || picked.length === 0) {
                        return;
                    }
                    targets = picked;
                }

                await convertTargets(orch, targets);
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
}

async function convertTargets(orch: ConversionOrchestrator, targets: vscode.Uri[]): Promise<void> {
    if (targets.length === 1) {
        // Single file: orchestrator shows its own progress + result.
        await orch.convertFile(targets[0]);
        return;
    }

    const succeeded: string[] = [];
    const failed: Array<{ path: string; error: string }> = [];

    for (const target of targets) {
        try {
            await orch.convertFile(target);
            succeeded.push(target.fsPath);
        } catch (error) {
            failed.push({
                path: target.fsPath,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    if (failed.length === 0) {
        vscode.window.showInformationMessage(
            `Converted ${succeeded.length} files to Markdown`
        );
        return;
    }

    const detail = failed.map(f => `- ${path.basename(f.path)}: ${f.error}`).join('\n');
    console.log(
        `Batch conversion: ${succeeded.length}/${targets.length} succeeded.\nFailed:\n${detail}`
    );
    vscode.window.showWarningMessage(
        `MarkItDown: ${succeeded.length}/${targets.length} converted, ${failed.length} failed`,
        'Show Details'
    ).then(selection => {
        if (selection === 'Show Details' && errorHandler) {
            errorHandler.outputChannel.show();
        }
    });
}

export function deactivate() {
    if (orchestrator) {
        orchestrator.dispose();
    }
}
