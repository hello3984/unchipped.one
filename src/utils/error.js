// Error types enum
export const ErrorType = {
    INITIALIZATION: 'initialization',
    RESOURCE_LOADING: 'resource_loading',
    RUNTIME: 'runtime',
    NETWORK: 'network',
    INPUT: 'input'
};

// Custom game error class
export class GameError extends Error {
    constructor(type, message, details = {}) {
        super(message);
        this.name = 'GameError';
        this.type = type;
        this.details = details;
        this.timestamp = new Date().toISOString();
    }
}

// Error handling configuration
const errorConfig = {
    showInGame: true,
    logToConsole: true,
    errorDisplayDuration: 5000, // ms
    styles: {
        container: {
            position: 'fixed',
            top: '20px',
            right: '20px',
            maxWidth: '400px',
            zIndex: '9999',
            fontFamily: 'monospace',
            pointerEvents: 'none'
        },
        error: {
            background: 'rgba(0, 0, 0, 0.8)',
            color: '#ff3366',
            padding: '15px',
            marginBottom: '10px',
            borderRadius: '5px',
            border: '1px solid #ff3366',
            boxShadow: '0 0 10px rgba(255, 51, 102, 0.3)',
            animation: 'fadeIn 0.3s ease-in-out'
        }
    }
};

// Error display management
class ErrorDisplay {
    static #instance;
    #container;
    #activeErrors = new Map();

    constructor() {
        if (ErrorDisplay.#instance) {
            return ErrorDisplay.#instance;
        }
        this.#createContainer();
        this.#createStyles();
        ErrorDisplay.#instance = this;
    }

    #createContainer() {
        this.#container = document.createElement('div');
        this.#container.id = 'error-display-container';
        Object.assign(this.#container.style, errorConfig.styles.container);
        document.body.appendChild(this.#container);
    }

    #createStyles() {
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; transform: translateX(20px); }
                to { opacity: 1; transform: translateX(0); }
            }
            @keyframes fadeOut {
                from { opacity: 1; transform: translateX(0); }
                to { opacity: 0; transform: translateX(20px); }
            }
        `;
        document.head.appendChild(style);
    }

    show(error) {
        const errorElement = document.createElement('div');
        const errorId = Date.now().toString();
        
        Object.assign(errorElement.style, errorConfig.styles.error);

        errorElement.innerHTML = `
            <div style="margin-bottom: 5px;">
                <strong style="color: #ff3366;">${error.type.toUpperCase()}</strong>
                <span style="float: right; font-size: 0.8em; color: #666;">
                    ${new Date().toLocaleTimeString()}
                </span>
            </div>
            <div style="color: #00ffff;">${error.message}</div>
            ${error.details ? `
                <div style="margin-top: 5px; font-size: 0.8em; color: #666;">
                    ${JSON.stringify(error.details)}
                </div>
            ` : ''}
        `;

        this.#container.appendChild(errorElement);
        this.#activeErrors.set(errorId, errorElement);

        // Remove error after duration
        setTimeout(() => this.#removeError(errorId), errorConfig.errorDisplayDuration);
    }

    #removeError(errorId) {
        const errorElement = this.#activeErrors.get(errorId);
        if (errorElement) {
            errorElement.style.animation = 'fadeOut 0.3s ease-in-out';
            setTimeout(() => {
                errorElement.remove();
                this.#activeErrors.delete(errorId);
            }, 300);
        }
    }
}

// Main error handler
export const ErrorHandler = {
    display: new ErrorDisplay(),

    handle(error) {
        if (!(error instanceof GameError)) {
            error = new GameError(
                ErrorType.RUNTIME,
                error.message,
                { originalError: error }
            );
        }

        // Log to console if enabled
        if (errorConfig.logToConsole) {
            console.error('Game Error:', {
                type: error.type,
                message: error.message,
                details: error.details,
                timestamp: error.timestamp,
                stack: error.stack
            });
        }

        // Show in-game error if enabled
        if (errorConfig.showInGame) {
            this.display.show(error);
        }

        // Return false if the error is fatal
        return !this.isFatalError(error);
    },

    isFatalError(error) {
        return error.type === ErrorType.INITIALIZATION;
    },

    // Utility method for throwing game errors
    throw(type, message, details = {}) {
        throw new GameError(type, message, details);
    }
};

// Example usage:
/*
try {
    // Some game operation
    throw new GameError(
        ErrorType.RESOURCE_LOADING,
        'Failed to load texture',
        { textureUrl: 'texture.png' }
    );
} catch (error) {
    ErrorHandler.handle(error);
}
*/ 