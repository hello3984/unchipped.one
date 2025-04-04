// ControlManager.js - Safe control system integration
import { touchControls } from './TouchControls.js';

export class ControlManager {
    constructor() {
        // Control states
        this.moveState = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            up: false,
            down: false
        };
        
        // Input sources
        this.inputSources = {
            keyboard: true,
            touch: false
        };
        
        // Safety flags
        this.isInitialized = false;
        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        // Bind methods
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleKeyUp = this.handleKeyUp.bind(this);
        this.handleTouchEvents = this.handleTouchEvents.bind(this);
    }
    
    // Initialize control system
    init() {
        if (this.isInitialized) return;
        
        try {
            // Initialize keyboard controls
            this.setupKeyboardControls();
            
            // Initialize touch controls if on mobile
            if (this.isMobile) {
                this.setupTouchControls();
            }
            
            this.isInitialized = true;
            console.log("Control system initialized successfully");
        } catch (error) {
            console.error("Failed to initialize control system:", error);
            this.isInitialized = false;
        }
    }
    
    // Set up keyboard controls safely
    setupKeyboardControls() {
        document.addEventListener('keydown', this.handleKeyDown);
        document.addEventListener('keyup', this.handleKeyUp);
    }
    
    // Set up touch controls safely
    setupTouchControls() {
        try {
            touchControls.init();
            this.inputSources.touch = true;
            
            // Listen for touch control events
            document.addEventListener('touchFireWeapon', () => this.handleAction('fire'));
            document.addEventListener('touchToggleCamera', () => this.handleAction('camera'));
            document.addEventListener('touchTogglePause', () => this.handleAction('pause'));
            
            // Start touch state update loop
            this.startTouchStateUpdate();
        } catch (error) {
            console.error("Failed to setup touch controls:", error);
            this.inputSources.touch = false;
        }
    }
    
    // Handle keyboard input safely
    handleKeyDown(event) {
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') return;
        
        const keyCode = event.code || event.key;
        this.updateMovementState(keyCode, true);
    }
    
    handleKeyUp(event) {
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') return;
        
        const keyCode = event.code || event.key;
        this.updateMovementState(keyCode, false);
    }
    
    // Update movement state based on keyboard input
    updateMovementState(keyCode, isActive) {
        switch (keyCode) {
            case 'KeyW':
            case 'ArrowUp':
                this.moveState.forward = isActive;
                break;
            case 'KeyS':
            case 'ArrowDown':
                this.moveState.backward = isActive;
                break;
            case 'KeyA':
            case 'ArrowLeft':
                this.moveState.left = isActive;
                break;
            case 'KeyD':
            case 'ArrowRight':
                this.moveState.right = isActive;
                break;
            case 'Space':
                this.moveState.up = isActive;
                break;
            case 'ShiftLeft':
            case 'ShiftRight':
                this.moveState.down = isActive;
                break;
        }
    }
    
    // Handle touch state updates safely
    startTouchStateUpdate() {
        if (!this.inputSources.touch) return;
        
        const updateTouchState = () => {
            if (!touchControls.isEnabled) return;
            
            try {
                const touchState = touchControls.getMovementState();
                
                // Merge touch state with keyboard state
                Object.keys(touchState).forEach(key => {
                    this.moveState[key] = this.moveState[key] || touchState[key];
                });
            } catch (error) {
                console.error("Error updating touch state:", error);
            }
            
            requestAnimationFrame(updateTouchState);
        };
        
        updateTouchState();
    }
    
    // Handle game actions
    handleAction(action) {
        // Dispatch action event for game to handle
        const actionEvent = new CustomEvent('gameAction', {
            detail: { action: action }
        });
        document.dispatchEvent(actionEvent);
    }
    
    // Get current movement state
    getMovementState() {
        return { ...this.moveState };
    }
    
    // Clean up control system
    destroy() {
        if (!this.isInitialized) return;
        
        try {
            // Remove keyboard listeners
            document.removeEventListener('keydown', this.handleKeyDown);
            document.removeEventListener('keyup', this.handleKeyUp);
            
            // Clean up touch controls
            if (this.inputSources.touch) {
                touchControls.destroy();
            }
            
            this.isInitialized = false;
            console.log("Control system cleaned up successfully");
        } catch (error) {
            console.error("Error cleaning up control system:", error);
        }
    }
}

// Export a single instance
export const controlManager = new ControlManager(); 