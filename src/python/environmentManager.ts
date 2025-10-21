import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { spawn, ChildProcess } from 'child_process';
import { ErrorHandler, ErrorCategory } from '../utils/errorHandler';

export class PythonEnvironmentManager {
    private context: vscode.ExtensionContext;
    private errorHandler: ErrorHandler;
    private venvPath: string;
    private pythonExecutable: string | null = null;

    constructor(context: vscode.ExtensionContext, errorHandler: ErrorHandler) {
        this.context = context;
        this.errorHandler = errorHandler;
        this.venvPath = path.join(context.globalStorageUri.fsPath, 'markitdown-venv');
    }

    public async initialize(): Promise<void> {
        try {
            // Ensure global storage directory exists
            await this.ensureDirectoryExists(this.context.globalStorageUri.fsPath);
            
            // Find Python executable
            this.pythonExecutable = await this.findPythonExecutable();
            
            if (!this.pythonExecutable) {
                throw new Error('Python not found in PATH. Please install Python and ensure it is available in your PATH.');
            }

            // Create or verify virtual environment
            await this.ensureVirtualEnvironment();
            
            // Install or verify markitdown
            await this.ensureMarkitdownInstalled();

        } catch (error) {
            this.errorHandler.handleError(error, 'Failed to initialize Python environment');
            throw error;
        }
    }

    private async findPythonExecutable(): Promise<string | null> {
        const candidates = ['python3', 'python'];
        
        for (const candidate of candidates) {
            try {
                const result = await this.executeCommand(candidate, ['--version']);
                if (result.exitCode === 0) {
                    return candidate;
                }
            } catch (error) {
                // Continue to next candidate
            }
        }
        
        return null;
    }

    private async ensureVirtualEnvironment(): Promise<void> {
        const venvPythonPath = this.getVenvPythonPath();
        let needsCreation = false;

        if (!fs.existsSync(venvPythonPath)) {
            needsCreation = true;
        } else {
            // Verify virtual environment is functional
            try {
                console.log('Verifying virtual environment integrity...');
                const verifyResult = await this.executeCommand(venvPythonPath, ['--version'], 10000);

                if (verifyResult.exitCode !== 0) {
                    console.warn('Virtual environment verification failed, will recreate');
                    needsCreation = true;
                }
            } catch (error) {
                console.warn(`Virtual environment appears corrupted: ${error}`);
                needsCreation = true;
            }

            // If corrupted, clean up the old environment
            if (needsCreation && fs.existsSync(this.venvPath)) {
                console.log('Removing corrupted virtual environment...');
                await fs.promises.rm(this.venvPath, { recursive: true, force: true });
            }
        }

        if (needsCreation) {
            console.log('Creating virtual environment...');

            const result = await this.executeCommand(this.pythonExecutable!, [
                '-m', 'venv', this.venvPath
            ]);

            if (result.exitCode !== 0) {
                throw new Error(`Failed to create virtual environment: ${result.stderr}`);
            }

            // Verify creation succeeded
            console.log('Verifying newly created virtual environment...');
            const verifyResult = await this.executeCommand(venvPythonPath, ['--version'], 10000);

            if (verifyResult.exitCode !== 0) {
                throw new Error('Created virtual environment but verification failed');
            }

            console.log('Virtual environment created and verified successfully');
        } else {
            console.log('Virtual environment already exists and is functional');
        }
    }

    private async ensureMarkitdownInstalled(): Promise<void> {
        const venvPython = this.getVenvPythonPath();
        
        try {
            // Check if markitdown is installed with all dependencies
            const checkResult = await this.executeCommand(venvPython, [
                '-c', `
import markitdown
print(f"markitdown version: {markitdown.__version__}")

# Test key dependencies
try:
    import docx
    print("docx: available")
except ImportError:
    print("docx: missing")
    raise ImportError("Missing docx dependency")

try:
    import openpyxl
    print("openpyxl: available")
except ImportError:
    print("openpyxl: missing")
    raise ImportError("Missing openpyxl dependency")

try:
    from PIL import Image
    print("PIL: available")
except ImportError:
    print("PIL: missing")
    raise ImportError("Missing PIL dependency")

print("All dependencies verified")
`
            ]);
            
            if (checkResult.exitCode === 0) {
                console.log(`markitdown with all dependencies is already installed`);
                console.log(checkResult.stdout);
                return;
            }
        } catch (error) {
            // markitdown not installed or missing dependencies, proceed with installation
            console.log('markitdown not properly installed or missing dependencies');
        }

        console.log('Installing markitdown with all optional dependencies...');
        
        const installResult = await this.executeCommand(venvPython, [
            '-m', 'pip', 'install', 'markitdown[all]'
        ]);
        
        if (installResult.exitCode !== 0) {
            throw new Error(`Failed to install markitdown: ${installResult.stderr}`);
        }
        
        console.log('markitdown with all dependencies installed successfully');
    }

    public async convertFile(inputPath: string, outputPath: string): Promise<void> {
        const venvPython = this.getVenvPythonPath();

        // Use base64 encoding to prevent path injection attacks
        const inputPathB64 = Buffer.from(inputPath).toString('base64');
        const outputPathB64 = Buffer.from(outputPath).toString('base64');

        const result = await this.executeCommand(venvPython, [
            '-c', `
import sys
import base64
from markitdown import MarkItDown

try:
    # Decode paths from base64 to prevent injection attacks
    input_path = base64.b64decode('${inputPathB64}').decode('utf-8')
    output_path = base64.b64decode('${outputPathB64}').decode('utf-8')

    md = MarkItDown()
    result = md.convert(input_path)

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(result.text_content)

    print('Conversion completed successfully')
except Exception as e:
    print(f'Error: {str(e)}', file=sys.stderr)
    sys.exit(1)
`
        ]);

        if (result.exitCode !== 0) {
            throw new Error(`Conversion failed: ${result.stderr}`);
        }
    }

    private getVenvPythonPath(): string {
        const isWindows = process.platform === 'win32';
        return isWindows 
            ? path.join(this.venvPath, 'Scripts', 'python.exe')
            : path.join(this.venvPath, 'bin', 'python');
    }

    private async ensureDirectoryExists(dirPath: string): Promise<void> {
        if (!fs.existsSync(dirPath)) {
            await fs.promises.mkdir(dirPath, { recursive: true });
        }
    }

    private executeCommand(
        command: string,
        args: string[],
        timeoutMs: number = 300000 // 5 minutes default
    ): Promise<{exitCode: number, stdout: string, stderr: string}> {
        return new Promise((resolve, reject) => {
            const childProcess = spawn(command, args, {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let stdout = '';
            let stderr = '';
            let isTimedOut = false;
            let outputExceeded = false;

            // Maximum output size: 10MB per stream to prevent OOM
            const MAX_OUTPUT_SIZE = 10 * 1024 * 1024;

            // Set timeout to prevent hanging processes
            const timeout = setTimeout(() => {
                isTimedOut = true;
                childProcess.kill('SIGTERM');

                // Force kill after 5 seconds if still running
                setTimeout(() => {
                    if (!childProcess.killed) {
                        childProcess.kill('SIGKILL');
                    }
                }, 5000);

                reject(new Error(`Command timed out after ${timeoutMs}ms`));
            }, timeoutMs);

            childProcess.stdout?.on('data', (data) => {
                if (stdout.length + data.length > MAX_OUTPUT_SIZE) {
                    outputExceeded = true;
                    childProcess.kill('SIGTERM');
                    return;
                }
                stdout += data.toString();
            });

            childProcess.stderr?.on('data', (data) => {
                if (stderr.length + data.length > MAX_OUTPUT_SIZE) {
                    outputExceeded = true;
                    childProcess.kill('SIGTERM');
                    return;
                }
                stderr += data.toString();
            });

            childProcess.on('close', (code) => {
                clearTimeout(timeout);

                if (isTimedOut) {
                    return; // Already rejected in timeout handler
                }

                if (outputExceeded) {
                    reject(new Error('Process output exceeded maximum size (10MB)'));
                    return;
                }

                resolve({
                    exitCode: code || 0,
                    stdout: stdout.trim(),
                    stderr: stderr.trim()
                });
            });

            childProcess.on('error', (error) => {
                clearTimeout(timeout);
                if (!isTimedOut) {
                    reject(error);
                }
            });
        });
    }

    public dispose(): void {
        // Cleanup if needed
    }
}