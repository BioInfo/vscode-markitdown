import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { PythonEnvironmentManager } from '../python/environmentManager';
import { ConfigurationManager, MarkitdownConfig } from '../config/configurationManager';
import { ErrorHandler } from '../utils/errorHandler';

export class ConversionOrchestrator {
    private pythonManager: PythonEnvironmentManager;
    private configManager: ConfigurationManager;
    private errorHandler: ErrorHandler;
    private supportedExtensions: Set<string>;

    constructor(
        pythonManager: PythonEnvironmentManager,
        configManager: ConfigurationManager,
        errorHandler: ErrorHandler
    ) {
        this.pythonManager = pythonManager;
        this.configManager = configManager;
        this.errorHandler = errorHandler;
        
        this.supportedExtensions = new Set([
            '.pdf', '.docx', '.pptx', '.xlsx', '.html',
            '.csv', '.json', '.xml', '.png', '.jpg', '.jpeg',
            '.gif', '.mp3', '.wav', '.zip'
        ]);
    }

    public async convertFile(uri: vscode.Uri): Promise<void> {
        const config = this.configManager.getConfiguration();

        try {
            // Validate file
            const inputPath = uri.fsPath;
            const fileExtension = path.extname(inputPath).toLowerCase();

            if (!this.supportedExtensions.has(fileExtension)) {
                throw new Error(`Unsupported file format: ${fileExtension}`);
            }

            // Check if file exists using async operation
            try {
                await fs.promises.access(inputPath, fs.constants.R_OK);
            } catch {
                throw new Error(`File not found or not readable: ${inputPath}`);
            }

            // Determine output path
            const outputPath = await this.resolveOutputPath(inputPath, config);
            
            // Show progress and perform conversion
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Converting ${path.basename(inputPath)} to Markdown`,
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 0, message: 'Initializing conversion...' });
                
                progress.report({ increment: 30, message: 'Converting file...' });
                const { chars } = await this.pythonManager.convertFile(inputPath, outputPath);

                progress.report({ increment: 70, message: 'Finalizing...' });

                const fileName = path.basename(outputPath);

                if (chars === 0) {
                    // markitdown extracts text/metadata; it does not OCR images.
                    // A file with no extractable text yields an empty .md — tell
                    // the user instead of silently leaving a blank file.
                    vscode.window.showWarningMessage(
                        `Converted ${path.basename(inputPath)}, but no text was extracted. ` +
                        `Image files without embedded text produce empty output (markitdown ` +
                        `does not perform OCR).`,
                        'Open File'
                    ).then(selection => {
                        if (selection === 'Open File') {
                            this.openFile(outputPath);
                        }
                    });
                } else {
                    // Open immediately when configured — don't gate opening on
                    // the notification's promise (which only resolves on click
                    // or timeout, so the file appeared to "never open").
                    if (config.openFileOnSuccess) {
                        await this.openFile(outputPath);
                    }
                    vscode.window.showInformationMessage(
                        `Successfully converted to ${fileName}`,
                        'Open File'
                    ).then(selection => {
                        if (selection === 'Open File') {
                            this.openFile(outputPath);
                        }
                    });
                }

                progress.report({ increment: 100, message: 'Complete!' });
            });

        } catch (error) {
            this.errorHandler.handleError(error, `Failed to convert ${path.basename(uri.fsPath)}`);
            throw error;
        }
    }

    private async resolveOutputPath(inputPath: string, config: MarkitdownConfig): Promise<string> {
        const dir = path.dirname(inputPath);
        const baseName = path.basename(inputPath, path.extname(inputPath));
        let outputPath = path.join(dir, `${baseName}.md`);

        // Handle file collisions using async file operations
        try {
            await fs.promises.access(outputPath);
            // File exists, handle collision

            if (config.overwriteExisting) {
                return outputPath;
            } else {
                // Find available numbered suffix with safety limit
                const MAX_ATTEMPTS = 100;
                let counter = 1;

                while (counter <= MAX_ATTEMPTS) {
                    const candidatePath = path.join(dir, `${baseName}-${counter}.md`);

                    try {
                        await fs.promises.access(candidatePath);
                        // File exists, try next number
                        counter++;
                    } catch {
                        // File doesn't exist, use this path
                        return candidatePath;
                    }
                }

                // If we've reached max attempts, throw an error
                throw new Error(
                    `Could not find available filename after ${MAX_ATTEMPTS} attempts. ` +
                    `Consider enabling "overwriteExisting" setting or cleaning up numbered files.`
                );
            }
        } catch {
            // File doesn't exist, use default path
            return outputPath;
        }
    }

    private async openFile(filePath: string): Promise<void> {
        try {
            const document = await vscode.workspace.openTextDocument(filePath);
            await vscode.window.showTextDocument(document);
        } catch (error) {
            this.errorHandler.handleError(error, 'Failed to open converted file');
        }
    }

    public dispose(): void {
        this.pythonManager.dispose();
        this.errorHandler.dispose();
    }
}