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
        
        if (!fs.existsSync(venvPythonPath)) {
            console.log('Creating virtual environment...');
            
            const result = await this.executeCommand(this.pythonExecutable!, [
                '-m', 'venv', this.venvPath
            ]);
            
            if (result.exitCode !== 0) {
                throw new Error(`Failed to create virtual environment: ${result.stderr}`);
            }
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
        
        const result = await this.executeCommand(venvPython, [
            '-c', `
import sys
from markitdown import MarkItDown

try:
    md = MarkItDown()
    result = md.convert('${inputPath.replace(/\\/g, '\\\\')}')
    
    with open('${outputPath.replace(/\\/g, '\\\\')}', 'w', encoding='utf-8') as f:
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

    private executeCommand(command: string, args: string[]): Promise<{exitCode: number, stdout: string, stderr: string}> {
        return new Promise((resolve, reject) => {
            const process = spawn(command, args, {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let stdout = '';
            let stderr = '';

            process.stdout?.on('data', (data) => {
                stdout += data.toString();
            });

            process.stderr?.on('data', (data) => {
                stderr += data.toString();
            });

            process.on('close', (code) => {
                resolve({
                    exitCode: code || 0,
                    stdout: stdout.trim(),
                    stderr: stderr.trim()
                });
            });

            process.on('error', (error) => {
                reject(error);
            });
        });
    }

    public dispose(): void {
        // Cleanup if needed
    }
}