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

            if (!fs.existsSync(inputPath)) {
                throw new Error(`File not found: ${inputPath}`);
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
                
                try {
                    progress.report({ increment: 30, message: 'Converting file...' });
                    await this.pythonManager.convertFile(inputPath, outputPath);
                    
                    progress.report({ increment: 70, message: 'Finalizing...' });
                    
                    // Show success notification
                    const fileName = path.basename(outputPath);
                    vscode.window.showInformationMessage(
                        `Successfully converted to ${fileName}`,
                        'Open File'
                    ).then(selection => {
                        if (selection === 'Open File' || config.openFileOnSuccess) {
                            this.openFile(outputPath);
                        }
                    });
                    
                    progress.report({ increment: 100, message: 'Complete!' });
                    
                } catch (error) {
                    throw error;
                }
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

        // Handle file collisions
        if (fs.existsSync(outputPath)) {
            if (config.overwriteExisting) {
                return outputPath;
            } else {
                // Find available numbered suffix
                let counter = 1;
                do {
                    outputPath = path.join(dir, `${baseName}-${counter}.md`);
                    counter++;
                } while (fs.existsSync(outputPath));
            }
        }

        return outputPath;
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