import * as vscode from 'vscode';

export interface MarkitdownConfig {
    openFileOnSuccess: boolean;
    overwriteExisting: boolean;
}

export class ConfigurationManager {
    private static readonly SECTION = 'markitdown';

    public getConfiguration(): MarkitdownConfig {
        const config = vscode.workspace.getConfiguration(ConfigurationManager.SECTION);

        // Get raw values for validation
        const openFileOnSuccessRaw = config.get<boolean>('openFileOnSuccess', true);
        const overwriteExistingRaw = config.get<boolean>('overwriteExisting', false);

        // Validate types and use defaults if invalid
        const openFileOnSuccess = this.validateBoolean(
            openFileOnSuccessRaw,
            'openFileOnSuccess',
            true
        );

        const overwriteExisting = this.validateBoolean(
            overwriteExistingRaw,
            'overwriteExisting',
            false
        );

        return {
            openFileOnSuccess,
            overwriteExisting
        };
    }

    private validateBoolean(value: any, settingName: string, defaultValue: boolean): boolean {
        if (typeof value !== 'boolean') {
            console.warn(
                `[MarkItDown] Invalid configuration value for "${settingName}": ` +
                `expected boolean, got ${typeof value}. Using default: ${defaultValue}`
            );
            return defaultValue;
        }
        return value;
    }

    public async updateConfiguration(key: keyof MarkitdownConfig, value: boolean): Promise<void> {
        const config = vscode.workspace.getConfiguration(ConfigurationManager.SECTION);
        await config.update(key, value, vscode.ConfigurationTarget.Global);
    }

    public onConfigurationChanged(callback: (config: MarkitdownConfig) => void): vscode.Disposable {
        return vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration(ConfigurationManager.SECTION)) {
                callback(this.getConfiguration());
            }
        });
    }
}