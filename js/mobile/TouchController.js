// TouchController.js - Optimized mobile touch controls
export class TouchController {
    constructor() {
        // Core state
        this.enabled = false;
        this.initialized = false;
        
        // Movement state
        this.movement = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            up: false,
            down: false
        };
        
        // Touch state
        this.joystick = {
            active: false,
            startX: 0,
            startY: 0,
            currentX: 0,
            currentY: 0,
            element: null,
            indicator: null,
            deadzone: 10,
            maxRadius: 50
        };
        
        // Action buttons state
        this.actions = {
            fire: false,
            camera: false,
            pause: false
        };
        
        // Bind methods
        this.handleTouchStart = this.handleTouchStart.bind(this);
        this.handleTouchMove = this.handleTouchMove.bind(this);
        this.handleTouchEnd = this.handleTouchEnd.bind(this);
        this.handleActionButton = this.handleActionButton.bind(this);
        
        // Initialize if mobile
        if (this.isMobileDevice()) {
            this.init();
        }
    }
    
    isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }
    
    init() {
        if (this.initialized) return;
        
        try {
            this.createTouchInterface();
            this.addEventListeners();
            this.initialized = true;
            this.enabled = true;
            console.log('Touch controls initialized');
        } catch (error) {
            console.error('Failed to initialize touch controls:', error);
            this.cleanup();
        }
    }
    
    createTouchInterface() {
        // Create container with safe area consideration
        const container = document.createElement('div');
        container.id = 'mobile-controls';
        container.style.cssText = `
            position: fixed;
            bottom: max(env(safe-area-inset-bottom, 20px), 20px);
            left: 0;
            right: 0;
            display: flex;
            justify-content: space-between;
            padding: 20px;
            z-index: 1000;
            pointer-events: none;
            transform: scale(0.9); /* Slightly reduce size of controls */
        `;
        
        // Create joystick
        const joystickContainer = document.createElement('div');
        joystickContainer.id = 'joystick-area';
        joystickContainer.style.cssText = `
            width: 100px;
            height: 100px;
            background: rgba(0, 255, 255, 0.1);
            border: 2px solid rgba(0, 255, 255, 0.3);
            border-radius: 50%;
            position: relative;
            pointer-events: auto;
            touch-action: none;
            margin-left: 10px;
        `;
        
        // Joystick indicator
        const indicator = document.createElement('div');
        indicator.style.cssText = `
            width: 35px;
            height: 35px;
            background: rgba(0, 255, 255, 0.2);
            border: 2px solid rgba(0, 255, 255, 0.5);
            border-radius: 50%;
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            transition: all 0.1s ease;
        `;
        
        joystickContainer.appendChild(indicator);
        this.joystick.element = joystickContainer;
        this.joystick.indicator = indicator;
        
        // Create action buttons
        const buttonsContainer = document.createElement('div');
        buttonsContainer.style.cssText = `
            display: flex;
            gap: 10px;
            pointer-events: auto;
        `;
        
        const buttons = [
            { id: 'fire', label: 'FIRE', color: '#ff3366' },
            { id: 'camera', label: 'CAM', color: '#33ff99' },
            { id: 'pause', label: '❚❚', color: '#ffcc33' }
        ];
        
        buttons.forEach(btn => {
            const button = document.createElement('button');
            button.id = `mobile-${btn.id}`;
            button.style.cssText = `
                width: 60px;
                height: 60px;
                background: rgba(0, 255, 255, 0.15);
                border: none;
                border-radius: 50%;
                color: ${btn.color};
                font-family: 'Orbitron', sans-serif;
                font-size: 12px;
                font-weight: bold;
                text-transform: uppercase;
                display: flex;
                align-items: center;
                justify-content: center;
                touch-action: none;
                -webkit-tap-highlight-color: transparent;
                transition: all 0.2s ease;
            `;
            button.textContent = btn.label;
            button.dataset.action = btn.id;
            
            buttonsContainer.appendChild(button);
        });
        
        container.appendChild(joystickContainer);
        container.appendChild(buttonsContainer);
        document.body.appendChild(container);
    }
    
    addEventListeners() {
        // Joystick events
        const joystick = this.joystick.element;
        if (joystick) {
            joystick.addEventListener('touchstart', this.handleTouchStart, { passive: false });
            joystick.addEventListener('touchmove', this.handleTouchMove, { passive: false });
            joystick.addEventListener('touchend', this.handleTouchEnd, { passive: false });
        }
        
        // Action buttons events
        const buttons = document.querySelectorAll('[data-action]');
        buttons.forEach(button => {
            button.addEventListener('touchstart', (e) => {
                e.preventDefault();
                const action = button.dataset.action;
                this.handleActionButton(action, true);
                button.style.transform = 'scale(0.9)';
                button.style.background = 'rgba(0, 255, 255, 0.3)';
                
                // Haptic feedback if available
                if ('vibrate' in navigator) {
                    navigator.vibrate(50);
                }
            });
            
            button.addEventListener('touchend', (e) => {
                e.preventDefault();
                const action = button.dataset.action;
                this.handleActionButton(action, false);
                button.style.transform = '';
                button.style.background = 'rgba(0, 255, 255, 0.15)';
            });
        });
    }
    
    handleTouchStart(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const rect = this.joystick.element.getBoundingClientRect();
        
        this.joystick.active = true;
        this.joystick.startX = touch.clientX - rect.left;
        this.joystick.startY = touch.clientY - rect.top;
        
        // Center the indicator initially
        this.updateJoystickIndicator(this.joystick.startX, this.joystick.startY);
    }
    
    handleTouchMove(e) {
        if (!this.joystick.active) return;
        e.preventDefault();
        
        const touch = e.touches[0];
        const rect = this.joystick.element.getBoundingClientRect();
        
        const currentX = touch.clientX - rect.left;
        const currentY = touch.clientY - rect.top;
        
        this.updateJoystickIndicator(currentX, currentY);
        this.updateMovement(currentX, currentY);
    }
    
    handleTouchEnd(e) {
        e.preventDefault();
        this.joystick.active = false;
        
        // Reset indicator position
        this.joystick.indicator.style.transform = 'translate(-50%, -50%)';
        
        // Reset movement
        Object.keys(this.movement).forEach(key => {
            this.movement[key] = false;
        });
    }
    
    updateJoystickIndicator(x, y) {
        const centerX = this.joystick.element.clientWidth / 2;
        const centerY = this.joystick.element.clientHeight / 2;
        
        let deltaX = x - centerX;
        let deltaY = y - centerY;
        
        // Calculate distance from center
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        // Limit to max radius
        if (distance > this.joystick.maxRadius) {
            const angle = Math.atan2(deltaY, deltaX);
            deltaX = Math.cos(angle) * this.joystick.maxRadius;
            deltaY = Math.sin(angle) * this.joystick.maxRadius;
        }
        
        // Update indicator position
        this.joystick.indicator.style.transform = 
            `translate(calc(-50% + ${deltaX}px), calc(-50% + ${deltaY}px))`;
    }
    
    updateMovement(x, y) {
        const centerX = this.joystick.element.clientWidth / 2;
        const centerY = this.joystick.element.clientHeight / 2;
        
        const deltaX = x - centerX;
        const deltaY = y - centerY;
        
        // Calculate distance and angle
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const angle = Math.atan2(deltaY, deltaX);
        
        // Only update if outside deadzone
        if (distance > this.joystick.deadzone) {
            // Convert angle to movement
            this.movement.forward = angle > -Math.PI/4 && angle < Math.PI/4;
            this.movement.right = angle > -3*Math.PI/4 && angle < -Math.PI/4;
            this.movement.backward = (angle > 3*Math.PI/4 || angle < -3*Math.PI/4);
            this.movement.left = angle > Math.PI/4 && angle < 3*Math.PI/4;
        } else {
            // Reset movement if within deadzone
            Object.keys(this.movement).forEach(key => {
                this.movement[key] = false;
            });
        }
    }
    
    handleActionButton(action, isPressed) {
        this.actions[action] = isPressed;
        
        // Dispatch custom event
        const event = new CustomEvent('mobileAction', {
            detail: { action, isPressed }
        });
        document.dispatchEvent(event);
    }
    
    getMovementState() {
        return { ...this.movement };
    }
    
    getActionState() {
        return { ...this.actions };
    }
    
    cleanup() {
        try {
            // Remove event listeners
            if (this.joystick.element) {
                this.joystick.element.removeEventListener('touchstart', this.handleTouchStart);
                this.joystick.element.removeEventListener('touchmove', this.handleTouchMove);
                this.joystick.element.removeEventListener('touchend', this.handleTouchEnd);
            }
            
            // Remove UI elements
            const container = document.getElementById('mobile-controls');
            if (container) {
                container.remove();
            }
            
            this.initialized = false;
            this.enabled = false;
            
            console.log('Touch controls cleaned up');
        } catch (error) {
            console.error('Error cleaning up touch controls:', error);
        }
    }
}

// Export singleton instance
export const touchController = new TouchController(); 