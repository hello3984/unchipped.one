import { ErrorHandler, ErrorType } from '../utils/error.js';
import { GAME_STATE, WORLD, EFFECTS } from '../utils/constants.js';
import * as THREE from 'three';

class Game {
    static #instance;
    
    constructor() {
        if (Game.#instance) {
            return Game.#instance;
        }
        
        this.state = GAME_STATE.START;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.lastFrameTime = 0;
        this.deltaTime = 0;
        
        Game.#instance = this;
    }

    async initialize() {
        try {
            console.log("Initializing game...");
            
            // Create scene
            this.scene = new THREE.Scene();
            this.scene.background = new THREE.Color(EFFECTS.BACKGROUND_COLOR);

            // Create camera
            this.camera = new THREE.PerspectiveCamera(
                75,
                window.innerWidth / window.innerHeight,
                0.1,
                1000
            );

            // Create renderer
            this.renderer = new THREE.WebGLRenderer({
                canvas: document.getElementById('game'),
                antialias: true
            });
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
            this.renderer.toneMappingExposure = 1.2;

            // Set up post-processing
            await this.setupPostProcessing();

            // Add basic lighting
            this.setupLighting();

            // Initialize game systems
            await this.initializeSystems();

            // Set up event listeners
            this.setupEventListeners();

            // Start game loop
            this.startGameLoop();

            console.log("Game initialization complete");
        } catch (error) {
            ErrorHandler.throw(
                ErrorType.INITIALIZATION,
                'Failed to initialize game',
                { error }
            );
        }
    }

    async setupPostProcessing() {
        try {
            // Post-processing setup will be implemented here
            // This will be moved from the current script.js
        } catch (error) {
            ErrorHandler.throw(
                ErrorType.INITIALIZATION,
                'Failed to setup post-processing',
                { error }
            );
        }
    }

    setupLighting() {
        try {
            // Add ambient light
            const ambientLight = new THREE.AmbientLight(0x333333);
            this.scene.add(ambientLight);

            // Add directional light (moonlight)
            const directionalLight = new THREE.DirectionalLight(0x6666ff, 0.5);
            directionalLight.position.set(0, 50, 0);
            directionalLight.castShadow = true;
            
            // Configure shadow properties
            directionalLight.shadow.mapSize.width = 1024;
            directionalLight.shadow.mapSize.height = 1024;
            directionalLight.shadow.camera.near = 10;
            directionalLight.shadow.camera.far = 200;
            directionalLight.shadow.camera.left = -100;
            directionalLight.shadow.camera.right = 100;
            directionalLight.shadow.camera.top = 100;
            directionalLight.shadow.camera.bottom = -100;
            
            this.scene.add(directionalLight);
        } catch (error) {
            ErrorHandler.throw(
                ErrorType.INITIALIZATION,
                'Failed to setup lighting',
                { error }
            );
        }
    }

    async initializeSystems() {
        try {
            // Initialize game systems
            // This will be implemented as we move the systems from script.js
        } catch (error) {
            ErrorHandler.throw(
                ErrorType.INITIALIZATION,
                'Failed to initialize game systems',
                { error }
            );
        }
    }

    setupEventListeners() {
        try {
            // Window resize handler
            window.addEventListener('resize', () => {
                this.camera.aspect = window.innerWidth / window.innerHeight;
                this.camera.updateProjectionMatrix();
                this.renderer.setSize(window.innerWidth, window.innerHeight);
            });

            // Other event listeners will be added here
        } catch (error) {
            ErrorHandler.throw(
                ErrorType.INITIALIZATION,
                'Failed to setup event listeners',
                { error }
            );
        }
    }

    startGameLoop() {
        try {
            const animate = (currentTime) => {
                requestAnimationFrame(animate);

                // Calculate delta time
                this.deltaTime = (currentTime - this.lastFrameTime) / 1000;
                this.lastFrameTime = currentTime;

                // Update game state
                this.update();

                // Render scene
                this.render();
            };

            animate(0);
        } catch (error) {
            ErrorHandler.throw(
                ErrorType.RUNTIME,
                'Game loop failed',
                { error }
            );
        }
    }

    update() {
        if (this.state !== GAME_STATE.PLAYING) return;

        try {
            // Update game systems
            // This will be implemented as we move the systems from script.js
        } catch (error) {
            ErrorHandler.throw(
                ErrorType.RUNTIME,
                'Failed to update game state',
                { error }
            );
        }
    }

    render() {
        try {
            if (this.composer) {
                this.composer.render();
            } else {
                this.renderer.render(this.scene, this.camera);
            }
        } catch (error) {
            ErrorHandler.throw(
                ErrorType.RUNTIME,
                'Failed to render scene',
                { error }
            );
        }
    }
}

// Export a singleton instance
export const game = new Game(); 