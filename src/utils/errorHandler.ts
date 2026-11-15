import * as vscode from 'vscode';

import { categorize, ErrorCategory, MarkitdownError } from './errorCategory';

export { ErrorCategory, EnvironmentError, ConversionError, categorize } from './errorCategory';
export type { MarkitdownError } from './errorCategory';

export class ErrorHandler {
    public readonly outputChannel: vscode.OutputChannel;
    private lineCount: number = 0;
    private static readonly MAX_LINES = 10000;

    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('MarkItDown');
    }

    public handleError(error: any, context: string): void {
        const markitdownError = this.categorize(error);
        if (markitdownError.category === ErrorCategory.Cancelled) {
            return; // the user asked for it; nothing to report
        }

        // Log detailed error to output channel
        this.logToOutput(markitdownError, context, error);

        // Show user-friendly notification
        this.showUserNotification(markitdownError);
    }

    /** Map an arbitrary thrown value to a categorized error. Public for testing. */
    public categorize(error: unknown): MarkitdownError {
        return categorize(error);
    }

    /** Append streamed process output, counting its lines toward the channel cap. */
    public append(chunk: string): void {
        this.outputChannel.append(chunk);
        this.lineCount += (chunk.match(/\n/g) || []).length;
    }

    /** Append a line to the MarkItDown output channel. */
    public log(line: string): void {
        this.outputChannel.appendLine(line);
        this.lineCount++;
    }

    private logToOutput(error: MarkitdownError, context: string, originalError: any): void {
        // Check if we need to clear the output channel to prevent unbounded growth
        if (this.lineCount > ErrorHandler.MAX_LINES) {
            this.outputChannel.clear();
            this.outputChannel.appendLine('='.repeat(80));
            this.outputChannel.appendLine('Output log cleared after reaching size limit');
            this.outputChannel.appendLine(`Maximum lines: ${ErrorHandler.MAX_LINES}`);
            this.outputChannel.appendLine('='.repeat(80));
            this.lineCount = 4;
        }

        const timestamp = new Date().toISOString();
        this.outputChannel.appendLine(`[${timestamp}] ${context}`);
        this.lineCount++;

        this.outputChannel.appendLine(`Category: ${error.category}`);
        this.lineCount++;

        this.outputChannel.appendLine(`Message: ${error.message}`);
        this.lineCount++;

        if (error.details) {
            this.outputChannel.appendLine(`Details: ${error.details}`);
            this.lineCount++;
        }

        if (originalError && originalError.stack) {
            const stackLines = originalError.stack.split('\n').length;
            this.outputChannel.appendLine(`Stack: ${originalError.stack}`);
            this.lineCount += stackLines;
        }

        this.outputChannel.appendLine('---');
        this.lineCount++;
    }

    private showUserNotification(error: MarkitdownError): void {
        const message = error.suggestion ? 
            `${error.message}. ${error.suggestion}` : 
            error.message;

        switch (error.category) {
            case ErrorCategory.EnvironmentMissing:
                vscode.window.showErrorMessage(message, 'Show Output', 'Rebuild Environment', 'Install Python')
                    .then(selection => {
                        if (selection === 'Show Output') {
                            this.outputChannel.show();
                        } else if (selection === 'Rebuild Environment') {
                            vscode.commands.executeCommand('markitdown.rebuildEnvironment');
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