// Error types and categorization. No vscode import, so plain-Node tests cover it.

export enum ErrorCategory {
    UnsupportedFormat = 'UnsupportedFormat',
    CorruptInput = 'CorruptInput',
    MarkitdownError = 'MarkitdownError',
    IOError = 'IOError',
    EnvironmentMissing = 'EnvironmentMissing',
    Cancelled = 'Cancelled',
    Unknown = 'Unknown'
}

export interface MarkitdownError {
    category: ErrorCategory;
    message: string;
    details?: string;
    suggestion?: string;
}

/**
 * An environment problem whose message is already written for the user
 * (which interpreter was found, what to fix). Shown verbatim.
 */
export class EnvironmentError extends Error {
    constructor(message: string, public readonly suggestion?: string) {
        super(message);
        this.name = 'EnvironmentError';
    }
}

/** A conversion failure reported by the Python runner, with its own type. */
export class ConversionError extends Error {
    constructor(message: string, public readonly errorType: string) {
        super(message);
        this.name = 'ConversionError';
    }
}

const CONVERSION_CATEGORY: Record<string, ErrorCategory> = {
    corrupt: ErrorCategory.CorruptInput,
    unsupported: ErrorCategory.UnsupportedFormat,
    exists: ErrorCategory.IOError,
};

/**
 * Map a thrown value to a category and user message. Typed errors keep their
 * message. Untyped ones are matched on narrow phrases only, so a path that
 * happens to contain "python" or "access" does not change the category.
 */
export function categorize(error: unknown): MarkitdownError {
    if (typeof error === 'string') {
        return { category: ErrorCategory.Unknown, message: error };
    }
    if (error instanceof EnvironmentError) {
        return {
            category: ErrorCategory.EnvironmentMissing,
            message: error.message,
            suggestion: error.suggestion,
            details: error.stack
        };
    }
    if (error instanceof ConversionError) {
        return {
            category: CONVERSION_CATEGORY[error.errorType] ?? ErrorCategory.MarkitdownError,
            message: error.message,
            details: error.stack
        };
    }
    if (error instanceof Error) {
        if (error.name === 'ProcessCancelledError') {
            return { category: ErrorCategory.Cancelled, message: 'Cancelled' };
        }
        const m = error.message.toLowerCase();
        if (m.startsWith('unsupported file format')) {
            return {
                category: ErrorCategory.UnsupportedFormat,
                message: error.message,
                suggestion: 'Check that MarkItDown supports this file type'
            };
        }
        if (/\bcorrupt/.test(m)) {
            return { category: ErrorCategory.CorruptInput, message: error.message };
        }
        if (/command not found|spawn .*python.* enoent/.test(m)) {
            return {
                category: ErrorCategory.EnvironmentMissing,
                message: 'Python environment not available',
                suggestion: 'Run "MarkItDown: Rebuild Environment", or check that Python is installed'
            };
        }
        if (/\beacces\b|\beperm\b|permission denied/.test(m)) {
            return {
                category: ErrorCategory.IOError,
                message: error.message,
                suggestion: 'Check file permissions and that the file is not open in another application'
            };
        }
        return { category: ErrorCategory.MarkitdownError, message: error.message, details: error.stack };
    }
    return { category: ErrorCategory.Unknown, message: 'An unknown error occurred', details: JSON.stringify(error) };
}
