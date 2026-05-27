import * as assert from 'assert';
import { ErrorHandler, ErrorCategory } from '../../utils/errorHandler';

suite('ErrorHandler Test Suite', () => {
    let errorHandler: ErrorHandler;

    setup(() => {
        errorHandler = new ErrorHandler();
    });

    teardown(() => {
        errorHandler?.dispose();
    });

    test('categorizes unsupported format errors', () => {
        const result = errorHandler.categorize(new Error('Unsupported file format: .xyz'));
        assert.strictEqual(result.category, ErrorCategory.UnsupportedFormat);
    });

    test('categorizes corrupt/invalid input errors', () => {
        const result = errorHandler.categorize(new Error('File is corrupt'));
        assert.strictEqual(result.category, ErrorCategory.CorruptInput);
    });

    test('categorizes Python environment errors', () => {
        const result = errorHandler.categorize(new Error('python command not found'));
        assert.strictEqual(result.category, ErrorCategory.EnvironmentMissing);
    });

    test('categorizes permission/access errors as IO', () => {
        const result = errorHandler.categorize(new Error('Permission denied accessing file'));
        assert.strictEqual(result.category, ErrorCategory.IOError);
    });

    test('categorizes a generic Error as MarkitdownError and keeps the message', () => {
        const result = errorHandler.categorize(new Error('something specific went wrong'));
        assert.strictEqual(result.category, ErrorCategory.MarkitdownError);
        assert.strictEqual(result.message, 'something specific went wrong');
    });

    test('categorizes string errors as Unknown', () => {
        const result = errorHandler.categorize('plain string error');
        assert.strictEqual(result.category, ErrorCategory.Unknown);
        assert.strictEqual(result.message, 'plain string error');
    });

    test('categorizes non-Error objects as Unknown', () => {
        const result = errorHandler.categorize({ custom: 'object' });
        assert.strictEqual(result.category, ErrorCategory.Unknown);
    });
});
