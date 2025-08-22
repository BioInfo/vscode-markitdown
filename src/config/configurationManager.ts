import * as vscode from 'vscode';

export interface MarkitdownConfig {
    openFileOnSuccess: boolean;
    overwriteExisting: boolean;
}

export class ConfigurationManager {
    private static readonly SECTION = 'markitdown';

    public getConfiguration(): MarkitdownConfig {
        const config = vscode.workspace.getConfiguration(ConfigurationManager.SECTION);
        
        return {
            openFileOnSuccess: config.get<boolean>('openFileOnSuccess', true),
            overwriteExisting: config.get<boolean>('overwriteExisting', false)
        };
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