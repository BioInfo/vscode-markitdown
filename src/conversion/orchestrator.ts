import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { PythonEnvironmentManager } from '../python/environmentManager';
import { ConfigurationManager } from '../config/configurationManager';
import { ErrorHandler, ConversionError } from '../utils/errorHandler';
import { SUPPORTED_EXTENSIONS } from '../formats';
import { resolveOutputPath, resolveOutputDir } from './outputPath';

export interface ConvertOptions {
    token?: vscode.CancellationToken;
    /** Batch mode: no per-file notifications or editor tabs. */
    quiet?: boolean;
    /** Output paths already used in this batch, so two inputs never share one. */
    claimed?: Set<string>;
}

export interface ConvertOutcome {
    outputPath: string;
    chars: number;
}

const SUPPORTED = new Set(SUPPORTED_EXTENSIONS.map(e => `.${e}`));

export function isSupportedFile(filePath: string): boolean {
    return SUPPORTED.has(path.extname(filePath).toLowerCase());
}

export class ConversionOrchestrator {
    constructor(
        private readonly pythonManager: PythonEnvironmentManager,
        private readonly configManager: ConfigurationManager,
        private readonly errorHandler: ErrorHandler
    ) {}

    /** Convert one file. Throws on failure; the caller reports it. */
    public async convertFile(uri: vscode.Uri, opts: ConvertOptions = {}): Promise<ConvertOutcome> {
        const config = this.configManager.getConfiguration();

        if (uri.scheme !== 'file') {
            throw new Error(`MarkItDown can only convert files on disk (this one is on "${uri.scheme}").`);
        }
        const inputPath = uri.fsPath;
        const fileExtension = path.extname(inputPath).toLowerCase();
        if (!SUPPORTED.has(fileExtension)) {
            throw new Error(`Unsupported file format: ${fileExtension || '(no extension)'}`);
        }
        try {
            await fs.promises.access(inputPath, fs.constants.R_OK);
        } catch {
            throw new Error(`File not found or not readable: ${inputPath}`);
        }

        const workspaceRoot = vscode.workspace.getWorkspaceFolder(uri)?.uri.fsPath;
        const outputDir = resolveOutputDir(config.outputDirectory, inputPath, workspaceRoot);
        if (outputDir) {
            await fs.promises.mkdir(outputDir, { recursive: true });
        }

        const claimed = opts.claimed ?? new Set<string>();
        const exists = async (p: string) =>
            claimed.has(p) || fs.promises.access(p).then(() => true, () => false);
        // A batch never writes two inputs to one path, even with overwrite on:
        // with overwrite, only paths claimed in this batch count as taken.
        const overwrite = config.overwriteExisting;
        const pick = () => resolveOutputPath(inputPath, { overwriteExisting: false, outputDir },
            overwrite ? async p => claimed.has(p) : exists);

        const convert = async (outputPath: string) => this.pythonManager.convertFile(inputPath, outputPath, {
            keepDataUris: config.keepDataUris,
            transcribeAudio: config.audioTranscription,
            noClobber: !overwrite,
            timeoutMs: config.conversionTimeoutSeconds * 1000,
            token: opts.token,
        });

        let outputPath = await pick();
        claimed.add(outputPath);
        let result;
        try {
            result = await convert(outputPath);
        } catch (error) {
            // Another process created the file between our check and the write: pick again once.
            if (error instanceof ConversionError && error.errorType === 'exists') {
                outputPath = await pick();
                claimed.add(outputPath);
                result = await convert(outputPath);
            } else {
                throw error;
            }
        }

        if (!opts.quiet) {
            await this.announce(inputPath, outputPath, result.chars, config.openFileOnSuccess);
        }
        return { outputPath, chars: result.chars };
    }

    private async announce(inputPath: string, outputPath: string, chars: number, openOnSuccess: boolean): Promise<void> {
        const fileName = path.basename(outputPath);
        if (chars === 0) {
            // markitdown extracts text and metadata; it does not OCR. Say so
            // instead of silently leaving a blank file.
            vscode.window.showWarningMessage(
                `Converted ${path.basename(inputPath)}, but no text was extracted. Images and scanned ` +
                `PDFs without embedded text produce empty output (markitdown does not do OCR).`,
                'Open File'
            ).then(selection => {
                if (selection === 'Open File') { this.openFile(outputPath); }
            });
            return;
        }
        if (openOnSuccess) {
            await this.openFile(outputPath);
        }
        vscode.window.showInformationMessage(`Converted to ${fileName}`, 'Open File')
            .then(selection => {
                if (selection === 'Open File') { this.openFile(outputPath); }
            });
    }

    public async openFile(filePath: string): Promise<void> {
        try {
            const document = await vscode.workspace.openTextDocument(filePath);
            await vscode.window.showTextDocument(document);
        } catch (error) {
            this.errorHandler.handleError(error, 'Failed to open converted file');
        }
    }
}
