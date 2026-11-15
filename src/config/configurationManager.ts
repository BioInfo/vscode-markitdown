import * as vscode from 'vscode';

export interface MarkitdownConfig {
    openFileOnSuccess: boolean;
    overwriteExisting: boolean;
    /** Empty = next to the source file. Absolute, or relative to the file's workspace folder. */
    outputDirectory: string;
    keepDataUris: boolean;
    audioTranscription: boolean;
    conversionTimeoutSeconds: number;
}

const DEFAULTS: MarkitdownConfig = {
    openFileOnSuccess: true,
    overwriteExisting: false,
    outputDirectory: '',
    keepDataUris: false,
    audioTranscription: false,
    conversionTimeoutSeconds: 600,
};

export class ConfigurationManager {
    private static readonly SECTION = 'markitdown';

    public getConfiguration(): MarkitdownConfig {
        const config = vscode.workspace.getConfiguration(ConfigurationManager.SECTION);
        const pick = <K extends keyof MarkitdownConfig>(key: K): MarkitdownConfig[K] => {
            const value = config.get<MarkitdownConfig[K]>(key, DEFAULTS[key]);
            if (typeof value !== typeof DEFAULTS[key]) {
                console.warn(`[MarkItDown] Invalid value for "${key}", using default ${DEFAULTS[key]}`);
                return DEFAULTS[key];
            }
            return value;
        };
        const timeout = pick('conversionTimeoutSeconds');
        return {
            openFileOnSuccess: pick('openFileOnSuccess'),
            overwriteExisting: pick('overwriteExisting'),
            outputDirectory: pick('outputDirectory').trim(),
            keepDataUris: pick('keepDataUris'),
            audioTranscription: pick('audioTranscription'),
            conversionTimeoutSeconds: timeout > 0 ? timeout : DEFAULTS.conversionTimeoutSeconds,
        };
    }

    public onConfigurationChanged(callback: (config: MarkitdownConfig) => void): vscode.Disposable {
        return vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration(ConfigurationManager.SECTION)) {
                callback(this.getConfiguration());
            }
        });
    }
}
