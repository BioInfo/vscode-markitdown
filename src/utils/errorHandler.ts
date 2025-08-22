import * as vscode from 'vscode';

export enum ErrorCategory {
    UnsupportedFormat = 'UnsupportedFormat',
    CorruptInput = 'CorruptInput',
    MarkitdownError = 'MarkitdownError',
    IOError = 'IOError',
    EnvironmentMissing = 'EnvironmentMissing',
    Unknown = 'Unknown'
}

export interface MarkitdownError {
    category: ErrorCategory;
    message: string;
    details?: string;
    suggestion?: string;
}

export class ErrorHandler {
    private outputChannel: vscode.OutputChannel;

    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('MarkItDown');
    }

    public handleError(error: any, context: string): void {
        const markitdownError = this.categorizeError(error);
        
        // Log detailed error to output channel
        this.logToOutput(markitdownError, context, error);
        
        // Show user-friendly notification
        this.showUserNotification(markitdownError);
    }

    private categorizeError(error: any): MarkitdownError {
        if (typeof error === 'string') {
            return {
                category: ErrorCategory.Unknown,
                message: error
            };
        }

        if (error instanceof Error) {
            const message = error.message.toLowerCase();
            
            if (message.includes('unsupported') || message.includes('format')) {
                return {
                    category: ErrorCategory.UnsupportedFormat,
                    message: 'File format not supported',
                    suggestion: 'Please check that the file format is supported by MarkItDown'
                };
            }
            
            if (message.includes('corrupt') || message.includes('invalid')) {
                return {
                    category: ErrorCategory.CorruptInput,
                    message: 'File appears to be corrupted or invalid',
                    suggestion: 'Try opening the file in its native application to verify it\'s not corrupted'
                };
            }
            
            if (message.includes('python') || message.includes('command not found')) {
                return {
                    category: ErrorCategory.EnvironmentMissing,
                    message: 'Python environment not available',
                    suggestion: 'Please ensure Python is installed and available in your PATH'
                };
            }
            
            if (message.includes('permission') || message.includes('access')) {
                return {
                    category: ErrorCategory.IOError,
                    message: 'File access error',
                    suggestion: 'Check file permissions and ensure the file is not open in another application'
                };
            }
            
            return {
                category: ErrorCategory.MarkitdownError,
                message: error.message,
                details: error.stack
            };
        }

        return {
            category: ErrorCategory.Unknown,
            message: 'An unknown error occurred',
            details: JSON.stringify(error)
        };
    }

    private logToOutput(error: MarkitdownError, context: string, originalError: any): void {
        const timestamp = new Date().toISOString();
        this.outputChannel.appendLine(`[${timestamp}] ${context}`);
        this.outputChannel.appendLine(`Category: ${error.category}`);
        this.outputChannel.appendLine(`Message: ${error.message}`);
        
        if (error.details) {
            this.outputChannel.appendLine(`Details: ${error.details}`);
        }
        
        if (originalError && originalError.stack) {
            this.outputChannel.appendLine(`Stack: ${originalError.stack}`);
        }
        
        this.outputChannel.appendLine('---');
    }

    private showUserNotification(error: MarkitdownError): void {
        const message = error.suggestion ? 
            `${error.message}. ${error.suggestion}` : 
            error.message;

        switch (error.category) {
            case ErrorCategory.EnvironmentMissing:
                vscode.window.showErrorMessage(message, 'Show Output', 'Install Python')
                    .then(selection => {
                        if (selection === 'Show Output') {
                            this.outputChannel.show();
                        } else if (selection === 'Install Python') {
                            vscode.env.openExternal(vscode.Uri.parse('https://www.python.org/downloads/'));
                        }
                    });
                break;
            
            case ErrorCategory.UnsupportedFormat:
            case ErrorCategory.CorruptInput:
                vscode.window.showWarningMessage(message, 'Show Output')
                    .then(selection => {
                        if (selection === 'Show Output') {
                            this.outputChannel.show();
                        }
                    });
                break;
            
            default:
                vscode.window.showErrorMessage(message, 'Show Output')
                    .then(selection => {
                        if (selection === 'Show Output') {
                            this.outputChannel.show();
                        }
                    });
                break;
        }
    }

    public dispose(): void {
        this.outputChannel.dispose();
    }
}