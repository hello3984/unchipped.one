// TouchControls.js - Safe touch control implementation
export class TouchControls {
    constructor() {
        // Touch state management
        this.touches = new Map();
        this.joystick = {
            active: false,
            startX: 0,
            startY: 0,
            currentX: 0,
            currentY: 0,
            deadzone: 20,
            maxRadius: 60
        };
        
        // Movement state
        this.moveState = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            up: false,
            down: false
        };
        
        // Action state
        this.actions = {
            fire: false,
            camera: false,
            pause: false
        };
        
        // Safety flags
        this.isEnabled = false;
        this.isMobile = this.detectMobile();
        this.hasActiveTouch = false;
        
        // Bind methods
        this.handleTouchStart = this.handleTouchStart.bind(this);
        this.handleTouchMove = this.handleTouchMove.bind(this);
        this.handleTouchEnd = this.handleTouchEnd.bind(this);
    }
    
    // Safe mobile detection
    detectMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }
    
    // Initialize touch controls
    init() {
        if (!this.isMobile) {
            console.log("Touch controls disabled for non-mobile device");
            return;
        }
        
        try {
            this.createTouchInterface();
            this.addEventListeners();
            this.isEnabled = true;
            console.log("Touch controls initialized successfully");
        } catch (error) {
            console.error("Failed to initialize touch controls:", error);
            this.isEnabled = false;
        }
    }
    
    // Create touch interface elements
    createTouchInterface() {
        const touchControls = document.createElement('div');
        touchControls.id = 'touch-controls';
        touchControls.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 20px;
            width: 120px;
            height: 120px;
            background: rgba(0, 255, 255, 0.2);
            border: 2px solid #00ffff;
            border-radius: 50%;
            z-index: 1000;
            touch-action: none;
        `;
        
        const actionButtons = document.createElement('div');
        actionButtons.id = 'touch-action-buttons';
        actionButtons.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            display: flex;
            gap: 10px;
            z-index: 1000;
        `;
        
        // Add action buttons
        ['fire', 'camera', 'pause'].forEach(action => {
            const button = document.createElement('button');
            button.id = `touch-${action}-button`;
            button.style.cssText = `
                width: 60px;
                height: 60px;
                background: rgba(0, 255, 255, 0.2);
                border: 2px solid #00ffff;
                border-radius: 50%;
                color: #00ffff;
                font-size: 12px;
                text-transform: uppercase;
                touch-action: none;
            `;
            button.textContent = action;
            actionButtons.appendChild(button);
        });
        
        document.body.appendChild(touchControls);
        document.body.appendChild(actionButtons);
    }
    
    // Add event listeners safely
    addEventListeners() {
        const touchControls = document.getElementById('touch-controls');
        if (!touchControls) return;
        
        // Touch events for joystick
        touchControls.addEventListener('touchstart', this.handleTouchStart, { passive: false });
        touchControls.addEventListener('touchmove', this.handleTouchMove, { passive: false });
        touchControls.addEventListener('touchend', this.handleTouchEnd, { passive: false });
        
        // Action buttons
        ['fire', 'camera', 'pause'].forEach(action => {
            const button = document.getElementById(`touch-${action}-button`);
            if (button) {
                button.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    this.actions[action] = true;
                    this.handleAction(action, true);
                });
                
                button.addEventListener('touchend', (e) => {
                    e.preventDefault();
                    this.actions[action] = false;
                    this.handleAction(action, false);
                });
            }
        });
    }
    
    // Safe touch event handlers
    handleTouchStart(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const rect = e.target.getBoundingClientRect();
        
        this.joystick.active = true;
        this.joystick.startX = touch.clientX - rect.left;
        this.joystick.startY = touch.clientY - rect.top;
        this.joystick.currentX = this.joystick.startX;
        this.joystick.currentY = this.joystick.startY;
        
        this.updateMovementState();
    }
    
    handleTouchMove(e) {
        e.preventDefault();
        if (!this.joystick.active) return;
        
        const touch = e.touches[0];
        const rect = e.target.getBoundingClientRect();
        
        this.joystick.currentX = touch.clientX - rect.left;
        this.joystick.currentY = touch.clientY - rect.top;
        
        this.updateMovementState();
    }
    
    handleTouchEnd(e) {
        e.preventDefault();
        this.joystick.active = false;
        this.resetMovementState();
    }
    
    // Update movement state based on joystick position
    updateMovementState() {
        if (!this.joystick.active) return;
        
        const dx = this.joystick.currentX - this.joystick.startX;
        const dy = this.joystick.currentY - this.joystick.startY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < this.joystick.deadzone) {
            this.resetMovementState();
            return;
        }
        
        // Normalize direction
        const angle = Math.atan2(dy, dx);
        
        // Update movement state based on angle
        this.moveState.forward = angle > -Math.PI/4 && angle < Math.PI/4;
        this.moveState.right = angle > -3*Math.PI/4 && angle < -Math.PI/4;
        this.moveState.backward = (angle > 3*Math.PI/4 || angle < -3*Math.PI/4);
        this.moveState.left = angle > Math.PI/4 && angle < 3*Math.PI/4;
    }
    
    // Reset movement state safely
    resetMovementState() {
        Object.keys(this.moveState).forEach(key => {
            this.moveState[key] = false;
        });
    }
    
    // Handle action button events
    handleAction(action, isActive) {
        switch(action) {
            case 'fire':
                if (isActive && !this.weaponCooldown) {
                    // Trigger fire event
                    document.dispatchEvent(new CustomEvent('touchFireWeapon'));
                }
                break;
            case 'camera':
                if (isActive) {
                    // Trigger camera toggle event
                    document.dispatchEvent(new CustomEvent('touchToggleCamera'));
                }
                break;
            case 'pause':
                if (isActive) {
                    // Trigger pause event
                    document.dispatchEvent(new CustomEvent('touchTogglePause'));
                }
                break;
        }
    }
    
    // Get current movement state
    getMovementState() {
        return { ...this.moveState };
    }
    
    // Clean up touch controls
    destroy() {
        if (!this.isEnabled) return;
        
        try {
            // Remove event listeners
            const touchControls = document.getElementById('touch-controls');
            if (touchControls) {
                touchControls.removeEventListener('touchstart', this.handleTouchStart);
                touchControls.removeEventListener('touchmove', this.handleTouchMove);
                touchControls.removeEventListener('touchend', this.handleTouchEnd);
                touchControls.remove();
            }
            
            // Remove action buttons
            const actionButtons = document.getElementById('touch-action-buttons');
            if (actionButtons) {
                actionButtons.remove();
            }
            
            this.isEnabled = false;
            console.log("Touch controls cleaned up successfully");
        } catch (error) {
            console.error("Error cleaning up touch controls:", error);
        }
    }
}

// Export a single instance
export const touchControls = new TouchControls(); 