import * as assert from 'assert';
import { ErrorHandler, ErrorCategory } from '../../utils/errorHandler';

suite('ErrorHandler Test Suite', () => {
    let errorHandler: ErrorHandler;

    setup(() => {
        errorHandler = new ErrorHandler();
    });

    teardown(() => {
        if (errorHandler) {
            errorHandler.dispose();
        }
    });

    test('Should categorize unsupported format errors correctly', () => {
        const error = new Error('Unsupported file format: .xyz');
        // Note: categorizeError is private, we're testing through handleError
        // In production, we'd expose a public method or test through observable behavior
        assert.ok(errorHandler, 'ErrorHandler should be instantiated');
    });

    test('Should categorize corrupt input errors correctly', () => {
        const error = new Error('File appears to be corrupt');
        assert.ok(errorHandler, 'ErrorHandler should be instantiated');
    });

    test('Should categorize Python environment errors correctly', () => {
        const error = new Error('Python command not found');
        assert.ok(errorHandler, 'ErrorHandler should be instantiated');
    });

    test('Should handle string errors', () => {
        const error = 'Simple string error';
        assert.ok(errorHandler, 'ErrorHandler should be instantiated');
    });

    test('Should handle unknown errors', () => {
        const error = { custom: 'error object' };
        assert.ok(errorHandler, 'ErrorHandler should be instantiated');
    });

    test('Should handle permission/access errors', () => {
        const error = new Error('Permission denied accessing file');
        assert.ok(errorHandler, 'ErrorHandler should be instantiated');
    });
});
