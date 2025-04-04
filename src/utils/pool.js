import { ErrorHandler, ErrorType } from './error.js';

export class ObjectPool {
    constructor(createFn, resetFn, initialSize = 0) {
        this.createFn = createFn;
        this.resetFn = resetFn;
        this.activeObjects = new Set();
        this.availableObjects = [];
        
        // Pre-populate pool
        for (let i = 0; i < initialSize; i++) {
            this.availableObjects.push(this.createFn());
        }
    }

    // Get an object from the pool
    acquire() {
        let object;
        
        if (this.availableObjects.length > 0) {
            object = this.availableObjects.pop();
        } else {
            try {
                object = this.createFn();
            } catch (error) {
                ErrorHandler.throw(
                    ErrorType.RUNTIME,
                    'Failed to create pooled object',
                    { error }
                );
            }
        }

        this.activeObjects.add(object);
        return object;
    }

    // Return an object to the pool
    release(object) {
        if (!this.activeObjects.has(object)) {
            ErrorHandler.throw(
                ErrorType.RUNTIME,
                'Attempting to release an object not managed by this pool'
            );
            return;
        }

        try {
            this.resetFn(object);
            this.activeObjects.delete(object);
            this.availableObjects.push(object);
        } catch (error) {
            ErrorHandler.throw(
                ErrorType.RUNTIME,
                'Failed to reset pooled object',
                { error }
            );
        }
    }

    // Release all active objects
    releaseAll() {
        this.activeObjects.forEach(object => this.release(object));
    }

    // Get pool statistics
    getStats() {
        return {
            active: this.activeObjects.size,
            available: this.availableObjects.length,
            total: this.activeObjects.size + this.availableObjects.length
        };
    }
}

// Example usage:
/*
const projectilePool = new ObjectPool(
    // Create function
    () => {
        return new THREE.Mesh(
            new THREE.SphereGeometry(0.5),
            new THREE.MeshBasicMaterial({ color: 0x00ff00 })
        );
    },
    // Reset function
    (projectile) => {
        projectile.position.set(0, 0, 0);
        projectile.velocity.set(0, 0, 0);
        projectile.visible = false;
    },
    // Initial pool size
    COMBAT.PROJECTILE_POOL_SIZE
);
*/ 