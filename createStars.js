// Optimized star field creation for X-Machina game
// This version uses traditional browser globals instead of ES6 modules

// Global star creation functions
(function(window) {
    'use strict';

    // Create optimized stars for the scene
    window.createOptimizedStars = function(scene) {
        if (!scene) {
            console.error('Scene is required for star creation');
            return;
        }

        console.log('Creating optimized stars');
        
        // Create star field
        const starCount = 2500;
        const starSize = 0.5;
        
        if (!window.THREE) {
            console.error('THREE.js not loaded');
            return null;
        }

        try {
            // Create geometry for stars
            const starsGeometry = new THREE.BufferGeometry();
            const starPositions = new Float32Array(starCount * 3);
            
            // Create material for stars
            const starMaterial = new THREE.PointsMaterial({
                color: 0xffffff,
                size: starSize,
                transparent: true,
                opacity: 0.8,
                sizeAttenuation: false
            });
            
            // Generate random positions
            for (let i = 0; i < starCount; i++) {
                const i3 = i * 3;
                const radius = 500;
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.acos(Math.random() * 2 - 1);
                
                starPositions[i3] = radius * Math.sin(phi) * Math.cos(theta);
                starPositions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
                starPositions[i3 + 2] = radius * Math.cos(phi);
            }
            
            starsGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
            const starField = new THREE.Points(starsGeometry, starMaterial);
            scene.add(starField);
            
            return starField;
        } catch (error) {
            console.error('Error creating stars:', error);
            return null;
        }
    };

    // Fallback star creation
    window.createStars = function(scene) {
        try {
            console.log('Using fallback star creation');
            const geometry = new THREE.BufferGeometry();
            const vertices = [];
            
            for (let i = 0; i < 1000; i++) {
                vertices.push(
                    Math.random() * 2000 - 1000,
                    Math.random() * 2000 - 1000,
                    Math.random() * 2000 - 1000
                );
            }
            
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
            const material = new THREE.PointsMaterial({ color: 0xffffff, size: 0.5 });
            const stars = new THREE.Points(geometry, material);
            scene.add(stars);
            return stars;
        } catch (error) {
            console.error('Error in fallback star creation:', error);
            return null;
        }
    };

    // Add a few special stars with glow effect
    function addSpecialStars(scene) {
        try {
            // Create a few brighter stars with different colors
            const brightStarCount = 20;
            const brightStarColors = [
                0xffaa00, // yellow
                0x00ffff, // cyan
                0xaaaaff, // light blue
                0xffffff  // white
            ];
            
            for (let i = 0; i < brightStarCount; i++) {
                // Random position
                const radius = 400;
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.acos(Math.random() * 2 - 1);
                
                const x = radius * Math.sin(phi) * Math.cos(theta);
                const y = radius * Math.sin(phi) * Math.sin(theta);
                const z = radius * Math.cos(phi);
                
                // Random size and color
                const size = Math.random() * 2 + 1;
                const color = brightStarColors[Math.floor(Math.random() * brightStarColors.length)];
                
                // Create special star with sprite
                const starMaterial = new THREE.SpriteMaterial({
                    map: createStarTexture(color),
                    color: color,
                    transparent: true,
                    blending: THREE.AdditiveBlending
                });
                
                const star = new THREE.Sprite(starMaterial);
                star.position.set(x, y, z);
                star.scale.set(size, size, 1);
                scene.add(star);
            }
        } catch (error) {
            console.error("Error in addSpecialStars:", error);
        }
    }

    // Create a star texture
    function createStarTexture(color) {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = 32;
            canvas.height = 32;
            const ctx = canvas.getContext('2d');
            
            // Create a radial gradient for the glow effect
            const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
            gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
            gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.8)');
            gradient.addColorStop(0.7, 'rgba(64, 64, 64, 0.3)');
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
            
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 32, 32);
            
            const texture = new THREE.CanvasTexture(canvas);
            texture.needsUpdate = true;
            return texture;
        } catch (error) {
            console.error("Error in createStarTexture:", error);
            return null;
        }
    }
})(window); 