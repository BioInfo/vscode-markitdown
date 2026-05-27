import * as assert from 'assert';
import { ConfigurationManager } from '../../config/configurationManager';

suite('ConfigurationManager Test Suite', () => {
    let configManager: ConfigurationManager;

    setup(() => {
        configManager = new ConfigurationManager();
    });

    test('Should return default configuration', () => {
        const config = configManager.getConfiguration();
        assert.ok(config, 'Configuration should be returned');
        assert.strictEqual(typeof config.openFileOnSuccess, 'boolean', 'openFileOnSuccess should be boolean');
        assert.strictEqual(typeof config.overwriteExisting, 'boolean', 'overwriteExisting should be boolean');
    });

    test('Configuration should have openFileOnSuccess property', () => {
        const config = configManager.getConfiguration();
        assert.ok('openFileOnSuccess' in config, 'Should have openFileOnSuccess property');
    });

    test('Configuration should have overwriteExisting property', () => {
        const config = configManager.getConfiguration();
        assert.ok('overwriteExisting' in config, 'Should have overwriteExisting property');
    });

    test('Should validate boolean types', () => {
        const config = configManager.getConfiguration();
        // Default values should be valid booleans
        assert.strictEqual(typeof config.openFileOnSuccess, 'boolean');
        assert.strictEqual(typeof config.overwriteExisting, 'boolean');
    });
});
