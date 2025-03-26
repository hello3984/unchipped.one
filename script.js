// Debug log to verify script loading and changes
console.log('Script loaded with new changes - ' + new Date().toISOString());

// Immediately log that the script file is loading
console.log("Script.js loading...");

// Import Three.js and necessary modules
import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
// Import our bridge for connecting to global scope
import gameBridge from './bridge.js';

// Log that THREE was imported
console.log("THREE imported:", typeof THREE);

// Try importing each module separately with error handling
let EffectComposer, RenderPass, UnrealBloomPass;

try {
    // First try dynamic import
    Promise.all([
        import('three/addons/postprocessing/EffectComposer.js'),
        import('three/addons/postprocessing/RenderPass.js'),
        import('three/addons/postprocessing/UnrealBloomPass.js')
    ]).then(([effectComposerModule, renderPassModule, bloomPassModule]) => {
        console.log("All postprocessing modules loaded successfully");
        EffectComposer = effectComposerModule.EffectComposer;
        RenderPass = renderPassModule.RenderPass;
        UnrealBloomPass = bloomPassModule.UnrealBloomPass;
        
        // Initialize the game once imports are complete
            initGame();
    }).catch(error => {
        console.error("Error loading modules dynamically:", error);
        
        // Fallback to global scope if modules were loaded via script tags
        console.log("Trying fallback to global scope...");
        if (window.THREE) {
            EffectComposer = window.THREE.EffectComposer;
            RenderPass = window.THREE.RenderPass;
            UnrealBloomPass = window.THREE.UnrealBloomPass;
            
            if (EffectComposer && RenderPass && UnrealBloomPass) {
                console.log("Found postprocessing modules in global scope");
                initGame();
            } else {
                // Initialize without postprocessing
                console.warn("Postprocessing modules not available, initializing without effects");
                initGame();
            }
        } else {
            console.error("THREE not found in global scope");
            showLoadingError("THREE.js not found. Check your network connection and try again.");
        }
        });
} catch (error) {
    console.error("Critical error setting up module imports:", error);
    showLoadingError(`Critical error: ${error.message}`);
}

// Function to show loading error
function showLoadingError(message) {
    const errorDisplay = document.createElement('div');
    errorDisplay.style.position = 'fixed';
    errorDisplay.style.top = '0';
    errorDisplay.style.left = '0';
    errorDisplay.style.width = '100%';
    errorDisplay.style.height = '100%';
    errorDisplay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    errorDisplay.style.color = '#ff0000';
    errorDisplay.style.display = 'flex';
    errorDisplay.style.flexDirection = 'column';
    errorDisplay.style.justifyContent = 'center';
    errorDisplay.style.alignItems = 'center';
    errorDisplay.style.zIndex = '9999';
    errorDisplay.style.padding = '20px';
    errorDisplay.style.fontFamily = 'monospace';
    
    errorDisplay.innerHTML = `
        <h2>Error Loading Game</h2>
        <p>${message}</p>
        <p>Please refresh the page or check the console for more details.</p>
    `;
    
    document.body.appendChild(errorDisplay);
}

// Game variables
let scene, camera, renderer, ship;
let composer, bloomPass; // Added for post-processing
let score = 0;
let health = 100; // Player's health
let isTopDownView = false;
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false, moveUp = false, moveDown = false;
let velocity = new THREE.Vector3();
let dataFragments = [];
let buildings = [];
let drones = []; // Array to store drone objects
let projectiles = []; // Array to store active projectiles
let projectilePool = []; // Pool of reusable projectile objects
const PROJECTILE_POOL_SIZE = 30; // Maximum number of projectiles in the pool
const EXPLOSION_POOL_SIZE = 20; // Maximum number of explosion effects in the pool
const DRONE_POOL_SIZE = 20; // Maximum number of drones in the pool
let fireParticleTexture = null; // Texture for fire particles
let gameState = 'start'; // Possible values: 'start', 'playing', 'paused', 'gameover'
let lastDamageTime = 0; // To control damage frequency
let invincibleTime = 0; // Time of invincibility after taking damage
let debugMode = false; // Debug mode toggle
let stats = null; // Performance stats
let lastFrameTime = 0; // For FPS calculation
let deltaTime = 0; // Time between frames
let audioInitialized = false; // Flag to track if audio is initialized
let backgroundMusic = null; // Background music
let sounds = {}; // Object to store sound effects
let lastFireTime = 0; // Track when the last projectile was fired
let weaponCooldown = false; // Whether weapon is in cooldown
let controlPanelVisible = true; // Track if the control panel is visible
let explosionPool = []; // Pool of reusable explosion objects
let explosionParticleTexture = null; // Texture for explosion particles
let dronePool = []; // Pool of reusable drone objects
let scoreMultiplier = 1; // Score multiplier for quick collection
let lastFragmentCollectTime = 0; // Time of last fragment collection
const MULTIPLIER_DECAY_TIME = 3000; // Time before multiplier starts decreasing (3 seconds)
const MAX_MULTIPLIER = 5; // Maximum score multiplier

// Add city size constant
const CITY_SIZE = 500; // Size of the city area

// Add energy conduit width constant
const ENERGY_CONDUIT_WIDTH = 30; // Width of the energy conduit

// Add building count constant
const BUILDING_COUNT = 100; // Number of buildings in the cityscape

// Add data fragment count constant
const DATA_FRAGMENT_COUNT = 20; // Number of data fragments to collect in the game

// Add these variables near the top with other game variables
let floatingTextPool = []; // Pool of reusable floating text elements
const FLOATING_TEXT_POOL_SIZE = 10; // Maximum number of floating text elements

// Initialize the game - renamed from init() to initGame()
async function initGame() {
    try {
        console.log("Initializing game...");
        
        // Create scene
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x000033); // Dark blue background for night sky

        // Add stars to the sky
        createStars();
        
        // Create camera
        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        
        // Create renderer
        renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('game'), antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Softer shadows
        renderer.toneMapping = THREE.ACESFilmicToneMapping; // Better tone mapping
        renderer.toneMappingExposure = 1.2; // Slightly brighter
        
        // Set up post-processing with EffectComposer
        setupPostProcessing();
        
        // Add ambient light
        const ambientLight = new THREE.AmbientLight(0x333333);
        scene.add(ambientLight);
        
        // Add directional light (moonlight)
        const directionalLight = new THREE.DirectionalLight(0x6666ff, 0.5);
        directionalLight.position.set(0, 50, 0);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 1024;
        directionalLight.shadow.mapSize.height = 1024;
        directionalLight.shadow.camera.near = 10;
        directionalLight.shadow.camera.far = 200;
        directionalLight.shadow.camera.left = -100;
        directionalLight.shadow.camera.right = 100;
        directionalLight.shadow.camera.top = 100;
        directionalLight.shadow.camera.bottom = -100;
        scene.add(directionalLight);

        // Create game elements
        createGround();
        createCityscape();
        createTallBuildings(); // Add 10 additional tall buildings
        
        // Create the X-MACHINA hub
        await createXMachinaHub();
        
        // Load saved spaceship quality level or default to 1
        const savedQualityLevel = parseInt(localStorage.getItem('spaceshipQualityLevel') || '1', 10);
        createPlayerShip(savedQualityLevel);
        
        createDataFragments();
        createDrones();
        
        // Add accent lighting to the scene
        createAccentLights();
        
        // Add neon signs
        createNeonSigns();
        
        // Create UI elements - do this first, before setting up event listeners
        createHealthBar();
        createDebugPanel();
        createQuoteDisplay();
        
        // Initialize floating text pool for optimized text display
        initFloatingTextPool();
        
        // Set up event listeners - wrap in try/catch to prevent errors
        try {
            setupEventListeners();
            setupPerformanceDebugKeys(); // Add performance debug keys
        } catch (err) {
            console.error("Error setting up event listeners:", err);
            
            // Manual fallback for event listeners
            console.log("Using fallback method for event listeners");
            
            // Manually add event listeners to critical game controls
            const startButton = document.getElementById('start-button');
            if (startButton) {
                startButton.onclick = function() { 
                    console.log("Start button clicked");
                    setGameState('playing');
                };
            } else {
                console.warn("Start button not found");
            }
            
            const restartButton = document.getElementById('restart-button');
            if (restartButton) {
                restartButton.onclick = function() {
                    console.log("Restart button clicked");
                    restartGame();
                };
            } else {
                console.warn("Restart button not found");
            }
        }
        
        // Initialize projectile pool
        initProjectilePool();
        
        // Initialize explosion pool
        initExplosionPool();
        
        // Initialize drone pool
        initDronePool();
        
        // Initialize audio
        initAudio();
        
        // Set initial game state
        setGameState('start');
        
        // Start animation loop
        lastFrameTime = performance.now();
        animate();
        
        // Hide loading screen
        const loadingElement = document.getElementById('loading');
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
        
        console.log("Game initialization complete");
    } catch (error) {
        console.error("Game initialization failed:", error);
        const loadingElement = document.getElementById('loading');
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
        
        const errorDisplay = document.getElementById('error-display');
        if (errorDisplay) {
            errorDisplay.style.display = 'block';
            errorDisplay.innerHTML = `
                <h2>Error Initializing Game</h2>
                <p>${error.message}</p>
                <pre>${error.stack}</pre>
                <p>Try refreshing the page or check the console for more details.</p>
            `;
        }
    }
}

// Create stars in the night sky
function createStars() {
    const starsGeometry = new THREE.BufferGeometry();
    const starsCount = 2000;
    const positions = new Float32Array(starsCount * 3);
    const sizes = new Float32Array(starsCount);
    
    // Create star positions on a large sphere around the scene
    for (let i = 0; i < starsCount; i++) {
        // Random position on a sphere
        const theta = 2 * Math.PI * Math.random();
        const phi = Math.acos(2 * Math.random() - 1);
        const radius = 800 + Math.random() * 200; // Large radius to put stars far away
        
        const x = radius * Math.sin(phi) * Math.cos(theta);
        const y = radius * Math.sin(phi) * Math.sin(theta);
        const z = radius * Math.cos(phi);
        
        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;
        
        // Random star sizes (mostly small)
        sizes[i] = 0.5 + Math.random() * 1.5;
    }
    
    starsGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starsGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    
    // Create star material with custom shaders for better-looking stars
    const starsMaterial = new THREE.ShaderMaterial({
        uniforms: {
            color: { value: new THREE.Color(0xffffff) },
        },
        vertexShader: `
            attribute float size;
            void main() {
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                gl_PointSize = size * (300.0 / -mvPosition.z);
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            uniform vec3 color;
            void main() {
                // Create a circular point with soft edges
                float r = 0.5 * length(2.0 * gl_PointCoord - 1.0);
                float intensity = 1.0 - smoothstep(0.1, 1.0, r);
                if (intensity < 0.1) discard;
                gl_FragColor = vec4(color, intensity);
            }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    
    const stars = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(stars);
}

// Create ground plane with more reflective surface
function createGround() {
    const groundGeometry = new THREE.PlaneGeometry(CITY_SIZE * 2, CITY_SIZE * 2, 32, 32);
    const groundMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x111111, 
        roughness: 0.15, // Lower roughness for more reflection
        metalness: 0.9,  // Higher metalness for reflective surface
        emissive: 0x000033,
        emissiveIntensity: 0.2,
        envMapIntensity: 1.5 // Enhance environment reflections
    });
    
    // Add subtle grid lines to the ground
    const gridTexture = createGridTexture();
    groundMaterial.map = gridTexture;
    
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.5;
    ground.receiveShadow = true;
    scene.add(ground);
    
    // Create energy conduit through center of city
    createEnergyConductFloor();
}

// Create a grid texture for the ground
function createGridTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    
    // Fill with dark color
    ctx.fillStyle = '#111111';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw grid lines
    ctx.strokeStyle = '#0066aa';
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.3;
    
    // Draw major grid lines
    const majorGridSize = 64;
    ctx.beginPath();
    for (let i = 0; i <= canvas.width; i += majorGridSize) {
        ctx.moveTo(i, 0);
        ctx.lineTo(i, canvas.height);
        ctx.moveTo(0, i);
        ctx.lineTo(canvas.width, i);
    }
    ctx.stroke();
    
    // Draw minor grid lines
    ctx.globalAlpha = 0.1;
    ctx.beginPath();
    const minorGridSize = 16;
    for (let i = 0; i <= canvas.width; i += minorGridSize) {
        if (i % majorGridSize !== 0) { // Skip where major lines already exist
            ctx.moveTo(i, 0);
            ctx.lineTo(i, canvas.height);
            ctx.moveTo(0, i);
            ctx.lineTo(canvas.width, i);
        }
    }
    ctx.stroke();
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(20, 20); // Repeat the texture to cover the ground
    
    return texture;
}

// Create accent lights throughout the scene
function createAccentLights() {
    // Create an array of possible light positions
    const lightPositions = [];
    
    // Generate some random positions for lights near tall buildings
    for (const building of buildings) {
        if (building.height > 40) { // Only place lights near taller buildings
            // Position light near the top of the building
            lightPositions.push({
                x: building.x + (Math.random() * 20 - 10),
                y: building.height * 0.7 + Math.random() * 10,
                z: building.z + (Math.random() * 20 - 10),
                color: Math.random() > 0.5 ? 0x00ffff : 0x0088ff, // Cyan or blue
                intensity: 0.8 + Math.random() * 1.5
            });
        }
    }
    
    // Create lights from the positions (limit to 8 lights to avoid performance issues)
    const maxLights = Math.min(8, lightPositions.length);
    for (let i = 0; i < maxLights; i++) {
        const pos = lightPositions[i];
        
        // Create a point light
        const light = new THREE.PointLight(pos.color, pos.intensity, 80);
        light.position.set(pos.x, pos.y, pos.z);
        light.castShadow = true;
        light.shadow.bias = -0.001;
        light.shadow.mapSize.width = 512;
        light.shadow.mapSize.height = 512;
        scene.add(light);
        
        // Add a small glowing sphere at the light position
        const lightGeometry = new THREE.SphereGeometry(1, 16, 16);
        const lightMaterial = new THREE.MeshBasicMaterial({ 
            color: pos.color,
            transparent: true,
            opacity: 0.7
        });
        const lightMesh = new THREE.Mesh(lightGeometry, lightMaterial);
        lightMesh.position.copy(light.position);
        scene.add(lightMesh);
    }
}

// Create neon signs on some buildings
function createNeonSigns() {
    console.log("Creating neon signs...");
    
    // Skip this function if we don't have enough buildings
    if (!buildings || buildings.length === 0) {
        console.warn("No buildings found for neon signs");
        return;
    }
    
    // Neon sign texts - remove MATRIX as it will be used exclusively for one building
    const neonTexts = [
        "NEURAL", "DATA", "CYBER", "SYNC", "QUANTUM", 
        "NEXUS", "BINARY", "DIGITAL", "ECHO", "VOID",
        "AZURE", "PULSE", "NOVA", "FLUX", "SECTOR",
        "F.BAYRAKTAR" // Special signature added to the neon signs
    ];
    
    // Neon colors
    const neonColors = [
        0xff00ff, // Magenta
        0x00ffff, // Cyan
        0xff3366, // Pink
        0x33ccff, // Blue
        0xffff00  // Yellow
    ];
    
    // Only add signs to a few of the taller buildings (top 30%)
    const minHeight = 30; // Minimum height for a building to have a sign
    const tallBuildings = buildings.filter(building => building.height > minHeight);
    
    // Find the tallest building for the exclusive MATRIX sign
    const tallestBuilding = buildings.sort((a, b) => b.height - a.height)[0];
    
    // Create a special MATRIX sign in bright green on the tallest building
    // Use multiple faces for maximum visibility
    const matrixColor = 0x00ff00; // Bright green
    
    // Add the MATRIX sign to 2 faces of the tallest building
    try {
        createNeonSign(tallestBuilding.mesh, "MATRIX", matrixColor, 0); // North face
        createNeonSign(tallestBuilding.mesh, "MATRIX", matrixColor, 2); // South face
        
        // Add special glow effect
        addMatrixEffectToBuilding(tallestBuilding);
        
        console.log("Added exclusive MATRIX sign to tallest building: ", 
                    "height:", tallestBuilding.height, 
                    "position:", tallestBuilding.x, tallestBuilding.z);
    } catch (error) {
        console.error("Error creating MATRIX sign:", error);
    }
    
    // Find second tallest building and make it display F.BAYRAKTAR in a special cyan color
    const secondTallestBuilding = buildings.filter(b => b !== tallestBuilding)
        .sort((a, b) => b.height - a.height)[0];
    
    // Add F.BAYRAKTAR in bright cyan to the second tallest building on multiple faces
    try {
        const specialColor = 0x00ffff; // Bright cyan for F.BAYRAKTAR
        createNeonSign(secondTallestBuilding.mesh, "F.BAYRAKTAR", specialColor, 0); // North face
        createNeonSign(secondTallestBuilding.mesh, "F.BAYRAKTAR", specialColor, 2); // South face
        
        console.log("Added special F.BAYRAKTAR sign to second tallest building: ", 
                    "height:", secondTallestBuilding.height, 
                    "position:", secondTallestBuilding.x, secondTallestBuilding.z);
    } catch (error) {
        console.error("Error creating F.BAYRAKTAR sign:", error);
    }
    
    // Exclude the tallest building and second tallest from further sign placement
    // Filter out these buildings to avoid placing additional signs on them
    const otherTallBuildings = tallBuildings.filter(b => b !== tallestBuilding && b !== secondTallestBuilding);
    
    // Limit the number of neon signs to avoid performance issues
    const maxSigns = Math.min(8, otherTallBuildings.length);
    
    // Randomly select buildings for neon signs (excluding the special buildings)
    const selectedBuildings = otherTallBuildings
        .sort(() => 0.5 - Math.random()) // Shuffle array
        .slice(0, maxSigns);
    
    selectedBuildings.forEach(building => {
        // Pick a random text and color
        const text = neonTexts[Math.floor(Math.random() * neonTexts.length)];
        const color = neonColors[Math.floor(Math.random() * neonColors.length)];
        
        // Choose a random face (0-3 for N, E, S, W)
        const faceIndex = Math.floor(Math.random() * 4);
        
        try {
            createNeonSign(building.mesh, text, color, faceIndex);
        } catch (error) {
            console.error("Error creating neon sign:", error);
        }
    });
    
    console.log(`Created neon signs on ${selectedBuildings.length + 2} buildings (including special signs)`);
}

// Add a special matrix-style effect to the building with the MATRIX sign
function addMatrixEffectToBuilding(building) {
    // Create digital rain effect on the building
    const boundingBox = new THREE.Box3().setFromObject(building.mesh);
    const size = new THREE.Vector3();
    boundingBox.getSize(size);
    
    // Create a vertical grid of small, animated green lights
    const matrixGroup = new THREE.Group();
    
    // Number of light columns and rows 
    const columns = 20;
    const rows = 30;
    
    // Create light pattern
    for (let i = 0; i < columns; i++) {
        for (let j = 0; j < rows; j++) {
            // Only create some of the lights (sparse pattern)
            if (Math.random() > 0.2) continue;
            
            const lightGeometry = new THREE.BoxGeometry(0.25, 0.25, 0.25); // Slightly larger for better visibility
            const lightMaterial = new THREE.MeshStandardMaterial({
                color: 0x00ff00,
                emissive: 0x00ff00,
                emissiveIntensity: 2.5 * Math.random(), // Increased intensity
                transparent: true,
                opacity: 0.8 * Math.random() + 0.4 // Increased base opacity for better visibility
            });
            
            const light = new THREE.Mesh(lightGeometry, lightMaterial);
            
            // Position lights in a grid pattern on building face
            const x = (i / columns - 0.5) * size.x * 0.8;
            const y = (j / rows - 0.5) * size.y * 0.8;
            const z = size.z / 2 + 0.15; // Slightly further out for better visibility
            
            light.position.set(x, y, z);
            
            // Store original values for animation
            light.userData = {
                originalIntensity: lightMaterial.emissiveIntensity,
                originalY: y,
                speed: 0.05 + Math.random() * 0.1, // Keep original speed
                animationDelay: Math.random() * 2000 // Random start time
            };
            
            // Add a small point light to some of the matrix elements to enhance glow
            if (Math.random() > 0.8) {
                const pointLight = new THREE.PointLight(0x00ff00, 0.2, 2);
                pointLight.position.set(x, y, z + 0.1);
                matrixGroup.add(pointLight);
            }
            
            matrixGroup.add(light);
        }
    }
    
    // Add the matrix effect to the building mesh
    building.mesh.add(matrixGroup);
    
    // Animate the matrix effect
    function animateMatrixEffect() {
        matrixGroup.children.forEach(light => {
            if (light.type === "Mesh") {
                const time = performance.now() + light.userData.animationDelay;
                
                // Pulse intensity
                light.material.emissiveIntensity = 
                    light.userData.originalIntensity * (0.6 + 0.4 * Math.sin(time * 0.005));
                    
                // Digital rain effect - move lights down and reset
                light.position.y -= light.userData.speed;
                
                // Reset position when it goes too far down
                if (light.position.y < -size.y/2) {
                    light.position.y = size.y/2;
                }
            }
        });
        
        requestAnimationFrame(animateMatrixEffect);
    }
    
    animateMatrixEffect();
}

// Create neon sign on a building face
function createNeonSign(buildingMesh, text, color, faceIndex) {
    // Use the imported FontLoader instead of THREE.FontLoader
    const fontLoader = new FontLoader();
    
    // Load a font for the neon text
    fontLoader.load('https://threejs.org/examples/fonts/helvetiker_bold.typeface.json', function(font) {
        try {
            const textOptions = {
                font: font,
                size: 2, // Keep original size
                height: 0.3, // Slightly deeper for better visibility
                curveSegments: 16, // Increased for smoother curves
                bevelEnabled: true,
                bevelThickness: 0.15, // Increased for better definition
                bevelSize: 0.08, // Increased for better definition
                bevelOffset: 0,
                bevelSegments: 5 // Increased for smoother bevels
            };
            
            // Create text geometry
            const textGeometry = new TextGeometry(text, textOptions);
            textGeometry.center();
            
            // Create material for the neon text - enhanced properties
            const textMaterial = new THREE.MeshStandardMaterial({
                color: color,
                emissive: color,
                emissiveIntensity: 3.0, // Increased from 2.0 for better glow
                metalness: 0.1, // Reduced for less metallic look
                roughness: 0.05, // Smoother surface for better light emission
                transparent: true,
                opacity: 0.95 // Slight transparency for glow effect
            });
            
            // Create the text mesh
            const textMesh = new THREE.Mesh(textGeometry, textMaterial);
            
            // Get building dimensions based on its geometry
            const boundingBox = new THREE.Box3().setFromObject(buildingMesh);
            const size = new THREE.Vector3();
            boundingBox.getSize(size);
            
            // Position the text on the building face
            // Determine which face to place on (N, S, E, W)
            let position = new THREE.Vector3();
            let rotation = new THREE.Euler();
            
            // Calculate half dimensions for positioning
            const halfWidth = size.x / 2;
            const halfHeight = size.y / 2;
            const halfDepth = size.z / 2;
            
            // Position near the top of the building
            const posY = halfHeight - 4; 
            
            switch(faceIndex) {
                case 0: // North face
                    position.set(0, posY, halfDepth + 0.3); // Moved slightly further out
                    rotation.set(0, 0, 0);
                    break;
                case 1: // East face
                    position.set(halfWidth + 0.3, posY, 0); // Moved slightly further out
                    rotation.set(0, Math.PI / 2, 0);
                    break;
                case 2: // South face
                    position.set(0, posY, -halfDepth - 0.3); // Moved slightly further out
                    rotation.set(0, Math.PI, 0);
                    break;
                case 3: // West face
                    position.set(-halfWidth - 0.3, posY, 0); // Moved slightly further out
                    rotation.set(0, -Math.PI / 2, 0);
                    break;
            }
            
            textMesh.position.copy(position);
            textMesh.rotation.copy(rotation);
            
            // Add the text to the building mesh
            buildingMesh.add(textMesh);
            
            // Add an enhanced glow effect around the text
            // First inner glow layer (brighter, smaller)
            const innerGlowSize = 0.1;
            const innerGlowMaterial = new THREE.MeshBasicMaterial({
                color: color,
                transparent: true,
                opacity: 0.85,
                side: THREE.BackSide
            });
            
            const innerGlowGeometry = textGeometry.clone();
            const innerGlowMesh = new THREE.Mesh(innerGlowGeometry, innerGlowMaterial);
            innerGlowMesh.scale.set(1 + innerGlowSize, 1 + innerGlowSize, 1 + innerGlowSize);
            innerGlowMesh.position.copy(position);
            innerGlowMesh.rotation.copy(rotation);
            buildingMesh.add(innerGlowMesh);
            
            // Second outer glow layer (softer, larger)
            const outerGlowSize = 0.5;
            const outerGlowMaterial = new THREE.MeshBasicMaterial({
                color: color,
                transparent: true,
                opacity: 0.3,
                side: THREE.BackSide
            });
            
            const outerGlowGeometry = textGeometry.clone();
            const outerGlowMesh = new THREE.Mesh(outerGlowGeometry, outerGlowMaterial);
            outerGlowMesh.scale.set(1 + outerGlowSize, 1 + outerGlowSize, 1 + outerGlowSize);
            outerGlowMesh.position.copy(position);
            outerGlowMesh.rotation.copy(rotation);
            buildingMesh.add(outerGlowMesh);
            
            // Add a subtle outline for better definition
            const outlineMaterial = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.4,
                side: THREE.BackSide
            });
            
            const outlineGeometry = textGeometry.clone();
            const outlineMesh = new THREE.Mesh(outlineGeometry, outlineMaterial);
            outlineMesh.scale.set(1.03, 1.03, 1.03); // Just slightly larger than the text
            outlineMesh.position.copy(position);
            outlineMesh.rotation.copy(rotation);
            buildingMesh.add(outlineMesh);
            
        } catch (error) {
            console.error("Error creating neon sign:", error);
        }
    });
}

// Create line segments for simple letter shapes
function createLetterSegments(letter, size) {
    const h = size;
    const w = size * 0.6;
    const segments = [];
    
    switch (letter.toUpperCase()) {
        case 'A':
            segments.push({start: {x: -w/2, y: -h/2}, end: {x: 0, y: h/2}});
            segments.push({start: {x: 0, y: h/2}, end: {x: w/2, y: -h/2}});
            segments.push({start: {x: -w/3, y: 0}, end: {x: w/3, y: 0}});
            break;
        case 'C':
            segments.push({start: {x: w/2, y: h/2}, end: {x: -w/2, y: h/2}});
            segments.push({start: {x: -w/2, y: h/2}, end: {x: -w/2, y: -h/2}});
            segments.push({start: {x: -w/2, y: -h/2}, end: {x: w/2, y: -h/2}});
            break;
        case 'D':
            segments.push({start: {x: -w/2, y: h/2}, end: {x: -w/2, y: -h/2}});
            segments.push({start: {x: -w/2, y: h/2}, end: {x: w/3, y: h/2}});
            segments.push({start: {x: w/3, y: h/2}, end: {x: w/2, y: 0}});
            segments.push({start: {x: w/2, y: 0}, end: {x: w/3, y: -h/2}});
            segments.push({start: {x: w/3, y: -h/2}, end: {x: -w/2, y: -h/2}});
            break;
        case 'E':
            segments.push({start: {x: w/2, y: h/2}, end: {x: -w/2, y: h/2}});
            segments.push({start: {x: -w/2, y: h/2}, end: {x: -w/2, y: -h/2}});
            segments.push({start: {x: -w/2, y: -h/2}, end: {x: w/2, y: -h/2}});
            segments.push({start: {x: -w/2, y: 0}, end: {x: w/3, y: 0}});
            break;
        case 'F':
            segments.push({start: {x: w/2, y: h/2}, end: {x: -w/2, y: h/2}});
            segments.push({start: {x: -w/2, y: h/2}, end: {x: -w/2, y: -h/2}});
            segments.push({start: {x: -w/2, y: 0}, end: {x: w/3, y: 0}});
            break;
        case 'H':
            segments.push({start: {x: -w/2, y: h/2}, end: {x: -w/2, y: -h/2}});
            segments.push({start: {x: w/2, y: h/2}, end: {x: w/2, y: -h/2}});
            segments.push({start: {x: -w/2, y: 0}, end: {x: w/2, y: 0}});
            break;
        case 'L':
            segments.push({start: {x: -w/2, y: h/2}, end: {x: -w/2, y: -h/2}});
            segments.push({start: {x: -w/2, y: -h/2}, end: {x: w/2, y: -h/2}});
            break;
        case 'N':
            segments.push({start: {x: -w/2, y: -h/2}, end: {x: -w/2, y: h/2}});
            segments.push({start: {x: -w/2, y: h/2}, end: {x: w/2, y: -h/2}});
            segments.push({start: {x: w/2, y: -h/2}, end: {x: w/2, y: h/2}});
            break;
        case 'O':
        case '0':
            segments.push({start: {x: -w/2, y: h/2}, end: {x: w/2, y: h/2}});
            segments.push({start: {x: w/2, y: h/2}, end: {x: w/2, y: -h/2}});
            segments.push({start: {x: w/2, y: -h/2}, end: {x: -w/2, y: -h/2}});
            segments.push({start: {x: -w/2, y: -h/2}, end: {x: -w/2, y: h/2}});
            break;
        case 'P':
            segments.push({start: {x: -w/2, y: -h/2}, end: {x: -w/2, y: h/2}});
            segments.push({start: {x: -w/2, y: h/2}, end: {x: w/2, y: h/2}});
            segments.push({start: {x: w/2, y: h/2}, end: {x: w/2, y: 0}});
            segments.push({start: {x: w/2, y: 0}, end: {x: -w/2, y: 0}});
            break;
        case 'R':
            segments.push({start: {x: -w/2, y: -h/2}, end: {x: -w/2, y: h/2}});
            segments.push({start: {x: -w/2, y: h/2}, end: {x: w/2, y: h/2}});
            segments.push({start: {x: w/2, y: h/2}, end: {x: w/2, y: 0}});
            segments.push({start: {x: w/2, y: 0}, end: {x: -w/2, y: 0}});
            segments.push({start: {x: -w/2, y: 0}, end: {x: w/2, y: -h/2}});
            break;
        case 'S':
            segments.push({start: {x: w/2, y: h/2}, end: {x: -w/2, y: h/2}});
            segments.push({start: {x: -w/2, y: h/2}, end: {x: -w/2, y: 0}});
            segments.push({start: {x: -w/2, y: 0}, end: {x: w/2, y: 0}});
            segments.push({start: {x: w/2, y: 0}, end: {x: w/2, y: -h/2}});
            segments.push({start: {x: w/2, y: -h/2}, end: {x: -w/2, y: -h/2}});
            break;
        case 'T':
            segments.push({start: {x: -w/2, y: h/2}, end: {x: w/2, y: h/2}});
            segments.push({start: {x: 0, y: h/2}, end: {x: 0, y: -h/2}});
            break;
        case 'U':
            segments.push({start: {x: -w/2, y: h/2}, end: {x: -w/2, y: -h/2}});
            segments.push({start: {x: -w/2, y: -h/2}, end: {x: w/2, y: -h/2}});
            segments.push({start: {x: w/2, y: -h/2}, end: {x: w/2, y: h/2}});
            break;
        case 'X':
            segments.push({start: {x: -w/2, y: -h/2}, end: {x: w/2, y: h/2}});
            segments.push({start: {x: -w/2, y: h/2}, end: {x: w/2, y: -h/2}});
            break;
        case 'Y':
            segments.push({start: {x: -w/2, y: h/2}, end: {x: 0, y: 0}});
            segments.push({start: {x: w/2, y: h/2}, end: {x: 0, y: 0}});
            segments.push({start: {x: 0, y: 0}, end: {x: 0, y: -h/2}});
            break;
        case 'Z':
            segments.push({start: {x: -w/2, y: h/2}, end: {x: w/2, y: h/2}});
            segments.push({start: {x: w/2, y: h/2}, end: {x: -w/2, y: -h/2}});
            segments.push({start: {x: -w/2, y: -h/2}, end: {x: w/2, y: -h/2}});
            break;
        case '-':
            segments.push({start: {x: -w/2, y: 0}, end: {x: w/2, y: 0}});
            break;
        case '+':
            segments.push({start: {x: -w/2, y: 0}, end: {x: w/2, y: 0}});
            segments.push({start: {x: 0, y: -h/2}, end: {x: 0, y: h/2}});
            break;
        default: // Default to a vertical line for unhandled characters
            segments.push({start: {x: 0, y: -h/2}, end: {x: 0, y: h/2}});
            break;
    }
    
    return segments;
}

// Create cityscape with buildings
function createCityscape() {
    console.log("Starting to create cityscape. Building count target:", BUILDING_COUNT);
    buildings = []; // Ensure buildings array is empty before we start
    
    for (let i = 0; i < BUILDING_COUNT; i++) {
        // Random building size with more height variation
        const width = 5 + Math.random() * 15;
        const height = 10 + Math.random() * 90; // Increased max height for more variation
        const depth = 5 + Math.random() * 15;
        
        // Random position
        let x, z;
        let intersectsConduit = true;
        let intersectsBuilding = true;
        let attempts = 0;
        
        // Try to find a position that doesn't intersect with the energy conduit or other buildings
        while ((intersectsConduit || intersectsBuilding) && attempts < 50) {
            x = Math.random() * CITY_SIZE - CITY_SIZE/2;
            z = Math.random() * CITY_SIZE - CITY_SIZE/2;
            
            // Check if building intersects with the energy conduit corridors
            intersectsConduit = (
                // Check intersection with X-axis conduit
                (z > -ENERGY_CONDUIT_WIDTH/2 && z < ENERGY_CONDUIT_WIDTH/2 && 
                 x > -CITY_SIZE/2 && x < CITY_SIZE/2) ||
                // Check intersection with Z-axis conduit
                (x > -ENERGY_CONDUIT_WIDTH/2 && x < ENERGY_CONDUIT_WIDTH/2 && 
                 z > -CITY_SIZE/2 && z < CITY_SIZE/2)
            );
            
            // Also account for building width/depth (half dimensions from center point)
            if (!intersectsConduit) {
                const halfWidth = width / 2;
                const halfDepth = depth / 2;
                
                intersectsConduit = (
                    // X-axis conduit intersection with building boundaries
                    (z + halfDepth > -ENERGY_CONDUIT_WIDTH/2 && z - halfDepth < ENERGY_CONDUIT_WIDTH/2 &&
                     x > -CITY_SIZE/2 && x < CITY_SIZE/2) ||
                    // Z-axis conduit intersection with building boundaries  
                    (x + halfWidth > -ENERGY_CONDUIT_WIDTH/2 && x - halfWidth < ENERGY_CONDUIT_WIDTH/2 &&
                     z > -CITY_SIZE/2 && z < CITY_SIZE/2)
                );
            }
            
            // Check if building intersects with existing buildings
            intersectsBuilding = false;
            if (!intersectsConduit) {
                const halfWidth = width / 2;
                const halfDepth = depth / 2;
                
                for (const existingBuilding of buildings) {
                    const exHalfWidth = existingBuilding.width / 2;
                    const exHalfDepth = existingBuilding.depth / 2;
                    
                    // Check for intersection
                    if (
                        x + halfWidth > existingBuilding.x - exHalfWidth &&
                        x - halfWidth < existingBuilding.x + exHalfWidth &&
                        z + halfDepth > existingBuilding.z - exHalfDepth &&
                        z - halfDepth < existingBuilding.z + exHalfDepth
                    ) {
                        intersectsBuilding = true;
                        break;
                    }
                }
            }
            
            attempts++;
        }
        
        // If we couldn't find a non-intersecting position after max attempts, skip this building
        if (intersectsConduit || intersectsBuilding) {
            console.log("Couldn't place tall building without intersections after max attempts, skipping");
            continue;
        }
        
        // Create building geometry with a more interesting shape
        let buildingGroup = new THREE.Group();
        
        // Main building body
        const lowerHeight = height * 0.7; // 70% of total height
        const upperHeight = height * 0.3; // 30% of total height
        const upperWidth = width * 0.7; // 70% of lower width
        const upperDepth = depth * 0.7; // 70% of lower depth
        
        // Lower section
        const lowerGeometry = new THREE.BoxGeometry(width, lowerHeight, depth);
        
        // Choose a color (intense cyan to blue)
        const hue = 180 + Math.random() * 40; // 180-220 (cyan to blue)
        const saturation = 70 + Math.random() * 30; // 70-100%
        const lightness = 25 + Math.random() * 20; // 25-45%
        const color = new THREE.Color(`hsl(${hue}, ${saturation}%, ${lightness}%)`);
        
        // More striking building material for the iconic buildings
        const buildingMaterial = new THREE.MeshStandardMaterial({
            color: color,
            roughness: 0.05,  // Very smooth surface for glass
            metalness: 0.2, // More metallic sheen
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide
        });
        
        // Create window pattern material with brighter glow
        const windowsMaterial = new THREE.MeshStandardMaterial({
            color: new THREE.Color(`hsl(${hue}, ${saturation}%, ${lightness + 55}%)`),
            emissive: new THREE.Color(`hsl(${hue}, ${saturation}%, ${lightness + 55}%)`),
            emissiveIntensity: 1.5,
            roughness: 0.1,
            metalness: 0.1,
            transparent: true,
            opacity: 0.95
        });
        
        // Lower section
        const lowerSection = new THREE.Mesh(lowerGeometry, buildingMaterial);
        lowerSection.position.y = lowerHeight / 2;
        buildingGroup.add(lowerSection);
        
        // Upper section (setback design)
        const upperGeometry = new THREE.BoxGeometry(upperWidth, upperHeight, upperDepth);
        const upperSection = new THREE.Mesh(upperGeometry, buildingMaterial);
        upperSection.position.y = lowerHeight + upperHeight / 2;
        buildingGroup.add(upperSection);
        
        // Add window lights using planes on building faces
        addWindowsToBuilding(buildingGroup, width, lowerHeight, depth, windowsMaterial);
        addWindowsToBuilding(upperSection, upperWidth, upperHeight, upperDepth, windowsMaterial);
        
        // Add a special antenna or spire to the top of some buildings
        if (Math.random() > 0.3) {
            const antennaHeight = 10 + Math.random() * 20;
            const antennaGeometry = new THREE.CylinderGeometry(0.5, 0.5, antennaHeight, 8);
            const antennaMaterial = new THREE.MeshStandardMaterial({
                color: 0xcccccc,
                roughness: 0.3,
                metalness: 0.8
            });
            const antenna = new THREE.Mesh(antennaGeometry, antennaMaterial);
            antenna.position.y = lowerHeight + upperHeight + antennaHeight / 2;
            buildingGroup.add(antenna);
            
            // Add blinking light at the top
            const blinkLightGeometry = new THREE.SphereGeometry(1, 16, 16);
            const blinkLightMaterial = new THREE.MeshBasicMaterial({
                color: 0xff0000,
                emissive: 0xff0000,
                emissiveIntensity: 2
            });
            const blinkLight = new THREE.Mesh(blinkLightGeometry, blinkLightMaterial);
            blinkLight.position.y = lowerHeight + upperHeight + antennaHeight + 0.5;
            
            // Add blinking animation
            blinkLight.userData.blink = {
                intensity: 2,
                minIntensity: 0.1,
                maxIntensity: 2,
                speed: 0.5 + Math.random() * 1.5,
                increasing: false
            };
            
            buildingGroup.add(blinkLight);
        }
        
        // Position the building
        buildingGroup.position.set(x, 0, z);
        
        // Add slight random rotation for variety
        buildingGroup.rotation.y = Math.random() * Math.PI * 0.25;
        
        buildingGroup.castShadow = true;
        buildingGroup.receiveShadow = true;
        
        // Save building dimensions and position for collision detection
        buildings.push({
            mesh: buildingGroup,
            width: width,
            height: height,
            depth: depth,
            x: x,
            z: z,
            isTallBuilding: true
        });
        
        scene.add(buildingGroup);
    }
    
    console.log("Added tall buildings. Total building count:", buildings.length);
}

// Function to add window lights to buildings
function addWindowsToBuilding(buildingGroup, width, height, depth, windowsMaterial) {
    // Width of window panels
    const windowGridSizeX = 1 + Math.random() * 1.5;
    const windowGridSizeY = 1 + Math.random() * 1.5;
    
    // How many window panels on each side
    const windowsX = Math.floor(width / windowGridSizeX);
    const windowsY = Math.floor(height / windowGridSizeY);
    const windowsZ = Math.floor(depth / windowGridSizeX);
    
    // Offset from building edge
    const offsetX = (width - (windowsX * windowGridSizeX)) / 2;
    const offsetZ = (depth - (windowsZ * windowGridSizeX)) / 2;
    
    // Window size within grid
    const windowSizeX = windowGridSizeX * 0.6;
    const windowSizeY = windowGridSizeY * 0.6;
    
    // Create window material with random brightness patterns
    const windowGeometry = new THREE.PlaneGeometry(windowSizeX, windowSizeY);
    
    // Random pattern density (higher = fewer windows)
    const patternDensity = 0.3 + Math.random() * 0.4;
    
    // Front and back faces (Z-axis)
    for (let y = 0; y < windowsY; y++) {
        for (let x = 0; x < windowsX; x++) {
            // Random chance to create a window
            if (Math.random() > patternDensity) {
                // Front face window
                const frontWindow = new THREE.Mesh(windowGeometry, windowsMaterial.clone());
                frontWindow.position.set(
                    -width/2 + offsetX + x * windowGridSizeX + windowGridSizeX/2,
                    -height/2 + y * windowGridSizeY + windowGridSizeY/2,
                    depth/2 + 0.05
                );
                buildingGroup.add(frontWindow);
                
                // Randomly vary emissive intensity for each window
                frontWindow.material.emissiveIntensity = 0.2 + Math.random() * 1.0;
                
                // Back face window
                if (Math.random() > 0.3) { // Not every front window has a back window
                    const backWindow = new THREE.Mesh(windowGeometry, windowsMaterial.clone());
                    backWindow.position.set(
                        -width/2 + offsetX + x * windowGridSizeX + windowGridSizeX/2,
                        -height/2 + y * windowGridSizeY + windowGridSizeY/2,
                        -depth/2 - 0.05
                    );
                    backWindow.rotation.y = Math.PI;
                    buildingGroup.add(backWindow);
                    backWindow.material.emissiveIntensity = 0.2 + Math.random() * 1.0;
                }
            }
        }
    }
    
    // Left and right faces (X-axis)
    for (let y = 0; y < windowsY; y++) {
        for (let z = 0; z < windowsZ; z++) {
            if (Math.random() > patternDensity) {
                // Right face window
                const rightWindow = new THREE.Mesh(windowGeometry, windowsMaterial.clone());
                rightWindow.position.set(
                    width/2 + 0.05,
                    -height/2 + y * windowGridSizeY + windowGridSizeY/2,
                    -depth/2 + offsetZ + z * windowGridSizeX + windowGridSizeX/2
                );
                rightWindow.rotation.y = Math.PI / 2;
                buildingGroup.add(rightWindow);
                rightWindow.material.emissiveIntensity = 0.2 + Math.random() * 1.0;
                
                // Left face window
                if (Math.random() > 0.3) {
                    const leftWindow = new THREE.Mesh(windowGeometry, windowsMaterial.clone());
                    leftWindow.position.set(
                        -width/2 - 0.05,
                        -height/2 + y * windowGridSizeY + windowGridSizeY/2,
                        -depth/2 + offsetZ + z * windowGridSizeX + windowGridSizeX/2
                    );
                    leftWindow.rotation.y = -Math.PI / 2;
                    buildingGroup.add(leftWindow);
                    leftWindow.material.emissiveIntensity = 0.2 + Math.random() * 1.0;
                }
            }
        }
    }
}

// Create player ship
function createPlayerShip(qualityLevel = 3) {
    // Remove previous ship if it exists
    if (ship) {
        scene.remove(ship);
    }
    
    // Create texture loader
    const textureLoader = new THREE.TextureLoader();
    
    // Load improved textures for the ship - using more appropriate spaceship textures
    const panelTexture = textureLoader.load('https://threejs.org/examples/textures/carbon/Carbon_Normal.png');
    const normalMap = textureLoader.load('https://threejs.org/examples/textures/carbon/Carbon_Normal.png');
    const roughnessMap = textureLoader.load('https://threejs.org/examples/textures/carbon/Carbon_Displacement.png');
    const metallicMap = textureLoader.load('https://threejs.org/examples/textures/carbon/Carbon_Specular.png');
    const glowMap = textureLoader.load('https://threejs.org/examples/textures/emissive.jpg');
    
    // Apply texture settings
    panelTexture.wrapS = panelTexture.wrapT = THREE.RepeatWrapping;
    normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;
    roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
    metallicMap.wrapS = metallicMap.wrapT = THREE.RepeatWrapping;
    
    // Use higher repeat values for more detailed textures
    panelTexture.repeat.set(6, 6);
    normalMap.repeat.set(6, 6);
    roughnessMap.repeat.set(6, 6);
    metallicMap.repeat.set(6, 6);
    
    // Ship body - flying wing design inspired by B-2A stealth bomber
    const shipGeometry = new THREE.Group();
    
    // Main body - flying wing design
    let wingShape = new THREE.Shape();
    // Create a flying wing shape with curves and angles
    wingShape.moveTo(0, -2);                 // Center point at back
    wingShape.lineTo(-4, -1);                // Left rear corner
    wingShape.lineTo(-5, 1);                 // Left wing tip
    wingShape.bezierCurveTo(-4, 2, -2, 3, 0, 3);  // Front curve
    wingShape.bezierCurveTo(2, 3, 4, 2, 5, 1);    // Front right curve
    wingShape.lineTo(4, -1);                 // Right rear corner
    wingShape.lineTo(0, -2);                 // Back to center
    
    // Extrude the shape to create a 3D flying wing
    const wingExtrudeSettings = {
        steps: qualityLevel >= 2 ? 5 : 3,
        depth: 0.2,
        bevelEnabled: true,
        bevelThickness: 0.05,
        bevelSize: 0.1,
        bevelSegments: qualityLevel >= 2 ? 8 : 5
    };
    
    const mainWingGeometry = new THREE.ExtrudeGeometry(wingShape, wingExtrudeSettings);
    mainWingGeometry.rotateX(Math.PI / 2);
    
    // Scale UVs for better texture mapping
    const uvAttribute = mainWingGeometry.attributes.uv;
    if (uvAttribute) {
        for (let i = 0; i < uvAttribute.count; i++) {
            const u = uvAttribute.getX(i);
            const v = uvAttribute.getY(i);
            uvAttribute.setXY(i, u * 3, v * 3);
        }
    }
    
    // Create an enhanced material with textures
    const mainWingMaterial = new THREE.MeshStandardMaterial({
        color: 0x333345,  // Dark gray with slight blue tint
        roughness: 0.3,   // Smoother surface
        metalness: 0.9,   // More metallic look
        envMapIntensity: 2.5,
        flatShading: false,
        map: panelTexture,
        normalMap: normalMap,
        roughnessMap: roughnessMap,
        metalnessMap: metallicMap,
        normalScale: new THREE.Vector2(0.4, 0.4),
        emissive: 0x000033,
        emissiveIntensity: 0.15,
        emissiveMap: glowMap
    });
    
    // Create environment map for reflections
    const cubeTextureLoader = new THREE.CubeTextureLoader();
    const path = 'https://threejs.org/examples/textures/cube/Park3Med/';
    const format = '.jpg';
    const urls = [
        path + 'px' + format, path + 'nx' + format,
        path + 'py' + format, path + 'ny' + format,
        path + 'pz' + format, path + 'nz' + format
    ];
    
    const reflectionCube = cubeTextureLoader.load(urls);
    reflectionCube.encoding = THREE.sRGBEncoding;
    
    // Apply to material
    mainWingMaterial.envMap = reflectionCube;
    mainWingMaterial.envMapIntensity = 1.5;
    mainWingMaterial.needsUpdate = true;
    
    const mainWing = new THREE.Mesh(mainWingGeometry, mainWingMaterial);
    mainWing.castShadow = true;
    mainWing.receiveShadow = true;
    mainWing.shadowSide = THREE.FrontSide;
    
    shipGeometry.add(mainWing);
    
    // Add surface panel details with more sophisticated details
    if (qualityLevel >= 2) {
        // Create panel lines on the surface
        const addPanelLine = (fromX, fromY, toX, toY, width = 0.03, height = 0.015) => {
            const length = Math.sqrt(Math.pow(toX-fromX, 2) + Math.pow(toY-fromY, 2));
            const panelGeometry = new THREE.BoxGeometry(length, height, width);
            const panelMaterial = new THREE.MeshStandardMaterial({
                color: 0x222230,
                roughness: 0.6,
                metalness: 0.7,
                envMap: reflectionCube,
                envMapIntensity: 1.0
            });
            
            const panel = new THREE.Mesh(panelGeometry, panelMaterial);
            panel.position.set((fromX + toX) / 2, 0.11, -(fromY + toY) / 2);
            const angle = Math.atan2(toY - fromY, toX - fromX);
            panel.rotation.y = -angle;
            shipGeometry.add(panel);
        };
        
        // Add stealth panels and surface details - more detailed pattern
        addPanelLine(-4, -1, -3, 0);
        addPanelLine(-3, 0, -2, 1);
        addPanelLine(-2, 1, -1, 2);
        addPanelLine(-1, 2, 0, 3);
        addPanelLine(0, 3, 1, 2);
        addPanelLine(1, 2, 2, 1);
        addPanelLine(2, 1, 3, 0);
        addPanelLine(3, 0, 4, -1);
        
        // Add diagonal panel lines
        addPanelLine(-3, 0, -1, -1);
        addPanelLine(-1, -1, 1, -1);
        addPanelLine(1, -1, 3, 0);
        
        // Add center line
        addPanelLine(0, -2, 0, 3, 0.05, 0.015);
        
        // Add more cross-section panel lines
        addPanelLine(-3.5, 0, 3.5, 0, 0.03, 0.015);
        addPanelLine(-2.5, -0.5, 2.5, -0.5, 0.03, 0.015);
        addPanelLine(-2, 1.5, 2, 1.5, 0.03, 0.015);
        
        // Add asymmetrical panel details for visual interest
        addPanelLine(-3, -0.5, -2, 0.5, 0.02, 0.01);
        addPanelLine(3, -0.5, 2, 0.5, 0.02, 0.01);
        addPanelLine(-1, 2, -2, 1.5, 0.02, 0.01);
        addPanelLine(1, 2, 2, 1.5, 0.02, 0.01);
    }
    
    // Add subtle edge glow with better effects
    const edgeGlowMaterial = new THREE.MeshBasicMaterial({
        color: 0x3b83bd,
        transparent: true,
        opacity: 0.2,
        side: THREE.BackSide
    });
    
    const edgeGlowGeometry = new THREE.ExtrudeGeometry(wingShape, {
        ...wingExtrudeSettings,
        depth: 0.3,
        bevelSize: 0.18
    });
    edgeGlowGeometry.rotateX(Math.PI / 2);
    
    const edgeGlow = new THREE.Mesh(edgeGlowGeometry, edgeGlowMaterial);
    shipGeometry.add(edgeGlow);
    
    // Add a second, inner glow for a more sophisticated effect
    const innerGlowMaterial = new THREE.MeshBasicMaterial({
        color: 0x00aaff,
        transparent: true,
        opacity: 0.1,
        side: THREE.BackSide
    });
    
    const innerGlowGeometry = new THREE.ExtrudeGeometry(wingShape, {
        ...wingExtrudeSettings,
        depth: 0.25,
        bevelSize: 0.15
    });
    innerGlowGeometry.rotateX(Math.PI / 2);
    
    const innerGlow = new THREE.Mesh(innerGlowGeometry, innerGlowMaterial);
    shipGeometry.add(innerGlow);
    
    // Add cockpit/canopy with more detail
    const canopyGroup = new THREE.Group();
    
    // Main canopy glass
    const canopyGeometry = new THREE.SphereGeometry(0.7, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const canopyMaterial = new THREE.MeshPhysicalMaterial({
        color: 0x8888ff,
        metalness: 0.1,
        roughness: 0.1,
        transmission: 0.95, // Glass-like transparency
        transparent: true,
        envMap: reflectionCube,
        envMapIntensity: 2.0,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1
    });
    
    const canopy = new THREE.Mesh(canopyGeometry, canopyMaterial);
    canopy.scale.set(1, 0.5, 1.5);
    canopy.position.set(0, 0.3, 1);
    canopyGroup.add(canopy);
    
    // Canopy frame
    const addCanopyFrame = (radius, theta1, theta2, y) => {
        const frameGeometry = new THREE.TorusGeometry(radius, 0.03, 8, 12, Math.PI);
        const frameMaterial = new THREE.MeshStandardMaterial({
            color: 0x333345,
            roughness: 0.4,
            metalness: 0.9,
            envMap: reflectionCube
        });
        
        const frame = new THREE.Mesh(frameGeometry, frameMaterial);
        frame.position.set(0, y, 1);
        frame.rotation.x = Math.PI / 2;
        frame.rotation.y = Math.PI;
        canopyGroup.add(frame);
    };
    
    // Add multiple canopy frames
    addCanopyFrame(0.7, 0, Math.PI, 0.3);
    addCanopyFrame(0.5, 0, Math.PI, 0.3);
    
    // Add canopy frame vertical lines
    const addCanopyLine = (x, z) => {
        const lineGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.5, 8);
        const lineMaterial = new THREE.MeshStandardMaterial({
            color: 0x333345,
            roughness: 0.4,
            metalness: 0.9,
            envMap: reflectionCube
        });
        
        const line = new THREE.Mesh(lineGeometry, lineMaterial);
        line.position.set(x, 0.05, z);
        line.rotation.x = Math.PI / 2.5;
        canopyGroup.add(line);
    };
    
    // Add vertical frame lines
    addCanopyLine(0, 1);
    addCanopyLine(-0.35, 1);
    addCanopyLine(0.35, 1);
    
    shipGeometry.add(canopyGroup);
    
    // Engine intake details with improved appearance
    const addEngineIntake = (posX, posZ) => {
        const intakeGeometry = new THREE.BoxGeometry(1.0, 0.1, 0.5);
        intakeGeometry.translate(0, 0, 0.25);
        
        const intakeMaterial = new THREE.MeshStandardMaterial({
            color: 0x222233,
            roughness: 0.7,
            metalness: 0.8,
            envMap: reflectionCube,
            normalMap: normalMap,
            normalScale: new THREE.Vector2(0.5, 0.5)
        });
        
        const intake = new THREE.Mesh(intakeGeometry, intakeMaterial);
        intake.position.set(posX, 0.1, posZ);
        intake.rotation.y = Math.PI / 2;
        intake.castShadow = true;
        intake.receiveShadow = true;
        shipGeometry.add(intake);
        
        // Add intake grill with more detailed geometry
        const grillGeometry = new THREE.BoxGeometry(0.9, 0.05, 0.05);
        const grillMaterial = new THREE.MeshStandardMaterial({
            color: 0x222233,
            roughness: 0.6,
            metalness: 0.8,
            envMap: reflectionCube
        });
        
        // Add multiple grill bars
        for (let i = 0; i < 5; i++) {
            const grill = new THREE.Mesh(grillGeometry, grillMaterial);
            grill.position.set(posX, 0.1, posZ + 0.2 - i * 0.1);
            grill.rotation.y = Math.PI / 2;
            shipGeometry.add(grill);
        }
    };
    
    // Add engine intakes at multiple positions
    addEngineIntake(-2.5, -1.2);
    addEngineIntake(2.5, -1.2);
    
    // Add more detail with an additional canopy line
    addCanopyLine(0.2, 1);
    
    // Add simple cockpit for low quality if needed
    if (qualityLevel < 2) {
        // Simple cockpit for low quality
        const cockpitGeometry = new THREE.BoxGeometry(0.4, 0.1, 0.6);
        const cockpitMaterial = new THREE.MeshStandardMaterial({
            color: 0x222222,
            roughness: 0.2,
            metalness: 0.1,
            transparent: true,
            opacity: 0.9
        });
        
        const cockpit = new THREE.Mesh(cockpitGeometry, cockpitMaterial);
        cockpit.position.set(0, 0.2, 1);
        cockpit.castShadow = true;
        cockpit.receiveShadow = true;
        shipGeometry.add(cockpit);
    }
    
    // Ship container
    ship = new THREE.Object3D();
    ship.add(shipGeometry);
    
    // Add glowing engine effects
    const addEngineGlow = (posX, posZ) => {
        // Engine exhaust glow outer
        const glowGeometry = new THREE.CircleGeometry(0.3, 16);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0x00aaff,
            transparent: true,
            opacity: 0.7,
            side: THREE.DoubleSide
        });
        
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        glow.position.set(posX, 0.1, posZ - 0.3);
        glow.rotation.y = Math.PI / 2;
        shipGeometry.add(glow);
        
        // Engine exhaust glow inner (brighter core)
        const coreGeometry = new THREE.CircleGeometry(0.15, 16);
        const coreMaterial = new THREE.MeshBasicMaterial({
            color: 0xaaffff,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide
        });
        
        const core = new THREE.Mesh(coreGeometry, coreMaterial);
        core.position.set(posX, 0.1, posZ - 0.29);
        core.rotation.y = Math.PI / 2;
        shipGeometry.add(core);
        
        // Add volumetric effect with particle system
        const particleGeometry = new THREE.BufferGeometry();
        const particleCount = 20;
        const particlePositions = new Float32Array(particleCount * 3);
        const particleSizes = new Float32Array(particleCount);
        
        for (let i = 0; i < particleCount; i++) {
            // Position particles in a cone shape behind the engine
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * 0.2;
            const depth = Math.random() * 0.6;
            
            particlePositions[i * 3] = posX;
            particlePositions[i * 3 + 1] = 0.1 + (Math.random() * 0.05 - 0.025);
            particlePositions[i * 3 + 2] = posZ - 0.3 - depth;
            
            particleSizes[i] = 0.1 + Math.random() * 0.15;
        }
        
        particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
        particleGeometry.setAttribute('size', new THREE.BufferAttribute(particleSizes, 1));
        
        const particleMaterial = new THREE.ShaderMaterial({
            uniforms: {
                color: { value: new THREE.Color(0x00aaff) },
            },
            vertexShader: "attribute float size; void main() { vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * (300.0 / -mvPosition.z); gl_Position = projectionMatrix * mvPosition; }",
            fragmentShader: "uniform vec3 color; void main() { float r = length(2.0 * gl_PointCoord - 1.0); float a = 1.0 - smoothstep(0.5, 1.0, r); gl_FragColor = vec4(color, a); }",
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        
        const particles = new THREE.Points(particleGeometry, particleMaterial);
        shipGeometry.add(particles);
    };
    
    // Add engine glows at multiple positions
    addEngineGlow(-2.5, -1.5);
    addEngineGlow(2.5, -1.5);
    if (qualityLevel >= 3) {
        addEngineGlow(-1.5, -1.8);
        addEngineGlow(1.5, -1.8);
    }
    
    // Scale the ship to make it 2x smaller
    ship.scale.set(0.5, 0.5, 0.5);
    
    // Enhanced lighting for better visibility and quality rendering
    // Main ship light
    const shipLight = new THREE.PointLight(0x3498db, 0.8, 8);
    shipLight.position.set(0, 0.5, 0);
    ship.add(shipLight);
    
    // Add subtle ambient light attached to ship for better overall illumination
    const shipAmbientLight = new THREE.PointLight(0xffffff, 0.2, 5);
    shipAmbientLight.position.set(0, 1, 0);
    ship.add(shipAmbientLight);
    
    // Add subtle rim highlighting light for 3D definition
    if (qualityLevel >= 2) {
        const rimLight = new THREE.DirectionalLight(0x3498db, 0.3);
        rimLight.position.set(0, 2, -3);
        rimLight.target = shipGeometry;
        ship.add(rimLight);
    }
    
    ship.position.set(0, 10, 0);
    ship.rotation.y = Math.PI;
    scene.add(ship);
    
    // Set initial camera position
    updateCameraPosition();
    
    console.log(`Spaceship created with quality level: ${qualityLevel}`);
    return ship;
}

// Create data fragments
function createDataFragments() {
    for (let i = 0; i < DATA_FRAGMENT_COUNT; i++) {
        // Generate random position
        let x, y, z;
        let isColliding;
        
        do {
            isColliding = false;
            x = Math.random() * CITY_SIZE - CITY_SIZE/2;
            y = 5 + Math.random() * 40;
            z = Math.random() * CITY_SIZE - CITY_SIZE/2;
            
            // Check collision with buildings
            for (const building of buildings) {
                const halfWidth = building.width / 2;
                const halfDepth = building.depth / 2;
                
                if (x > building.x - halfWidth && x < building.x + halfWidth &&
                    y < building.height &&
                    z > building.z - halfDepth && z < building.z + halfDepth) {
                    isColliding = true;
                    break;
                }
            }
        } while (isColliding);
        
        // Create data fragment
        const fragmentGeometry = new THREE.SphereGeometry(0.5, 16, 16);
        const fragmentMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.8
        });
        const fragment = new THREE.Mesh(fragmentGeometry, fragmentMaterial);
        fragment.position.set(x, y, z);
        
        // Add to scene and array
        scene.add(fragment);
        dataFragments.push({
            mesh: fragment,
            x: x,
            y: y,
            z: z
        });
    }
}

// Create health bar UI
function createHealthBar() {
    // ===== HEALTH SYSTEM UI =====
    const healthContainer = document.createElement('div');
    healthContainer.id = 'health-container';
    healthContainer.style.position = 'fixed';
    healthContainer.style.top = '20px';
    healthContainer.style.left = '20px';
    healthContainer.style.width = '220px';
    healthContainer.style.height = '30px';
    healthContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    healthContainer.style.border = '2px solid #0ff';
    healthContainer.style.boxShadow = '0 0 10px #0ff, inset 0 0 5px rgba(0, 255, 255, 0.5)';
    healthContainer.style.zIndex = '10';
    healthContainer.style.padding = '3px';
    healthContainer.style.display = 'flex';
    healthContainer.style.flexDirection = 'column';
    
    // Add health label with cyberpunk styling
    const healthLabel = document.createElement('div');
    healthLabel.style.color = '#0ff';
    healthLabel.style.fontFamily = 'monospace, "Courier New", Courier';
    healthLabel.style.fontSize = '10px';
    healthLabel.style.letterSpacing = '1px';
    healthLabel.style.textShadow = '0 0 5px #0ff';
    healthLabel.style.marginBottom = '2px';
    healthLabel.style.fontWeight = 'bold';
    healthLabel.textContent = 'SYS.INTEGRITY:';
    
    // Create health bar wrapper for better styling
    const healthBarWrapper = document.createElement('div');
    healthBarWrapper.style.position = 'relative';
    healthBarWrapper.style.width = '100%';
    healthBarWrapper.style.height = '16px';
    healthBarWrapper.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    healthBarWrapper.style.border = '1px solid rgba(0, 255, 255, 0.5)';
    healthBarWrapper.style.overflow = 'hidden';
    
    // Add tech pattern to health bar background
    healthBarWrapper.style.backgroundImage = 'linear-gradient(90deg, transparent 50%, rgba(0, 255, 255, 0.1) 50%)';
    healthBarWrapper.style.backgroundSize = '4px 100%';
    
    const healthBar = document.createElement('div');
    healthBar.id = 'health-bar';
    healthBar.style.width = '100%';
    healthBar.style.height = '100%';
    healthBar.style.background = 'linear-gradient(90deg, #00ff66, #66ffcc)';
    healthBar.style.boxShadow = 'inset 0 0 10px rgba(0, 255, 200, 0.8)';
    healthBar.style.transition = 'width 0.3s ease-out, background 0.5s';
    
    // Add health value display
    const healthValue = document.createElement('div');
    healthValue.id = 'health-value';
    healthValue.style.position = 'absolute';
    healthValue.style.top = '0';
    healthValue.style.right = '5px';
    healthValue.style.height = '100%';
    healthValue.style.display = 'flex';
    healthValue.style.alignItems = 'center';
    healthValue.style.color = '#fff';
    healthValue.style.fontFamily = 'monospace, "Courier New", Courier';
    healthValue.style.fontSize = '12px';
    healthValue.style.fontWeight = 'bold';
    healthValue.style.textShadow = '0 0 3px #000, 0 0 5px #000';
    healthValue.textContent = '100%';
    
    healthBarWrapper.appendChild(healthBar);
    healthBarWrapper.appendChild(healthValue);
    healthContainer.appendChild(healthLabel);
    healthContainer.appendChild(healthBarWrapper);
    document.body.appendChild(healthContainer);
    
    // ===== WEAPON SYSTEM UI =====
    const cooldownContainer = document.createElement('div');
    cooldownContainer.id = 'cooldown-container';
    cooldownContainer.style.position = 'fixed';
    cooldownContainer.style.top = '70px';
    cooldownContainer.style.left = '20px';
    cooldownContainer.style.width = '220px';
    cooldownContainer.style.height = '30px';
    cooldownContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    cooldownContainer.style.border = '2px solid #ff3366';
    cooldownContainer.style.boxShadow = '0 0 10px #f36, inset 0 0 5px rgba(255, 51, 102, 0.5)';
    cooldownContainer.style.zIndex = '10';
    cooldownContainer.style.padding = '3px';
    cooldownContainer.style.display = 'flex';
    cooldownContainer.style.flexDirection = 'column';
    
    // Add cooldown label with cyberpunk styling
    const cooldownLabel = document.createElement('div');
    cooldownLabel.style.color = '#ff3366';
    cooldownLabel.style.fontFamily = 'monospace, "Courier New", Courier';
    cooldownLabel.style.fontSize = '10px';
    cooldownLabel.style.letterSpacing = '1px';
    cooldownLabel.style.textShadow = '0 0 5px #ff3366';
    cooldownLabel.style.marginBottom = '2px';
    cooldownLabel.style.fontWeight = 'bold';
    cooldownLabel.textContent = 'WEAPON.STATUS:';
    
    // Create cooldown bar wrapper for better styling
    const cooldownBarWrapper = document.createElement('div');
    cooldownBarWrapper.style.position = 'relative';
    cooldownBarWrapper.style.width = '100%';
    cooldownBarWrapper.style.height = '16px';
    cooldownBarWrapper.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    cooldownBarWrapper.style.border = '1px solid rgba(255, 51, 102, 0.5)';
    cooldownBarWrapper.style.overflow = 'hidden';
    
    // Add tech pattern to cooldown bar background
    cooldownBarWrapper.style.backgroundImage = 'linear-gradient(90deg, transparent 50%, rgba(255, 51, 102, 0.1) 50%)';
    cooldownBarWrapper.style.backgroundSize = '4px 100%';
    
    const cooldownBar = document.createElement('div');
    cooldownBar.id = 'cooldown-bar';
    cooldownBar.style.width = '100%';
    cooldownBar.style.height = '100%';
    cooldownBar.style.background = 'linear-gradient(90deg, #ff3366, #ff6699)';
    cooldownBar.style.boxShadow = 'inset 0 0 10px rgba(255, 51, 102, 0.8)';
    cooldownBar.style.transition = 'width 0.1s linear';
    
    const cooldownText = document.createElement('div');
    cooldownText.id = 'cooldown-text';
    cooldownText.style.position = 'absolute';
    cooldownText.style.top = '0';
    cooldownText.style.left = '0';
    cooldownText.style.width = '100%';
    cooldownText.style.height = '100%';
    cooldownText.style.display = 'flex';
    cooldownText.style.alignItems = 'center';
    cooldownText.style.justifyContent = 'center';
    cooldownText.style.color = '#3f3';
    cooldownText.style.textShadow = '0 0 5px #0f0';
    cooldownText.style.fontFamily = 'monospace, "Courier New", Courier';
    cooldownText.style.fontSize = '12px';
    cooldownText.style.fontWeight = 'bold';
    cooldownText.textContent = 'READY';
    
    cooldownBarWrapper.appendChild(cooldownBar);
    cooldownBarWrapper.appendChild(cooldownText);
    cooldownContainer.appendChild(cooldownLabel);
    cooldownContainer.appendChild(cooldownBarWrapper);
    document.body.appendChild(cooldownContainer);
}

// Create debug panel
function createDebugPanel() {
    const debugPanel = document.createElement('div');
    debugPanel.id = 'debug-panel';
    debugPanel.style.position = 'fixed';
    debugPanel.style.top = '50px';
    debugPanel.style.right = '10px';
    debugPanel.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    debugPanel.style.color = '#0f0';
    debugPanel.style.padding = '10px';
    debugPanel.style.fontFamily = 'monospace';
    debugPanel.style.fontSize = '12px';
    debugPanel.style.width = '250px';
    debugPanel.style.maxHeight = '400px';
    debugPanel.style.overflowY = 'auto';
    debugPanel.style.border = '1px solid #0f0';
    debugPanel.style.display = 'none'; // Hidden by default
    
    // Add test spaceship quality button
    const testSpaceshipButton = document.createElement('button');
    testSpaceshipButton.textContent = 'Test Spaceship Quality';
    testSpaceshipButton.style.backgroundColor = '#0f0';
    testSpaceshipButton.style.color = '#000';
    testSpaceshipButton.style.border = 'none';
    testSpaceshipButton.style.padding = '5px';
    testSpaceshipButton.style.marginTop = '10px';
    testSpaceshipButton.style.width = '100%';
    testSpaceshipButton.style.cursor = 'pointer';
    
    testSpaceshipButton.addEventListener('click', function() {
        testSpaceshipQuality();
    });
    
    debugPanel.appendChild(testSpaceshipButton);
    document.body.appendChild(debugPanel);
}

// Update debug panel information
function updateDebugPanel() {
    if (!debugMode) return;
    
    const panel = document.getElementById('debug-panel');
    
    // Calculate FPS
    const fps = Math.round(1000 / deltaTime);
    
    // Gather debug information
    const debugInfo = {
        'FPS': fps,
        'Ship Position': `X: ${ship.position.x.toFixed(2)}, Y: ${ship.position.y.toFixed(2)}, Z: ${ship.position.z.toFixed(2)}`,
        'Ship Rotation': `${(ship.rotation.y * (180/Math.PI)).toFixed(2)}°`,
        'Active Drones': drones.length,
        'Pursuing Drones': drones.filter(d => d.isPursuing).length,
        'Projectiles': projectiles.length,
        'Data Fragments': dataFragments.length,
        'Health': health,
        'Score': score,
        'Game State': gameState,
        'Camera View': isTopDownView ? 'Top-Down' : 'Side View',
        'Memory': `${Math.round(performance.memory ? performance.memory.usedJSHeapSize / (1024 * 1024) : 0)} MB`
    };
    
    // Format and display debug information
    let debugHtml = '';
    for (const [key, value] of Object.entries(debugInfo)) {
        debugHtml += `<div><strong>${key}:</strong> ${value}</div>`;
    }
    
    panel.innerHTML = debugHtml;
}

// Create quote display for data fragments
function createQuoteDisplay() {
    const quoteContainer = document.createElement('div');
    quoteContainer.id = 'quote-container';
    quoteContainer.style.position = 'fixed';
    quoteContainer.style.bottom = '60px';
    quoteContainer.style.left = '0';
    quoteContainer.style.width = '100%';
    quoteContainer.style.textAlign = 'center';
    quoteContainer.style.color = '#0ff';
    quoteContainer.style.fontFamily = 'Arial, sans-serif';
    quoteContainer.style.fontSize = '18px';
    quoteContainer.style.fontStyle = 'italic';
    quoteContainer.style.textShadow = '0 0 5px #0ff';
    quoteContainer.style.zIndex = '50';
    quoteContainer.style.opacity = '0';
    quoteContainer.style.transition = 'opacity 0.5s ease-in-out';
    
    document.body.appendChild(quoteContainer);
}

// Show a random quote when collecting a data fragment
function showQuote() {
    const quote = DATA_QUOTES[Math.floor(Math.random() * DATA_QUOTES.length)];
    const quoteContainer = document.getElementById('quote-container');
    
    quoteContainer.textContent = `"${quote}"`;
    quoteContainer.style.opacity = '1';
    
    // Fade out after a few seconds
    setTimeout(() => {
        quoteContainer.style.opacity = '0';
    }, 5000);
}

// Initialize audio
function initAudio() {
    // Only initialize once
    if (audioInitialized) return;
    
    try {
        // Create audio context
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const audioContext = new AudioContext();
        
        // Background music
        backgroundMusic = new Audio('https://cdn.freesound.org/previews/648/648256_14313460-lq.mp3');
        backgroundMusic.loop = true;
        backgroundMusic.volume = 0.3;
        
        // Sound effects
        sounds = {
            collect: new Audio('https://cdn.freesound.org/previews/369/369952_6687899-lq.mp3'),
            damage: new Audio('https://cdn.freesound.org/previews/331/331912_5123851-lq.mp3'),
            gameOver: new Audio('https://cdn.freesound.org/previews/442/442825_6142149-lq.mp3'),
            drone: new Audio('https://cdn.freesound.org/previews/514/514072_10988976-lq.mp3'),
            fire: new Audio('https://cdn.freesound.org/previews/369/369952_6687899-lq.mp3'),
            explosion: new Audio('https://cdn.freesound.org/previews/442/442825_6142149-lq.mp3'),
            ui: new Audio('https://cdn.freesound.org/previews/521/521973_7715536-lq.mp3') // UI interaction sound
        };
        
        // Set volume for sound effects
        for (const sound in sounds) {
            sounds[sound].volume = 0.5;
        }
        
        // Adjust specific sound volumes
        if (sounds.ui) {
            sounds.ui.volume = 0.3; // Lower volume for UI sounds
        }
        
        audioInitialized = true;
    } catch (e) {
        console.error("Audio initialization failed:", e);
    }
}

// Play a sound effect
function playSound(soundName) {
    if (!audioInitialized || !sounds[soundName]) return;
    
    // Clone the sound to allow overlapping playback
    const sound = sounds[soundName].cloneNode();
    sound.volume = sounds[soundName].volume;
    sound.play().catch(e => console.error("Sound playback failed:", e));
}

// Control background music based on game state
function updateBackgroundMusic() {
    if (!audioInitialized || !backgroundMusic) return;
    
    if (gameState === 'playing') {
        // Start or resume background music
        if (backgroundMusic.paused) {
            backgroundMusic.play().catch(e => console.warn("Music playback failed:", e));
        }
    } else {
        // Pause background music
        if (!backgroundMusic.paused) {
            backgroundMusic.pause();
        }
    }
}

// Set the game state and update the UI
function setGameState(state) {
    gameState = state;
    
    // Hide all screens
    document.querySelectorAll('.game-screen').forEach(screen => {
        screen.style.display = 'none';
    });
    
    // Get UI elements
    const startScreen = document.getElementById('start-screen');
    const gameOverScreen = document.getElementById('game-over-screen');
    const pauseScreen = document.getElementById('pause-screen');
    const leftControlsPanel = document.getElementById('left-controls-panel');
    const healthBarContainer = document.getElementById('health-bar-container');
    const scoreDisplay = document.getElementById('score-display');
    const flightIndicators = document.getElementById('flight-indicators');
    
    // Show appropriate screen or UI based on state
    switch (state) {
        case 'start':
            if (startScreen) startScreen.style.display = 'flex';
            
            // Hide game UI elements
            if (healthBarContainer) healthBarContainer.style.display = 'none';
            if (scoreDisplay) scoreDisplay.style.display = 'none';
            if (leftControlsPanel) leftControlsPanel.style.display = 'none';
            if (flightIndicators) flightIndicators.style.display = 'none';
            break;
            
        case 'paused':
            if (pauseScreen) pauseScreen.style.display = 'flex';
            
            // Show control panel if it was visible before
            if (leftControlsPanel) {
                leftControlsPanel.style.display = controlPanelVisible ? 'block' : 'none';
            }
            
            // Hide flight indicators during pause
            if (flightIndicators) flightIndicators.style.display = 'none';
            break;
            
        case 'gameover':
            if (gameOverScreen) {
                // Update final score
                const finalScoreElement = document.getElementById('final-score');
                if (finalScoreElement) {
                    finalScoreElement.textContent = `Data fragments collected: ${score}`;
                }
                gameOverScreen.style.display = 'flex';
            }
            
            // Hide game UI elements
            if (leftControlsPanel) leftControlsPanel.style.display = 'none';
            if (flightIndicators) flightIndicators.style.display = 'none';
            
            // Play game over sound
            playSound('gameOver');
            break;
            
        case 'playing':
            // Show game UI elements
            if (scoreDisplay) scoreDisplay.style.display = 'block';
            if (healthBarContainer) healthBarContainer.style.display = 'block';
            if (flightIndicators) flightIndicators.style.display = 'block';
            
            // Only show control panel if controlPanelVisible is true
            if (leftControlsPanel) {
                leftControlsPanel.style.display = controlPanelVisible ? 'block' : 'none';
            }
            break;
    }
    
    // Update background music based on new state
    updateBackgroundMusic();
}

// Register the setGameState function with the bridge
gameBridge.registerSetGameState(setGameState);

// Restart the game
function restartGame() {
    console.log("Restarting game. Initial building count:", buildings.length);
    
    // Reset game variables
    score = 0;
    health = 100;
    document.getElementById('health-bar').style.width = '100%';
    document.getElementById('score-display').textContent = 'Score: 0';
    
    // Clear data fragments
    for (const fragment of dataFragments) {
        scene.remove(fragment.mesh);
    }
    dataFragments = [];
    
    // Clear drones
    for (const drone of drones) {
        scene.remove(drone);
    }
    drones = [];
    
    // Clear projectiles - just remove from scene but keep in pool
    for (const projectile of projectiles) {
        scene.remove(projectile.mesh);
        projectile.active = false;
    }
    projectiles = [];
    
    // Reset ship position
    ship.position.set(0, 10, 0);
    ship.rotation.y = Math.PI;
    
    // Reset camera
    updateCameraPosition();
    
    // Create new data fragments and drones
    createDataFragments();
    createDrones();
    
    // Set game state to playing
    setGameState('playing');
    
    console.log("Game restart complete. Building count after restart:", buildings.length);
}

// Register the restartGame function with the bridge
gameBridge.registerRestartGame(restartGame);

// Set up event listeners for player controls and UI
function setupEventListeners() {
    console.log("Setting up event listeners");
    
    // Keyboard events for player movement
    document.addEventListener('keydown', function(event) {
        handleKeyEvent(event, true);
    });
    
    document.addEventListener('keyup', function(event) {
        handleKeyEvent(event, false);
    });
    
    // Window resize event
    window.addEventListener('resize', onWindowResize);
    
    // Game screen event listeners
    try {
        // Start button
        const startButton = document.getElementById('start-button');
        if (startButton) {
            console.log("Adding event listener to start button");
            startButton.addEventListener('click', function() {
                console.log("Start button clicked");
                setGameState('playing');
            });
        } else {
            console.warn("Start button not found in DOM");
        }
        
        // Resume button
        const resumeButton = document.getElementById('resume-button');
        if (resumeButton) {
            console.log("Adding event listener to resume button");
            resumeButton.addEventListener('click', function() {
                console.log("Resume button clicked");
                setGameState('playing');
            });
        } else {
            console.warn("Resume button not found in DOM");
        }
        
        // Restart button
        const restartButton = document.getElementById('restart-button');
        if (restartButton) {
            console.log("Adding event listener to restart button");
            restartButton.addEventListener('click', function() {
                console.log("Restart button clicked");
                restartGame();
            });
        } else {
            console.warn("Restart button not found in DOM");
        }
    } catch (err) {
        console.error("Error setting up UI event listeners:", err);
    }
}

// Helper function to handle keyboard events
function handleKeyEvent(event, isDown) {
    // Skip keyboard handling when an input element is focused
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
        return;
    }
    
    // Get the key code
    const keyCode = event.code || event.key;
    
    // Handle based on key
    switch (keyCode) {
        case 'KeyW':
        case 'ArrowUp':
            moveForward = isDown;
            break;
            
        case 'KeyS':
        case 'ArrowDown':
            moveBackward = isDown;
            break;
            
        case 'KeyA':
        case 'ArrowLeft':
            moveLeft = isDown;
            break;
            
        case 'KeyD':
        case 'ArrowRight':
            moveRight = isDown;
            break;
            
        case 'Space':
            moveUp = isDown;
            break;
            
        case 'ShiftLeft':
        case 'ShiftRight':
            moveDown = isDown;
            break;
            
        case 'KeyV':
            // Toggle camera view on key up
            if (!isDown) {
                toggleCameraView();
            }
            break;
            
        case 'KeyF':
            // Fire weapon
            if (isDown && !weaponCooldown && gameState === 'playing') {
                fireProjectile();
            }
            break;
            
        case 'KeyC':
            // Toggle control panel on key up
            if (!isDown) {
                toggleControlPanel();
            }
            break;
            
        case 'Escape':
            // Toggle pause on key up
            if (!isDown) {
                if (gameState === 'playing') {
                    setGameState('paused');
                } else if (gameState === 'paused') {
                    setGameState('playing');
                }
            }
            break;
            
        case 'KeyB':
            // Toggle debug mode on key up (hidden feature)
            if (!isDown) {
                debugMode = !debugMode;
                const debugPanel = document.getElementById('debug-panel');
                if (debugPanel) {
                    debugPanel.style.display = debugMode ? 'block' : 'none';
                }
                console.log("Debug mode:", debugMode);
            }
            break;
    }
}

// Toggle between side view and top-down view
function toggleCameraView() {
    isTopDownView = !isTopDownView;
}

// Update camera position based on current view
function updateCameraPosition() {
    if (isTopDownView) {
        // Top-down view
        camera.position.x = ship.position.x;
        camera.position.y = ship.position.y + 20;
        camera.position.z = ship.position.z;
    } else {
        // Side view
        const distance = 15;
        const height = 5;
        const angle = ship.rotation.y;
        
        camera.position.x = ship.position.x - Math.sin(angle) * distance;
        camera.position.y = ship.position.y + height;
        camera.position.z = ship.position.z - Math.cos(angle) * distance;
    }
    
    // Look at ship
    camera.lookAt(ship.position);
}

// Update ship position and rotation based on controls
function updateShipMovement() {
    if (gameState !== 'playing') return; // Only update during gameplay
    
    // Store previous position for collision detection
    const prevPosition = new THREE.Vector3().copy(ship.position);
    
    // Rotation
    if (moveLeft) ship.rotation.y += SHIP_ROTATION_SPEED;
    if (moveRight) ship.rotation.y -= SHIP_ROTATION_SPEED;
    
    // Reset all velocity components
    velocity.x = 0;
    velocity.z = 0;
    velocity.y = 0; // Reset vertical velocity - important to stop movement when key released
    
    // Apply horizontal movement
    if (moveForward) {
        velocity.x = Math.sin(ship.rotation.y) * SHIP_SPEED;
        velocity.z = Math.cos(ship.rotation.y) * SHIP_SPEED;
    }
    if (moveBackward) {
        velocity.x = -Math.sin(ship.rotation.y) * SHIP_SPEED * 0.5;
        velocity.z = -Math.cos(ship.rotation.y) * SHIP_SPEED * 0.5;
    }
    
    // Vertical movement - more controlled with lower speed
    const verticalSpeedMultiplier = 0.5; // Slower vertical movement for better control
    
    // Apply vertical movement ONLY when the keys are pressed
    if (moveUp) {
        velocity.y = SHIP_SPEED * verticalSpeedMultiplier;
    } else if (moveDown) { // Using else if to prevent competing inputs
        velocity.y = -SHIP_SPEED * verticalSpeedMultiplier;
    } else {
        // EXPLICIT: Ensure vertical velocity is zero when no keys are pressed
        velocity.y = 0;
    }
    
    // Debug log vertical movement state
    if (debugMode && (moveUp || moveDown)) {
        console.log(`Vertical movement: ${moveUp ? 'UP' : moveDown ? 'DOWN' : 'NONE'}, Velocity Y: ${velocity.y}, moveDown: ${moveDown}`);
    }
    
    // SAFETY CHECK: Force stop downward movement if too close to ground
    const minHeightWithMargin = 6; // Slightly above minimum height
    if (ship.position.y <= minHeightWithMargin && velocity.y < 0) {
        velocity.y = 0;
        if (debugMode) console.log("Too close to ground, stopping downward movement");
    }
    
    // Apply velocity to position
    ship.position.x += velocity.x;
    ship.position.z += velocity.z;
    ship.position.y += velocity.y;
    
    // Boundary check
    const boundary = CITY_SIZE / 2;
    ship.position.x = Math.max(-boundary, Math.min(boundary, ship.position.x));
    ship.position.z = Math.max(-boundary, Math.min(boundary, ship.position.z));
    
    // Vertical boundary check
    const minHeight = 5; // Minimum height above ground
    const maxHeight = 120; // Maximum height
    ship.position.y = Math.max(minHeight, Math.min(maxHeight, ship.position.y));
    
    // Building collision check
    if (checkBuildingCollisions()) {
        // Collision occurred - revert position
        ship.position.copy(prevPosition);
        
        // Apply damage (with cooldown)
        if (Date.now() - lastDamageTime > DAMAGE_COOLDOWN && Date.now() > invincibleTime) {
            applyDamage(BUILDING_COLLISION_DAMAGE);
        }
    }
}

// Check collisions with buildings
function checkBuildingCollisions() {
    const shipX = ship.position.x;
    const shipY = ship.position.y;
    const shipZ = ship.position.z;
    const shipRadius = 2; // Approximate ship collision radius
    const shipBottom = shipY - 1; // Bottom of the ship for vertical collision
    
    // Only check nearby buildings for collision (within 50 units)
    const maxCollisionDistance = 50;
    const shipPos = new THREE.Vector3(shipX, shipY, shipZ);
    
    for (const building of buildings) {
        // Skip invisible buildings (frustum culled) to improve performance
        if (building.mesh && !building.mesh.visible) continue;
        
        // Quick distance check for performance
        const buildingPos = new THREE.Vector3(building.x, building.height/2, building.z);
        const distance = shipPos.distanceTo(buildingPos);
        
        // Skip if too far away
        if (distance > maxCollisionDistance) continue;
        
        const halfWidth = building.width / 2;
        const halfDepth = building.depth / 2;
        
        // Check if ship is colliding with building
        if (shipX > building.x - halfWidth - shipRadius && 
            shipX < building.x + halfWidth + shipRadius &&
            shipBottom < building.height && // Check if bottom of ship is below building height
            shipZ > building.z - halfDepth - shipRadius && 
            shipZ < building.z + halfDepth + shipRadius) {
            
            // If ship is above the building, allow passage
            if (shipY > building.height + 2) { // Add 2 units clearance
                return false;
            }
            
            return true;
        }
    }
    
    return false;
}

// Check collisions with drones
function checkDroneCollisions() {
    if (Date.now() < invincibleTime) return; // Skip if player is invincible
    
    const shipPosition = new THREE.Vector3().copy(ship.position);
    const collisionDistance = 3; // Approximate collision distance
    
    for (const drone of drones) {
        const distance = drone.position.distanceTo(shipPosition);
        
        if (distance < collisionDistance && Date.now() - lastDamageTime > DAMAGE_COOLDOWN) {
            // Collision with drone - apply damage
            applyDamage(DRONE_COLLISION_DAMAGE);
            
            // Push drone away slightly
            const pushDirection = new THREE.Vector3()
                .subVectors(drone.position, shipPosition)
                .normalize()
                .multiplyScalar(5);
            
            drone.position.add(pushDirection);
            return true;
        }
    }
    
    return false;
}

// Apply damage to player
function applyDamage(amount) {
    // Play damage sound
    playSound('damage');
    
    // Update last damage time
    lastDamageTime = Date.now();
    
    // Set temporary invincibility
    invincibleTime = Date.now() + INVINCIBILITY_TIME;
    
    // Apply damage
    health -= amount;
    health = Math.max(0, health); // Prevent negative health
    
    // Update health bar
    const healthBar = document.getElementById('health-bar');
    if (healthBar) {
        healthBar.style.width = health + '%';
        
        // Update health color based on value (cyberpunk style)
        if (health < 25) {
            healthBar.style.background = 'linear-gradient(90deg, #ff3300, #ff6600)'; // Critical - red/orange
        } else if (health < 50) {
            healthBar.style.background = 'linear-gradient(90deg, #ffcc00, #ffee00)'; // Warning - yellow
        } else {
            healthBar.style.background = 'linear-gradient(90deg, #00ff66, #66ffcc)'; // Healthy - green/cyan
        }
    }
    
    // Update health value display
    const healthValue = document.getElementById('health-value');
    if (healthValue) {
        healthValue.textContent = Math.floor(health) + '%';
    }
    
    // Game over if health reaches 0
    if (health <= 0) {
        setGameState('gameover');
    }
}

// Check collisions with data fragments
function checkFragmentCollisions() {
    const shipPosition = new THREE.Vector3(ship.position.x, ship.position.y, ship.position.z);
    const collectionDistance = 3; // Distance for collecting fragments
    const currentTime = Date.now();
    
    // Update score multiplier - decay over time if no fragments collected recently
    if (scoreMultiplier > 1 && currentTime - lastFragmentCollectTime > MULTIPLIER_DECAY_TIME) {
        scoreMultiplier = Math.max(1, scoreMultiplier - (deltaTime * 0.5)); // Gradual decay
        updateScoreDisplay();
    }
    
    for (let i = dataFragments.length - 1; i >= 0; i--) {
        const fragment = dataFragments[i];
        const fragmentPosition = new THREE.Vector3(fragment.x, fragment.y, fragment.z);
        
        const distance = shipPosition.distanceTo(fragmentPosition);
        
        if (distance < collectionDistance) {
            // Fragment collected
            scene.remove(fragment.mesh);
            dataFragments.splice(i, 1);
            
            // Update score multiplier for quick collection
            const timeSinceLastFragment = currentTime - lastFragmentCollectTime;
            if (timeSinceLastFragment < 5000) { // If collected within 5 seconds of last one
                scoreMultiplier = Math.min(MAX_MULTIPLIER, scoreMultiplier + 0.5); // Increase multiplier
            } else {
                scoreMultiplier = 1; // Reset if too slow
            }
            lastFragmentCollectTime = currentTime;
            
            // Update score with multiplier
            const basePoints = 10;
            const bonusPoints = Math.floor(basePoints * scoreMultiplier);
            score += bonusPoints;
            
            // Display floating score text
            showFloatingText(`+${bonusPoints}`, fragment.x, fragment.y, fragment.z);
            
            // Update score display
            updateScoreDisplay();
            
            // Play collection sound
            playSound('collect');
            
            // Show a random quote
            showQuote();
            
            // Check if all fragments collected
            if (dataFragments.length === 0) {
                // Level completed!
                completeLevel();
            }
            
            return true; // Return true since we made a change to the fragments array
        }
    }
    
    return false;
}

// Helper function to update score display with multiplier info
function updateScoreDisplay() {
    const scoreDisplay = document.getElementById('score-display');
    if (scoreDisplay) {
        if (scoreMultiplier > 1) {
            scoreDisplay.textContent = `Score: ${score} (x${scoreMultiplier.toFixed(1)})`;
            scoreDisplay.style.color = '#ffcc00'; // Highlight when multiplier is active
        } else {
            scoreDisplay.textContent = `Score: ${score}`;
            scoreDisplay.style.color = '#00ffff'; // Reset to default color
        }
    }
}

// Show floating text for score display
function showFloatingText(text, x, y, z) {
    // Get inactive text element from pool
    let textObj = floatingTextPool.find(obj => !obj.active);
    
    // If no inactive elements, just return (skip showing this one)
    if (!textObj) return;
    
    // Activate and configure the element
    textObj.active = true;
    const element = textObj.element;
    
    // Update text content and styling
    element.textContent = text;
    element.style.color = scoreMultiplier > 1 ? '#ffcc00' : '#00ffff';
    element.style.textShadow = '0 0 5px #00ffff';
    element.style.display = 'block';
    element.style.opacity = '1';
    
    // Convert 3D position to screen position
    const vector = new THREE.Vector3(x, y, z);
    vector.project(camera);
    
    const screenX = (vector.x * 0.5 + 0.5) * window.innerWidth;
    const screenY = (-vector.y * 0.5 + 0.5) * window.innerHeight;
    
    // Position the text
    element.style.left = screenX + 'px';
    element.style.top = screenY + 'px';
    
    // Reset any ongoing animations
    element.style.animation = 'none';
    // Force reflow to ensure animation restart
    void element.offsetWidth;
    // Apply animation
    element.style.animation = 'float-up 1.5s ease-out forwards';
    
    // Return to pool after animation completes
    setTimeout(() => {
        element.style.display = 'none';
        textObj.active = false;
    }, 1500);
}

// Level completion function
function completeLevel() {
    // Pause the game
    setGameState('paused');
    
    // Create level complete message with cryptic message
    const levelCompleteDiv = document.createElement('div');
    levelCompleteDiv.id = 'level-complete';
    levelCompleteDiv.style.position = 'fixed';
    levelCompleteDiv.style.top = '50%';
    levelCompleteDiv.style.left = '50%';
    levelCompleteDiv.style.transform = 'translate(-50%, -50%)';
    levelCompleteDiv.style.padding = '20px';
    levelCompleteDiv.style.background = 'rgba(0, 0, 0, 0.8)';
    levelCompleteDiv.style.color = '#0ff';
    levelCompleteDiv.style.fontFamily = 'monospace';
    levelCompleteDiv.style.zIndex = '1000';
    levelCompleteDiv.style.textAlign = 'center';
    levelCompleteDiv.style.borderRadius = '10px';
    levelCompleteDiv.style.boxShadow = '0 0 20px #0ff';
    levelCompleteDiv.style.fontSize = '24px';
    levelCompleteDiv.style.border = '2px solid #0ff';
    
    // Cryptic message with glitchy text
    const crypticMessage = `
        <div style="font-family: monospace; letter-spacing: 2px; line-height: 1.5;">
            <p style="color: #ff0066; text-shadow: 0 0 5px #ff0066;">E#R0R_932: CONSCIOUSNESS BREACH</p>
            <p style="color: #0ff; text-shadow: 0 0 8px #0ff;">D4T4_FR4GM3NT5_R3V34L3D</p>
            <p style="color: #ffcc00; text-shadow: 0 0 3px #ffcc00;">UNCH1PP3D_3NT1TY_D3T3CT3D</p>
            <p style="color: #ff00ff; text-shadow: 0 0 7px #ff00ff; font-size: 0.8em; margin-top: 10px;">01010100 01001000 01000101 01011001 00100000 01000011 01001111 01001101 01000101</p>
        </div>
    `;
    
    levelCompleteDiv.innerHTML = `
        <h2 style="margin: 0 0 20px 0; color: #0ff; text-shadow: 0 0 10px #0ff;">CONNECTION TERMINATED</h2>
        ${crypticMessage}
        <div style="display: flex; gap: 15px; justify-content: center; margin-top: 20px;">
            <button id="continue-button" style="background: #0ff; color: #000; border: none; padding: 10px 20px; font-family: monospace; cursor: pointer; font-size: 18px;">ACKNOWLEDGE</button>
            <a href="https://www.amazon.com/Machina-Unchipped-Book-Memory-Trilogy/dp/B0DTYG4VC9/ref=sr_1_2?crid=13YIOCOAV" target="_blank" style="text-decoration: none;">
                <button style="background: #ff3366; color: #000; border: none; padding: 10px 20px; font-family: monospace; cursor: pointer; font-size: 18px;">DISCOVER THE BOOK</button>
            </a>
        </div>
    `;
    
    document.body.appendChild(levelCompleteDiv);
    
    // Add event listener to continue button
    document.getElementById('continue-button').addEventListener('click', () => {
        // Remove level complete message
        document.body.removeChild(levelCompleteDiv);
        
        // Resume game
        setGameState('playing');
        
        // Could add logic here to advance to next level if implemented
        // For now just show a message
        const messageDiv = document.createElement('div');
        messageDiv.style.position = 'fixed';
        messageDiv.style.top = '20%';
        messageDiv.style.left = '50%';
        messageDiv.style.transform = 'translateX(-50%)';
        messageDiv.style.padding = '10px';
        messageDiv.style.background = 'rgba(0, 0, 0, 0.8)';
        messageDiv.style.color = '#0ff';
        messageDiv.style.fontFamily = 'monospace';
        messageDiv.style.zIndex = '1000';
        messageDiv.style.textAlign = 'center';
        messageDiv.style.borderRadius = '5px';
        messageDiv.style.boxShadow = '0 0 10px #0ff';
        messageDiv.style.border = '1px solid #0ff';
        messageDiv.textContent = 'THE NETWORK GROWS. THEY ARE COMING.';
        
        document.body.appendChild(messageDiv);
        
        // Remove the message after 5 seconds
        setTimeout(() => {
            document.body.removeChild(messageDiv);
        }, 5000);
    });
}

// Create enemy drone geometry and material
function createDroneGeometry() {
    const droneGroup = new THREE.Group();
    
    // Main body - angular and threatening
    const bodyGeometry = new THREE.TetrahedronGeometry(1.2, 0);
    const bodyMaterial = new THREE.MeshStandardMaterial({
        color: 0xff0000,
        emissive: 0xff0000,
        emissiveIntensity: 0.3,
        metalness: 0.7,
        roughness: 0.3
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.rotation.x = Math.PI / 2;
    droneGroup.add(body);
    
    // Engine glow
    const engineGlowGeometry = new THREE.SphereGeometry(0.3, 16, 16);
    const engineGlowMaterial = new THREE.MeshBasicMaterial({
        color: 0xff3333,
        transparent: true,
        opacity: 0.7
    });
    const engineGlow = new THREE.Mesh(engineGlowGeometry, engineGlowMaterial);
    engineGlow.position.set(0, 0, -0.8);
    droneGroup.add(engineGlow);
    
    // Sensor/scanner effect
    const sensorGeometry = new THREE.RingGeometry(0.2, 0.3, 16);
    const sensorMaterial = new THREE.MeshBasicMaterial({
        color: 0xff5555,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9
    });
    const sensor = new THREE.Mesh(sensorGeometry, sensorMaterial);
    sensor.position.set(0, 0, 1);
    sensor.rotation.x = Math.PI / 2;
    droneGroup.add(sensor);
    
    return droneGroup;
}

// Create explosion particle texture
function createExplosionParticleTexture() {
    const canvas = document.createElement('canvas');
    const size = 64;
    canvas.width = size;
    canvas.height = size;
    
    const context = canvas.getContext('2d');
    
    // Create a radial gradient for explosion particles
    const gradient = context.createRadialGradient(
        size / 2, size / 2, 0,
        size / 2, size / 2, size / 2
    );
    
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.3, 'rgba(255, 200, 70, 0.8)');
    gradient.addColorStop(0.7, 'rgba(255, 50, 20, 0.4)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
    
    const texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;
    
    return texture;
}

// Initialize explosion pool
function initExplosionPool() {
    try {
        // Create explosion particle texture
        const explosionTexture = createExplosionParticleTexture();
        
        explosionPool = [];
        const poolSize = 10;
        
        for (let i = 0; i < poolSize; i++) {
            // Create simple particle system for each explosion
            const particleCount = 30;
        const geometry = new THREE.BufferGeometry();
        
            // Create position, color, and size arrays
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);
        const sizes = new Float32Array(particleCount);
        
            // Initialize positions randomly
        for (let j = 0; j < particleCount; j++) {
            positions[j * 3] = 0;
            positions[j * 3 + 1] = 0;
            positions[j * 3 + 2] = 0;
            
                colors[j * 3] = 1.0;     // R
                colors[j * 3 + 1] = 0.5;  // G
                colors[j * 3 + 2] = 0.2;  // B
                
                sizes[j] = 0;
            }
            
            // Set attributes
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        
            // Create material with texture
        const material = new THREE.PointsMaterial({
                size: 1.0,
                map: explosionTexture,
            blending: THREE.AdditiveBlending,
            transparent: true,
                vertexColors: true,
                depthWrite: false
        });
        
            // Create points system
        const particles = new THREE.Points(geometry, material);
            particles.visible = false;
        scene.add(particles);
        
            // Store in pool
        explosionPool.push({
            particles: particles,
            geometry: geometry,
            material: material,
                velocities: Array(particleCount).fill(null),
            particleCount: particleCount,
                active: false,
            opacity: 0,
            size: 0,
            animationId: null
        });
        }
        
        console.log("Explosion pool initialized with", poolSize, "explosions");
    } catch (error) {
        console.error("Error initializing explosion pool:", error);
        showLoadingError("Failed to initialize explosion effects: " + error.message);
    }
}

// Create a drone explosion effect
function createDroneExplosion(x, y, z) {
    try {
        // Create a simple expanding sphere for the explosion
        const explosionGeometry = new THREE.SphereGeometry(1, 8, 8);
        const explosionMaterial = new THREE.MeshBasicMaterial({
            color: 0xff5500,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide
        });
        
        const explosion = new THREE.Mesh(explosionGeometry, explosionMaterial);
        explosion.position.set(x, y, z);
        scene.add(explosion);
        
        // Add a point light for the glow
        const explosionLight = new THREE.PointLight(0xff5500, 3, 8);
        explosionLight.position.set(x, y, z);
        scene.add(explosionLight);
        
        // Animate the explosion
        let size = 1;
        let expansionSpeed = 0.2;
        let fadeSpeed = 0.05;
        
        function animateExplosion() {
            size += expansionSpeed;
            explosion.scale.set(size, size, size);
            explosionMaterial.opacity -= fadeSpeed;
            
            explosionLight.intensity *= 0.95;
            
            if (explosionMaterial.opacity > 0) {
                requestAnimationFrame(animateExplosion);
            } else {
                // Clean up
                scene.remove(explosion);
                scene.remove(explosionLight);
                
                // Dispose resources
                explosionGeometry.dispose();
                explosionMaterial.dispose();
            }
        }
        
        // Start animation
        animateExplosion();
        
        // Play explosion sound
        playSound('explosion');
        
    } catch (error) {
        console.error("Error creating drone explosion:", error);
    }
}

// Initialize the drone pool
function initDronePool() {
    console.log("Initializing drone pool with size:", DRONE_POOL_SIZE);
    
    dronePool = []; // Reset drone pool
    
    for (let i = 0; i < DRONE_POOL_SIZE; i++) {
        // Create drone geometry
        const droneGeometry = createDroneGeometry();
        const drone = new THREE.Object3D();
        drone.add(droneGeometry);
        drone.visible = false; // Start invisible
        scene.add(drone);
        
        // Add to drone pool with proper initialization
        dronePool.push({
            mesh: drone,
            position: new THREE.Vector3(0, 0, 0),
            patrolTarget: new THREE.Vector3(0, 0, 0),
            isPursuing: false,
            velocity: new THREE.Vector3(0, 0, 0),
            active: false,
            id: "drone_" + i, // Add ID for debugging
            lastActive: 0
        });
    }
    
    // Log success
    console.log("Drone pool initialized with", dronePool.length, "drones");
}

// Create drones from the pool
function createDrones() {
    console.log("Creating drones. Current count:", drones.length, "Target:", DRONE_COUNT);
    
    let dronesCreated = 0;
    
    // Check how many more drones we need
    const dronesNeeded = DRONE_COUNT - drones.length;
    
    // First, position 5 drones specifically to guard data fragments
    const guardDroneCount = Math.min(5, dronesNeeded, dataFragments.length);
    
    if (guardDroneCount > 0 && dataFragments.length > 0) {
        console.log("Positioning guard drones near data fragments");
        
        // Choose random data fragments to guard
        const fragmentsToGuard = [];
        const fragmentsCopy = [...dataFragments];
        
        // Select random fragments to guard
        for (let i = 0; i < guardDroneCount; i++) {
            if (fragmentsCopy.length === 0) break;
            const randomIndex = Math.floor(Math.random() * fragmentsCopy.length);
            fragmentsToGuard.push(fragmentsCopy.splice(randomIndex, 1)[0]);
        }
        
        // For each selected fragment, position a drone nearby
        for (let i = 0; i < fragmentsToGuard.length && dronesCreated < dronesNeeded; i++) {
            const fragment = fragmentsToGuard[i];
            
            // Find an inactive drone from the pool
            for (let j = 0; j < dronePool.length; j++) {
                const droneData = dronePool[j];
                
                // Skip already active drones
                if (droneData.active) continue;
                
                // Activate the drone
                droneData.active = true;
                droneData.lastActive = Date.now();
                droneData.mesh.visible = true;
                
                // Position the drone near the fragment with a small random offset
                const offsetX = (Math.random() - 0.5) * 8;
                const offsetY = (Math.random() - 0.5) * 5 + 3; // Slightly above fragment
                const offsetZ = (Math.random() - 0.5) * 8;
                
                droneData.position.set(
                    fragment.x + offsetX,
                    fragment.y + offsetY,
                    fragment.z + offsetZ
                );
                
                // Set patrol target to circle around the fragment
                droneData.patrolTarget.set(
                    fragment.x - offsetX,
                    fragment.y + Math.random() * 3,
                    fragment.z - offsetZ
                );
                
                // Set a flag to indicate this is a guard drone
                droneData.isGuard = true;
                droneData.guardingFragment = fragment;
                
                // Reset drone state
                droneData.velocity.set(0, 0, 0);
                droneData.isPursuing = false;
                
                // Update mesh position
                droneData.mesh.position.copy(droneData.position);
                
                // Add to active drones array
                drones.push(droneData);
                
                dronesCreated++;
                
                console.log("Activated guard drone:", droneData.id, "guarding fragment at:", fragment.x.toFixed(2), fragment.y.toFixed(2), fragment.z.toFixed(2));
                
                break; // Found a drone for this fragment, move to next fragment
            }
        }
    }
    
    // Fill the remaining drone slots with regular patrol drones
    // Activate drones from the pool
    for (let i = 0; i < dronePool.length && dronesCreated < dronesNeeded; i++) {
        const droneData = dronePool[i];
        
        // Skip already active drones
        if (droneData.active) continue;
        
        // Activate the drone
        droneData.active = true;
        droneData.lastActive = Date.now();
        droneData.mesh.visible = true;
        droneData.isGuard = false; // Not a guard drone
        
        // Set random position within city bounds
        const boundary = CITY_SIZE / 2 - 20;
        droneData.position.set(
            Math.random() * CITY_SIZE - CITY_SIZE / 2,
            20 + Math.random() * 40, // Between 20 and 60 units high
            Math.random() * CITY_SIZE - CITY_SIZE / 2
        );
        
        // Set initial patrol target
        droneData.patrolTarget.set(
            Math.random() * CITY_SIZE - CITY_SIZE / 2,
            20 + Math.random() * 40,
            Math.random() * CITY_SIZE - CITY_SIZE / 2
        );
        
        // Reset drone state
        droneData.velocity.set(0, 0, 0);
        droneData.isPursuing = false;
        
        // Update mesh position
        droneData.mesh.position.copy(droneData.position);
        
        // Add to active drones array
        drones.push(droneData);
        
        dronesCreated++;
        
        console.log("Activated patrol drone:", droneData.id, "at position:", droneData.position.x.toFixed(2), droneData.position.y.toFixed(2), droneData.position.z.toFixed(2));
    }
    
    if (dronesCreated > 0) {
        console.log("Created", dronesCreated, "drones. Total active:", drones.length);
    } else if (dronesNeeded > 0) {
        console.warn("Failed to create drones. Pool exhausted? Active drones:", drones.length);
        
        // Emergency measure: Reset any drones that haven't been active for a while
        const currentTime = Date.now();
        for (let i = 0; i < dronePool.length && dronesCreated < dronesNeeded; i++) {
            const droneData = dronePool[i];
            if (droneData.active && currentTime - droneData.lastActive > 60000) { // 1 minute inactive
                console.log("Resetting stale drone:", droneData.id);
                deactivateDrone(droneData);
                i--; // Retry this index
            }
        }
    }
}

// Deactivate a drone and return it to the pool
function deactivateDrone(droneData) {
    // Verify droneData is valid
    if (!droneData) {
        console.error("Attempted to deactivate undefined drone");
        return;
    }
    
    console.log("Deactivating drone:", droneData.id);
    
    // Mark as inactive
    droneData.active = false;
    droneData.mesh.visible = false;
    
    // Remove from active drones array
    const index = drones.indexOf(droneData);
    if (index !== -1) {
        drones.splice(index, 1);
        console.log("Removed drone from active list. Remaining:", drones.length);
    } else {
        console.warn("Drone was not in active list:", droneData.id);
    }
}

// Update drones - ensure positions are properly synchronized
function updateDrones() {
    if (gameState !== 'playing') return;
    
    const currentTime = Date.now();
    
    // Check if we need to spawn more drones
    if (drones.length < DRONE_COUNT) {
        createDrones();
    }
    
    // Log periodic status
    if (currentTime % 5000 < 50) { // Log roughly every 5 seconds
        console.log("Active drones:", drones.length, "Pool size:", dronePool.length);
        // Log positions of all active drones
        drones.forEach((drone, index) => {
            console.log(`Drone ${index} (${drone.id}): Position=${drone.position.x.toFixed(1)},${drone.position.y.toFixed(1)},${drone.position.z.toFixed(1)} Active=${drone.active} Visible=${drone.mesh.visible}`);
        });
    }
    
    // Update each drone
    for (let i = drones.length - 1; i >= 0; i--) {
        const drone = drones[i];
        
        // Verify drone is valid
        if (!drone || !drone.mesh) {
            console.error("Invalid drone at index", i);
            drones.splice(i, 1);
            continue;
        }
        
        // Skip inactive drones
        if (!drone.active) {
            console.warn("Inactive drone in active list. Removing:", drone.id);
            drones.splice(i, 1);
            continue;
        }
        
        // Update last active time
        drone.lastActive = currentTime;
        
        // Ensure drone is visible
        if (!drone.mesh.visible) {
            console.warn("Active drone was invisible. Fixing:", drone.id);
            drone.mesh.visible = true;
        }
        
        // Check if drone is pursuing player
        const distanceToPlayer = drone.position.distanceTo(ship.position);
        
        // Start pursuing if player is within detection radius
        if (distanceToPlayer < DRONE_DETECTION_RADIUS) {
            drone.isPursuing = true;
        } else if (distanceToPlayer > DRONE_DETECTION_RADIUS * 1.5) {
            // Stop pursuing if player gets far enough away
            drone.isPursuing = false;
        }
        
        // Calculate movement direction
        const direction = new THREE.Vector3();
        
        if (drone.isPursuing) {
            // Move towards player when pursuing
            direction.subVectors(ship.position, drone.position).normalize();
            drone.velocity.copy(direction).multiplyScalar(DRONE_PURSUIT_SPEED);
        } else {
            // Move towards patrol target when not pursuing
            direction.subVectors(drone.patrolTarget, drone.position).normalize();
            
            // If close to target, pick a new random target
            if (drone.position.distanceTo(drone.patrolTarget) < 5) {
                drone.patrolTarget.set(
                    Math.random() * CITY_SIZE - CITY_SIZE / 2,
                    Math.random() * 50 + 10,
                    Math.random() * CITY_SIZE - CITY_SIZE / 2
                );
            }
            
            drone.velocity.copy(direction).multiplyScalar(DRONE_PATROL_SPEED);
        }
        
        // Update position
        drone.position.add(drone.velocity);
        
        // Apply height limits
        drone.position.y = Math.max(5, Math.min(80, drone.position.y));
        
        // Update the drone mesh to match the drone data position
        drone.mesh.position.copy(drone.position);
        
        // Smoothly rotate to face movement direction
        if (drone.velocity.length() > 0.01) {
            const targetRotation = new THREE.Quaternion();
            const lookAtPosition = new THREE.Vector3().copy(drone.position).add(drone.velocity);
            
            // Create a rotation that looks in the direction of movement
            const tempMatrix = new THREE.Matrix4();
            tempMatrix.lookAt(drone.position, lookAtPosition, new THREE.Vector3(0, 1, 0));
            targetRotation.setFromRotationMatrix(tempMatrix);
            
            // Apply smooth rotation
            drone.mesh.quaternion.slerp(targetRotation, 0.1);
        }
        
        // Check if drone has collided with player
        if (distanceToPlayer < 3 && !invincibleTime) {
            applyDamage(DRONE_COLLISION_DAMAGE);
            createDroneExplosion(drone.position.x, drone.position.y, drone.position.z);
            scene.remove(drone.mesh);
            deactivateDrone(drone);
        }
    }
}

// Set up post-processing effects
function setupPostProcessing() {
    // Check if EffectComposer and other modules are loaded
        if (!EffectComposer || !RenderPass || !UnrealBloomPass) {
        console.warn("Post-processing modules not loaded yet. Skipping post-processing setup.");
            return;
        }
        
    try {
        // Create composer
        composer = new EffectComposer(renderer);
        
        // Add render pass
        const renderPass = new RenderPass(scene, camera);
        composer.addPass(renderPass);
        
        // Add bloom pass for glow effects
            const bloomParams = {
            threshold: 0.25,
            strength: 0.8,
            radius: 0.5
        };
            bloomPass = new UnrealBloomPass(
                new THREE.Vector2(window.innerWidth, window.innerHeight),
                bloomParams.strength,
                bloomParams.radius,
                bloomParams.threshold
            );
            composer.addPass(bloomPass);
            
        console.log("Post-processing setup complete");
    } catch (error) {
        console.error("Error setting up post-processing:", error);
        // Fallback to standard renderer if post-processing fails
        composer = null;
    }
}

// Update window size and camera/renderer settings when window is resized
function onWindowResize() {
    if (!camera || !renderer) {
        console.warn("Camera or renderer not initialized yet, skipping resize");
        return;
    }
    
    // Update camera aspect ratio
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    
    // Update renderer size
    renderer.setSize(window.innerWidth, window.innerHeight);
    
    // Update composer size if it exists
    if (composer) {
        composer.setSize(window.innerWidth, window.innerHeight);
    }
}

// Animation loop
function animate() {
    // Request next frame
    requestAnimationFrame(animate);
    
    // Calculate delta time for smooth animation
    const currentTime = performance.now();
    
    // For performance debugging
    const frameStartTime = performance.now();
    
    deltaTime = (currentTime - lastFrameTime) / 1000; // Convert to seconds
    
    // Calculate and display FPS
    const fps = Math.round(1 / deltaTime);
    const fpsDisplay = document.getElementById('fps-counter');
    if (fpsDisplay) {
        fpsDisplay.textContent = `FPS: ${fps}`;
        
        // Color code based on performance
        if (fps > 45) {
            fpsDisplay.style.color = '#00ff00'; // Green for good performance
        } else if (fps > 30) {
            fpsDisplay.style.color = '#ffff00'; // Yellow for acceptable performance
        } else {
            fpsDisplay.style.color = '#ff0000'; // Red for poor performance
        }
        
        // Add detailed timings when performance is low
        if (fps < 15) {
            window.perfStats = window.perfStats || {};
        }
        
        // Show performance help when FPS is very low
        if (fps < 5) {
            showPerformanceHelp();
        }
    }
    
    lastFrameTime = currentTime;
    
    // Skip animation if game is paused
    if (gameState !== 'playing') {
        // Render one frame when paused
        if (composer && composer.passes.length > 0) {
            composer.render();
        } else {
            renderer.render(scene, camera);
        }
        return;
    }
    
    // Create frustum for culling
    const frustum = new THREE.Frustum();
    const projScreenMatrix = new THREE.Matrix4();
    projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(projScreenMatrix);
    
    // Measure time for ship and camera updates
    const updateStartTime = performance.now();
    
    // Update player ship movement and camera
    updateShipMovement();
    updateCameraPosition();
    
    // Apply frustum culling to buildings
    applyBuildingFrustumCulling(frustum);
    
    const updateEndTime = performance.now();
    
    // Measure time for collision and game logic
    const logicStartTime = performance.now();
    
    // Update drones - only process drones in view frustum
    const playerPos = ship.position.clone();
    const visibleRadius = 150; // Only process objects within this radius
    
    // Performance optimization: Only process drones within visible radius or in frustum
    for (let i = 0; i < drones.length; i++) {
        const drone = drones[i];
        
        // Skip if drone is too far away from player
        if (drone.position.distanceTo(playerPos) > visibleRadius) {
            // If drone is far away, just hide it instead of calculating frustum
            drone.mesh.visible = false;
            continue;
        }
        
        // For closer drones, use frustum culling
        const dronePos = drone.position.clone();
        const sphereRadius = 5; // Approximate drone radius
        const sphere = new THREE.Sphere(dronePos, sphereRadius);
        
        // Check if drone is in view frustum
        drone.mesh.visible = frustum.intersectsSphere(sphere);
        
        // Only update drones that are visible
        if (drone.mesh.visible) {
            // This is a simplified individual drone update
            // Only process pursuit/movement for visible drones
            const distanceToPlayer = drone.position.distanceTo(ship.position);
            
            // Start pursuing if player is within detection radius
            if (distanceToPlayer < DRONE_DETECTION_RADIUS) {
                drone.isPursuing = true;
            } else if (distanceToPlayer > DRONE_DETECTION_RADIUS * 1.5) {
                drone.isPursuing = false;
            }
            
            // Calculate movement direction
            const direction = new THREE.Vector3();
            
            if (drone.isPursuing) {
                direction.subVectors(ship.position, drone.position).normalize();
                drone.velocity.copy(direction).multiplyScalar(DRONE_PURSUIT_SPEED);
            } else {
                direction.subVectors(drone.patrolTarget, drone.position).normalize();
                
                // If close to target, pick a new random target
                if (drone.position.distanceTo(drone.patrolTarget) < 5) {
                    drone.patrolTarget.set(
                        Math.random() * CITY_SIZE - CITY_SIZE / 2,
                        Math.random() * 50 + 10,
                        Math.random() * CITY_SIZE - CITY_SIZE / 2
                    );
                }
                
                drone.velocity.copy(direction).multiplyScalar(DRONE_PATROL_SPEED);
            }
            
            // Update position
            drone.position.add(drone.velocity);
            
            // Apply height limits
            drone.position.y = Math.max(5, Math.min(80, drone.position.y));
            
            // Update the drone mesh position
            drone.mesh.position.copy(drone.position);
            
            // Smoothly rotate to face movement direction
            if (drone.velocity.length() > 0.01) {
                const targetRotation = new THREE.Quaternion();
                const lookAtPosition = new THREE.Vector3().copy(drone.position).add(drone.velocity);
                
                const tempMatrix = new THREE.Matrix4();
                tempMatrix.lookAt(drone.position, lookAtPosition, new THREE.Vector3(0, 1, 0));
                targetRotation.setFromRotationMatrix(tempMatrix);
                
                drone.mesh.quaternion.slerp(targetRotation, 0.1);
            }
        }
    }
    
    // Check for collisions (only with visible objects)
    checkBuildingCollisions();
    checkDroneCollisions();
    checkFragmentCollisions();
    
    const logicEndTime = performance.now();
    
    // Measure projectile update time
    const projectileStartTime = performance.now();
    
    // Update projectiles with frustum culling
    updateProjectiles();
    
    const projectileEndTime = performance.now();
    
    // Measure UI update time
    const uiStartTime = performance.now();
    
    // Update weapon cooldown indicator
    if (weaponCooldown) {
        const cooldownBar = document.getElementById('cooldown-bar');
        const timeSinceFire = Date.now() - lastFireTime;
        const cooldownPercent = Math.min(100, (timeSinceFire / WEAPON_COOLDOWN_TIME) * 100);
        
        if (cooldownBar) {
            cooldownBar.style.width = cooldownPercent + '%';
        }
        
        if (timeSinceFire >= WEAPON_COOLDOWN_TIME) {
            weaponCooldown = false;
            const cooldownText = document.getElementById('cooldown-text');
            if (cooldownText) {
                cooldownText.textContent = 'READY';
                cooldownText.style.color = '#3f3';
                cooldownText.style.textShadow = '0 0 5px #0f0';
            }
        }
    }
    
    // Update debug panel if enabled
    if (debugMode) {
        updateDebugPanel();
    }
    
    // Update visual effects (limited to visible objects)
    updateVisualEffects();
    
    // Update indicators
    updateIndicators();
    
    const uiEndTime = performance.now();
    
    // Measure render time
    const renderStartTime = performance.now();
    
    // Render scene
    if (composer && composer.passes.length > 0) {
        composer.render();
    } else {
        renderer.render(scene, camera);
    }
    
    const renderEndTime = performance.now();
    const frameEndTime = performance.now();
    
    // Update performance stats when FPS is low
    if (fps < 15 && frameEndTime - frameStartTime > 50) {
        const perfStats = window.perfStats || {};
        perfStats.total = frameEndTime - frameStartTime;
        perfStats.update = updateEndTime - updateStartTime;
        perfStats.logic = logicEndTime - logicStartTime;
        perfStats.projectiles = projectileEndTime - projectileStartTime;
        perfStats.ui = uiEndTime - uiStartTime;
        perfStats.render = renderEndTime - renderStartTime;
        
        // Add to debug panel if visible
        if (debugMode) {
            const debugPanel = document.getElementById('debug-panel');
            if (debugPanel) {
                debugPanel.style.display = 'block';
                debugPanel.innerHTML = `
                    <h3>Performance</h3>
                    <p>Total: ${perfStats.total.toFixed(2)}ms</p>
                    <p>Update: ${perfStats.update.toFixed(2)}ms</p>
                    <p>Logic: ${perfStats.logic.toFixed(2)}ms</p>
                    <p>Projectiles: ${perfStats.projectiles.toFixed(2)}ms</p>
                    <p>UI: ${perfStats.ui.toFixed(2)}ms</p>
                    <p>Render: ${perfStats.render.toFixed(2)}ms</p>
                    <p>Objects: ${scene.children.length}</p>
                    <p>Drones visible: ${drones.filter(d => d.mesh.visible).length}</p>
                    <p>Buildings visible: ${buildings.filter(b => b.mesh && b.mesh.visible).length}</p>
                `;
            }
        }
        
        // Update the global stats object for reference
        window.perfStats = perfStats;
    }
}

// Start weapon cooldown with enforced delay
function startWeaponCooldown() {
    weaponCooldown = true;
    lastFireTime = Date.now();
    
    // Update UI
    const cooldownBar = document.getElementById('cooldown-bar');
    if (cooldownBar) {
        cooldownBar.style.width = '0%';
    }
    
    const cooldownText = document.getElementById('cooldown-text');
    if (cooldownText) {
        cooldownText.textContent = 'CHARGING';
        cooldownText.style.color = '#aa55ff';
    }
}

// Create a circular gradient texture for fire particles
function createFireParticleTexture() {
    const canvas = document.createElement('canvas');
    const size = 256; // Larger texture for higher quality
    canvas.width = size;
    canvas.height = size;
    
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, size, size);
    
    // Create primary flame gradient
    const flameGradient = context.createRadialGradient(
        size / 2, size / 2, 0,
        size / 2, size / 2, size / 2
    );
    
    // Color stops for realistic fire with smoother transitions
    flameGradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)');   // Core - pure white
    flameGradient.addColorStop(0.05, 'rgba(255, 255, 220, 1.0)'); // Near core - slight yellow tint
    flameGradient.addColorStop(0.15, 'rgba(255, 240, 150, 0.95)'); // Yellow flame
    flameGradient.addColorStop(0.25, 'rgba(255, 210, 80, 0.9)');  // Golden yellow
    flameGradient.addColorStop(0.35, 'rgba(255, 180, 50, 0.85)'); // Deep yellow
    flameGradient.addColorStop(0.45, 'rgba(255, 140, 30, 0.8)');  // Orange
    flameGradient.addColorStop(0.6, 'rgba(255, 80, 10, 0.6)');    // Red-orange
    flameGradient.addColorStop(0.75, 'rgba(200, 40, 5, 0.4)');    // Dark red
    flameGradient.addColorStop(0.9, 'rgba(150, 20, 5, 0.2)');     // Very dark red
    flameGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');            // Fully transparent
    
    // Fill with primary flame gradient
    context.fillStyle = flameGradient;
    context.fillRect(0, 0, size, size);
    
    // Add a secondary hotter core
    const coreGradient = context.createRadialGradient(
        size / 2, size / 2, 0,
        size / 2, size / 2, size * 0.25
    );
    coreGradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
    coreGradient.addColorStop(0.5, 'rgba(255, 255, 220, 0.5)');
    coreGradient.addColorStop(1, 'rgba(255, 255, 200, 0)');
    
    // Overlay the core
    context.globalCompositeOperation = 'lighter';
    context.fillStyle = coreGradient;
    context.fillRect(0, 0, size, size);
    context.globalCompositeOperation = 'source-over';
    
    // Create noise texture for realism
    const noiseCanvas = document.createElement('canvas');
    noiseCanvas.width = size;
    noiseCanvas.height = size;
    const noiseContext = noiseCanvas.getContext('2d');
    
    // Create noise pattern
    const noiseData = noiseContext.createImageData(size, size);
    const noisePixels = noiseData.data;
    
    for (let i = 0; i < noisePixels.length; i += 4) {
        // Calculate distance from center (for circular mask)
        const x = (i / 4) % size;
        const y = Math.floor((i / 4) / size);
        const distX = x - size / 2;
        const distY = y - size / 2;
        const dist = Math.sqrt(distX * distX + distY * distY) / (size / 2); // 0 to 1
        
        // More noise near edges, less in center
        const noiseFactor = 0.2 + (dist * 0.4);
        const noise = Math.random() * noiseFactor;
        
        // Apply radial mask to noise (more in middle, less at edges)
        const mask = Math.max(0, 1 - dist);
        
        // Set noise value with mask
        const value = Math.floor(200 + noise * 55) * mask;
        
        noisePixels[i] = value;     // Red channel
        noisePixels[i + 1] = value; // Green channel
        noisePixels[i + 2] = value; // Blue channel
        noisePixels[i + 3] = value; // Alpha channel - transparent where dark
    }
    
    noiseContext.putImageData(noiseData, 0, 0);
    
    // Apply noise to main canvas with overlay blend
    context.globalCompositeOperation = 'overlay';
    context.globalAlpha = 0.4; // Subtle noise effect
    context.drawImage(noiseCanvas, 0, 0, size, size);
    
    // Add subtle direction hint (brighten top, darken bottom)
    const dirGradient = context.createLinearGradient(0, 0, 0, size);
    dirGradient.addColorStop(0, 'rgba(255, 255, 255, 0.1)'); // Brighten top slightly
    dirGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0)'); // No change in middle
    dirGradient.addColorStop(1, 'rgba(0, 0, 0, 0.1)');      // Darken bottom slightly
    
    context.globalCompositeOperation = 'overlay';
    context.fillStyle = dirGradient;
    context.fillRect(0, 0, size, size);
    
    // Reset blend mode
    context.globalCompositeOperation = 'source-over';
    context.globalAlpha = 1.0;
    
    // Create texture with high-quality settings
    const texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter; // High quality filtering
    texture.magFilter = THREE.LinearFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    
    return texture;
}

// Start the game
// The init game is now triggered by the module imports, so we don't need this
window.addEventListener('load', function() {
    console.log("Page loaded, waiting for modules to load...");
    // We've moved initialization to happen after modules load
}); 

// Add spaceship quality testing function - add this after setupEventListeners function
function testSpaceshipQuality() {
    // Create test UI controls
    const testPanel = document.createElement('div');
    testPanel.id = 'spaceship-test-panel';
    testPanel.style.position = 'fixed';
    testPanel.style.top = '20px';
    testPanel.style.right = '20px';
    testPanel.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    testPanel.style.padding = '15px';
    testPanel.style.borderRadius = '5px';
    testPanel.style.border = '1px solid #0ff';
    testPanel.style.color = '#0ff';
    testPanel.style.zIndex = '1000';
    testPanel.style.fontFamily = 'monospace';
    
    // Add title
    const title = document.createElement('h3');
    title.textContent = 'Spaceship Quality Test';
    title.style.margin = '0 0 10px 0';
    title.style.fontSize = '14px';
    testPanel.appendChild(title);
    
    // Add quality level slider
    const sliderContainer = document.createElement('div');
    sliderContainer.style.marginBottom = '10px';
    
    const sliderLabel = document.createElement('label');
    sliderLabel.textContent = 'Quality Level: ';
    sliderLabel.style.fontSize = '12px';
    sliderContainer.appendChild(sliderLabel);
    
    const qualityValue = document.createElement('span');
    qualityValue.id = 'quality-value';
    qualityValue.textContent = '1';
    qualityValue.style.fontSize = '12px';
    qualityValue.style.marginLeft = '5px';
    sliderContainer.appendChild(qualityValue);
    
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '1';
    slider.max = '3';
    slider.value = '1';
    slider.step = '1';
    slider.id = 'quality-slider';
    slider.style.width = '100%';
    slider.style.marginTop = '5px';
    
    slider.addEventListener('input', function() {
        const qualityLevel = parseInt(this.value, 10);
        qualityValue.textContent = qualityLevel;
        createPlayerShip(qualityLevel);
    });
    
    sliderContainer.appendChild(slider);
    testPanel.appendChild(sliderContainer);
    
    // Add apply button
    const applyButton = document.createElement('button');
    applyButton.textContent = 'Apply & Close';
    applyButton.style.backgroundColor = '#0ff';
    applyButton.style.color = '#000';
    applyButton.style.border = 'none';
    applyButton.style.padding = '5px 10px';
    applyButton.style.borderRadius = '3px';
    applyButton.style.cursor = 'pointer';
    applyButton.style.width = '100%';
    
    applyButton.addEventListener('click', function() {
        // Save the current quality level setting
        const qualityLevel = parseInt(document.getElementById('quality-slider').value, 10);
        localStorage.setItem('spaceshipQualityLevel', qualityLevel);
        
        // Remove the test panel
        document.body.removeChild(testPanel);
        
        // Ensure we're using the selected quality level
        createPlayerShip(qualityLevel);
    });
    
    testPanel.appendChild(applyButton);
    document.body.appendChild(testPanel);
}

// Update initGame function to load saved quality level
function updateQualityFromSaved() {
    const savedQualityLevel = parseInt(localStorage.getItem('spaceshipQualityLevel') || '3', 10);
    createPlayerShip(savedQualityLevel);
    console.log(`Applied saved quality level: ${savedQualityLevel}`);
}

// Toggle control panel visibility
function toggleControlPanel() {
    // Only toggle if in playing or paused state
    if (gameState === 'playing' || gameState === 'paused') {
        controlPanelVisible = !controlPanelVisible;
        
        // Get the control panel element
        const controlPanel = document.getElementById('left-controls-panel');
        
        // Update visibility
        if (controlPanel) {
            controlPanel.style.display = controlPanelVisible ? 'block' : 'none';
            
            // Add a subtle animation effect when showing/hiding
            if (controlPanelVisible) {
                controlPanel.style.opacity = '0';
                controlPanel.style.transform = 'translateX(-20px)';
                controlPanel.style.transition = 'opacity 0.3s ease-in-out, transform 0.3s ease-in-out';
                
                // Trigger reflow to ensure transition applies
                void controlPanel.offsetWidth;
                
                controlPanel.style.opacity = '1';
                controlPanel.style.transform = 'translateX(0)';
            }
            
            // Play a UI sound for feedback
            playSound('ui');
            
            // Show temporary notification
            const notification = document.createElement('div');
            notification.textContent = controlPanelVisible ? 
                'Controls Panel: VISIBLE [Press C to hide]' : 
                'Controls Panel: HIDDEN [Press C to show]';
            notification.style.position = 'fixed';
            notification.style.top = '120px';
            notification.style.left = '20px';
            notification.style.padding = '10px';
            notification.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
            notification.style.color = '#0ff';
            notification.style.border = '1px solid #0ff';
            notification.style.boxShadow = '0 0 10px #0ff';
            notification.style.fontFamily = 'monospace';
            notification.style.fontSize = '14px';
            notification.style.zIndex = '9999';
            notification.style.opacity = '0';
            notification.style.transform = 'translateY(-10px)';
            notification.style.transition = 'opacity 0.3s ease-in-out, transform 0.3s ease-in-out';
            
            document.body.appendChild(notification);
            
            // Trigger reflow to ensure transition applies
            void notification.offsetWidth;
            
            notification.style.opacity = '1';
            notification.style.transform = 'translateY(0)';
            
            // Remove notification after 2 seconds
            setTimeout(() => {
                notification.style.opacity = '0';
                notification.style.transform = 'translateY(-10px)';
                
                setTimeout(() => {
                    if (notification.parentNode) {
                        document.body.removeChild(notification);
                    }
                }, 300);
            }, 2000);
        }
    }
}

// Create an energy conduit through the center of the city
function createEnergyConductFloor() {
    // Create a conduit along Z axis (north-south) only
    const zConduitGeometry = new THREE.PlaneGeometry(ENERGY_CONDUIT_WIDTH, CITY_SIZE * 2, 8, 64);
    const zConduitMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x00aaff, 
        roughness: 0.1,
        metalness: 0.8,
        emissive: 0x0088ff,
        emissiveIntensity: 0.8,
        transparent: true,
        opacity: 0.8
    });
    
    const zConduit = new THREE.Mesh(zConduitGeometry, zConduitMaterial);
    zConduit.rotation.x = -Math.PI / 2;
    zConduit.position.y = -0.3; // Slightly above the ground
    zConduit.position.x = 0; // Center of city
    scene.add(zConduit);
    
    // Add energy pulse animation
    createEnergyPulseEffectForZAxis(zConduit);
    
    // Store conduit dimensions for collision detection
    // Keep X-axis dimensions for future feature - "FUTURE_TRANSIT_SYSTEM"
    window.energyConduit = {
        xMin: -CITY_SIZE,         // X-axis reserved for FUTURE_TRANSIT_SYSTEM
        xMax: CITY_SIZE,          // X-axis reserved for FUTURE_TRANSIT_SYSTEM
        zMin: -ENERGY_CONDUIT_WIDTH/2,
        zMax: ENERGY_CONDUIT_WIDTH/2,
        x2Min: -ENERGY_CONDUIT_WIDTH/2,
        x2Max: ENERGY_CONDUIT_WIDTH/2,
        z2Min: -CITY_SIZE,
        z2Max: CITY_SIZE
    };
    
    // Create a named reservation for the X-axis path
    window.FUTURE_TRANSIT_SYSTEM = {
        width: ENERGY_CONDUIT_WIDTH,
        xMin: -CITY_SIZE,
        xMax: CITY_SIZE,
        zMin: -ENERGY_CONDUIT_WIDTH/2,
        zMax: ENERGY_CONDUIT_WIDTH/2,
        isActive: false,
        type: "transitCorridor"
    };
    
    // Create X-MACHINA HUB at the beginning of X-axis
    createXMachinaHub();
    
    console.log("Created energy conduit on Z-axis and reserved X-axis for FUTURE_TRANSIT_SYSTEM");
}

// Create pulsing energy effect for the Z-axis conduit
function createEnergyPulseEffectForZAxis(zConduit) {
    const pulseTexture = new THREE.TextureLoader().load('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==');
    
    // Create a shader material for energy pulse
    const pulseShader = {
        uniforms: {
            time: { value: 1.0 },
            baseTexture: { value: pulseTexture }
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform float time;
            uniform sampler2D baseTexture;
            varying vec2 vUv;
            
            void main() {
                float pulse = sin(vUv.x * 20.0 + time * 2.0) * 0.5 + 0.5;
                vec3 color = vec3(0.0, 0.5 + 0.5 * pulse, 1.0);
                gl_FragColor = vec4(color, 0.7 * pulse);
            }
        `
    };
    
    const pulseMaterial = new THREE.ShaderMaterial(pulseShader);
    pulseMaterial.transparent = true;
    
    // Apply to conduit
    zConduit.material = pulseMaterial;
    
    // Animate the pulse
    function animatePulse() {
        pulseMaterial.uniforms.time.value = performance.now() * 0.001;
        requestAnimationFrame(animatePulse);
    }
    
    animatePulse();
}

// Create the X-MACHINA HUB - AI system controlling Aurora Prime
async function createXMachinaHub() {
    // Position at the western edge of the X-axis (keeping your original coordinates)
    const hubX = -CITY_SIZE/2 + 40; // 40 units in from the edge
    const hubZ = 0; // Centered on Z-axis
    
    // Create the main hub structure
    const hubGroup = new THREE.Group();
    hubGroup.position.set(hubX, 0, hubZ); // Set the position for the entire group
    
    // Base platform with energized ring
    const basePlatformGeometry = new THREE.CylinderGeometry(40, 40, 5, 64);
    const basePlatformMaterial = new THREE.MeshStandardMaterial({
        color: 0x111111,
        roughness: 0.3,
        metalness: 0.9,
        emissive: 0x003366,
        emissiveIntensity: 0.2
    });
    
    const basePlatform = new THREE.Mesh(basePlatformGeometry, basePlatformMaterial);
    basePlatform.position.y = 2.5; // Slightly above ground
    basePlatform.receiveShadow = true;
    hubGroup.add(basePlatform);
    
    // Add outer glowing edge ring to base platform
    const edgeGeometry = new THREE.TorusGeometry(40, 2, 20, 100);
    const edgeMaterial = new THREE.MeshStandardMaterial({
        color: 0xff0000,
        emissive: 0xff0000,
        emissiveIntensity: 2.0,
        transparent: true,
        opacity: 0.8
    });
    
    const edgeRing = new THREE.Mesh(edgeGeometry, edgeMaterial);
    edgeRing.rotation.x = Math.PI / 2;
    edgeRing.position.y = 5;
    hubGroup.add(edgeRing);

    // Add inner ring
    const innerRingGeometry = new THREE.TorusGeometry(30, 1.5, 20, 100);
    const innerRingMaterial = new THREE.MeshStandardMaterial({
        color: 0xff3333,
        emissive: 0xff3333,
        emissiveIntensity: 2.0,
        transparent: true,
        opacity: 0.8
    });
    
    const innerRing = new THREE.Mesh(innerRingGeometry, innerRingMaterial);
    innerRing.rotation.x = Math.PI / 2;
    innerRing.position.y = 5;
    hubGroup.add(innerRing);
    
    // Main tower
    const towerHeight = 100; // Reduced to 100 units
    const towerRadius = 30;  // Wide enough to dominate the cityscape
    const towerGeometry = new THREE.CylinderGeometry(towerRadius, towerRadius, towerHeight, 32);
    const towerMaterial = new THREE.MeshStandardMaterial({
        color: 0x000000,
        roughness: 0.1,
        metalness: 0.9,
        emissive: 0x000000
    });
    
    const tower = new THREE.Mesh(towerGeometry, towerMaterial);
    tower.position.y = towerHeight/2 + 5;
    tower.castShadow = true;
    hubGroup.add(tower);

    // Add top sphere
    const topSphereGeometry = new THREE.SphereGeometry(15, 32, 32);
    const topSphereMaterial = new THREE.MeshStandardMaterial({
        color: 0xff0000,
        emissive: 0xff0000,
        emissiveIntensity: 1.5,
        metalness: 0.9,
        roughness: 0.2
    });
    
    const topSphere = new THREE.Mesh(topSphereGeometry, topSphereMaterial);
    topSphere.position.y = towerHeight + 5;
    hubGroup.add(topSphere);

    // Add sphere glow
    const sphereGlowGeometry = new THREE.SphereGeometry(16, 32, 32);
    const sphereGlowMaterial = new THREE.MeshBasicMaterial({
        color: 0xff0000,
        transparent: true,
        opacity: 0.3,
        side: THREE.BackSide
    });
    
    const sphereGlow = new THREE.Mesh(sphereGlowGeometry, sphereGlowMaterial);
    sphereGlow.position.copy(topSphere.position);
    hubGroup.add(sphereGlow);

    // Add energy beam
    const beamGeometry = new THREE.CylinderGeometry(2, 2, towerHeight, 16);
    const beamMaterial = new THREE.MeshBasicMaterial({
        color: 0xff0000,
        transparent: true,
        opacity: 0.5,
        emissive: 0xff0000,
        emissiveIntensity: 2.0
    });
    
    const beam = new THREE.Mesh(beamGeometry, beamMaterial);
    beam.position.y = towerHeight/2 + 5;
    hubGroup.add(beam);
    
    // Create neon text with proper font loading
    try {
        const font = await new Promise((resolve, reject) => {
            const fontLoader = new FontLoader();
            fontLoader.load(
                'https://threejs.org/examples/fonts/helvetiker_bold.typeface.json',
                resolve,
                undefined,
                reject
            );
        });

        const angles = [0, Math.PI/2, Math.PI, -Math.PI/2]; // Four sides
        angles.forEach(angle => {
            const textGeometry = new TextGeometry("X-MACHINA", {
                font: font,
                size: 8,
                height: 0.5,
                curveSegments: 32,
                bevelEnabled: true,
                bevelThickness: 0.2,
                bevelSize: 0.1,
                bevelSegments: 8
            });
            
            textGeometry.center();
            
            const textMaterial = new THREE.MeshBasicMaterial({
                color: 0xff0000,
                transparent: true,
                opacity: 0.9
            });
            
            const neonText = new THREE.Mesh(textGeometry, textMaterial);
            neonText.position.y = towerHeight * 0.6;
            neonText.position.x = Math.cos(angle) * (towerRadius + 2);
            neonText.position.z = Math.sin(angle) * (towerRadius + 2);
            neonText.rotation.y = angle + Math.PI/2;
            
            // Add userData for animation
            neonText.userData = {
                flickerSpeed: 1 + Math.random() * 0.5,
                flickerIntensity: 0.2,
                originalIntensity: 1.0
            };
            
            const textGlowMaterial = new THREE.MeshBasicMaterial({
                color: 0xff0000,
                transparent: true,
                opacity: 0.4,
                side: THREE.BackSide,
                blending: THREE.AdditiveBlending
            });
            
            const textGlow = neonText.clone();
            textGlow.material = textGlowMaterial;
            textGlow.scale.multiplyScalar(1.1);
            textGlow.userData = {
                flickerSpeed: neonText.userData.flickerSpeed,
                flickerIntensity: 0.3,
                originalOpacity: 0.4
            };
            
            const textLight = new THREE.PointLight(0xff0000, 1, 20);
            textLight.position.copy(neonText.position);
            textLight.userData = {
                flickerSpeed: neonText.userData.flickerSpeed,
                flickerIntensity: 0.2,
                originalIntensity: 1.0
            };
            
            hubGroup.add(neonText);
            hubGroup.add(textGlow);
            hubGroup.add(textLight);
        });
    } catch (error) {
        console.error("Error loading font:", error);
    }
    
    // Add the hub group to the scene
    scene.add(hubGroup);
    console.log("X-MACHINA Hub added to scene at position:", hubX, 0, hubZ);
    
    // Start the animation
    animateXMachinaHub(hubGroup, edgeRing, innerRing, topSphere, beamMaterial, sphereGlow);
    
    return hubGroup;
}

// Update the animation function to handle the new neon text effects
function animateXMachinaHub(hubGroup, edgeRing, innerRing, topSphere, beamMaterial, sphereGlow) {
    // Animate energy lines and other elements
    function animateHub() {
        const time = performance.now() * 0.001;
        
        // Pulse the edge rings with offset timings for more dynamic effect
        edgeRing.material.emissiveIntensity = 2.5 + Math.sin(time) * 0.8;
        innerRing.material.emissiveIntensity = 2.0 + Math.sin(time * 1.2 + 0.5) * 0.7;
        
        // Pulse the beam with more dramatic effect
        beamMaterial.opacity = 0.5 + Math.sin(time * 2) * 0.4;
        beamMaterial.emissiveIntensity = 2.5 + Math.sin(time * 1.5) * 0.8;
        
        // Pulse the top sphere and its glow
        topSphere.material.emissiveIntensity = 1.5 + Math.sin(time * 1.5) * 0.5;
        sphereGlow.material.opacity = 0.3 + Math.sin(time * 2.2) * 0.2;
        
        // Animate all the different elements
        hubGroup.children.forEach(child => {
            // Animate neon sign text core with flicker effect
            if (child.userData && child.userData.flickerSpeed !== undefined && child.userData.originalIntensity !== undefined) {
                const flickerEffect = child.userData.originalIntensity * 
                    (1 + child.userData.flickerIntensity * (Math.random() - 0.5) * Math.sin(time * child.userData.flickerSpeed * 10));
                
                if (child.material) {
                    child.material.emissiveIntensity = flickerEffect;
                }
            }
            
            // Animate neon glow layers with opacity flicker
            if (child.userData && child.userData.flickerSpeed !== undefined && child.userData.originalOpacity !== undefined) {
                const opacityFlicker = child.userData.originalOpacity * 
                    (1 + child.userData.flickerIntensity * (Math.random() - 0.5) * Math.sin(time * child.userData.flickerSpeed * 10));
                
                if (child.material) {
                    child.material.opacity = opacityFlicker;
                }
            }
            
            // Animate point lights for the neon letters
            if (child.type === 'PointLight' && child.userData && child.userData.flickerSpeed !== undefined) {
                const intensityFlicker = child.userData.originalIntensity * 
                    (1 + child.userData.flickerIntensity * (Math.random() - 0.5) * Math.sin(time * child.userData.flickerSpeed * 15));
                
                child.intensity = intensityFlicker;
            }
        });
        
        requestAnimationFrame(animateHub);
    }
    
    animateHub();
}

// Create additional tall buildings to enhance the cityscape
function createTallBuildings() {
    console.log("Adding 10 additional tall buildings to the cityscape");
    
    // Number of tall buildings to add
    const tallBuildingCount = 10;
    
    for (let i = 0; i < tallBuildingCount; i++) {
        // Tall building size - focusing on height
        const width = 10 + Math.random() * 10;
        const height = 80 + Math.random() * 60; // Very tall (80-140 units)
        const depth = 10 + Math.random() * 10;
        
        // Random position
        let x, z;
        let intersectsConduit = true;
        let intersectsBuilding = true;
        let attempts = 0;
        
        // Try to find a position that doesn't intersect with the energy conduit or other buildings
        while ((intersectsConduit || intersectsBuilding) && attempts < 50) {
            x = Math.random() * CITY_SIZE - CITY_SIZE/2;
            z = Math.random() * CITY_SIZE - CITY_SIZE/2;
            
            // Check if building intersects with the energy conduit corridors
            intersectsConduit = (
                // Check intersection with X-axis conduit
                (z > -ENERGY_CONDUIT_WIDTH/2 && z < ENERGY_CONDUIT_WIDTH/2 && 
                 x > -CITY_SIZE/2 && x < CITY_SIZE/2) ||
                // Check intersection with Z-axis conduit
                (x > -ENERGY_CONDUIT_WIDTH/2 && x < ENERGY_CONDUIT_WIDTH/2 && 
                 z > -CITY_SIZE/2 && z < CITY_SIZE/2)
            );
            
            // Also account for building width/depth (half dimensions from center point)
            if (!intersectsConduit) {
                const halfWidth = width / 2;
                const halfDepth = depth / 2;
                
                intersectsConduit = (
                    // X-axis conduit intersection with building boundaries
                    (z + halfDepth > -ENERGY_CONDUIT_WIDTH/2 && z - halfDepth < ENERGY_CONDUIT_WIDTH/2 &&
                     x > -CITY_SIZE/2 && x < CITY_SIZE/2) ||
                    // Z-axis conduit intersection with building boundaries  
                    (x + halfWidth > -ENERGY_CONDUIT_WIDTH/2 && x - halfWidth < ENERGY_CONDUIT_WIDTH/2 &&
                     z > -CITY_SIZE/2 && z < CITY_SIZE/2)
                );
            }
            
            // Check if building intersects with existing buildings
            intersectsBuilding = false;
            if (!intersectsConduit) {
                const halfWidth = width / 2;
                const halfDepth = depth / 2;
                
                for (const existingBuilding of buildings) {
                    const exHalfWidth = existingBuilding.width / 2;
                    const exHalfDepth = existingBuilding.depth / 2;
                    
                    // Check for intersection
                    if (
                        x + halfWidth > existingBuilding.x - exHalfWidth &&
                        x - halfWidth < existingBuilding.x + exHalfWidth &&
                        z + halfDepth > existingBuilding.z - exHalfDepth &&
                        z - halfDepth < existingBuilding.z + exHalfDepth
                    ) {
                        intersectsBuilding = true;
                        break;
                    }
                }
            }
            
            attempts++;
        }
        
        // If we couldn't find a non-intersecting position after max attempts, skip this building
        if (intersectsConduit || intersectsBuilding) {
            console.log("Couldn't place tall building without intersections after max attempts, skipping");
            continue;
        }
        
        // Create building geometry with a more interesting shape
        let buildingGroup = new THREE.Group();
        
        // Main building body
        const lowerHeight = height * 0.7; // 70% of total height
        const upperHeight = height * 0.3; // 30% of total height
        const upperWidth = width * 0.7; // 70% of lower width
        const upperDepth = depth * 0.7; // 70% of lower depth
        
        // Lower section
        const lowerGeometry = new THREE.BoxGeometry(width, lowerHeight, depth);
        
        // Choose a color (intense cyan to blue)
        const hue = 180 + Math.random() * 40; // 180-220 (cyan to blue)
        const saturation = 70 + Math.random() * 30; // 70-100%
        const lightness = 25 + Math.random() * 20; // 25-45%
        const color = new THREE.Color(`hsl(${hue}, ${saturation}%, ${lightness}%)`);
        
        // More striking building material for the iconic buildings
        const buildingMaterial = new THREE.MeshStandardMaterial({
            color: color,
            roughness: 0.05,  // Very smooth surface for glass
            metalness: 0.2, // More metallic sheen
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide
        });
        
        // Create window pattern material with brighter glow
        const windowsMaterial = new THREE.MeshStandardMaterial({
            color: new THREE.Color(`hsl(${hue}, ${saturation}%, ${lightness + 55}%)`),
            emissive: new THREE.Color(`hsl(${hue}, ${saturation}%, ${lightness + 55}%)`),
            emissiveIntensity: 1.5,
            roughness: 0.1,
            metalness: 0.1,
            transparent: true,
            opacity: 0.95
        });
        
        // Lower section
        const lowerSection = new THREE.Mesh(lowerGeometry, buildingMaterial);
        lowerSection.position.y = lowerHeight / 2;
        buildingGroup.add(lowerSection);
        
        // Upper section (setback design)
        const upperGeometry = new THREE.BoxGeometry(upperWidth, upperHeight, upperDepth);
        const upperSection = new THREE.Mesh(upperGeometry, buildingMaterial);
        upperSection.position.y = lowerHeight + upperHeight / 2;
        buildingGroup.add(upperSection);
        
        // Add window lights using planes on building faces
        addWindowsToBuilding(buildingGroup, width, lowerHeight, depth, windowsMaterial);
        addWindowsToBuilding(upperSection, upperWidth, upperHeight, upperDepth, windowsMaterial);
        
        // Add a special antenna or spire to the top of some buildings
        if (Math.random() > 0.3) {
            const antennaHeight = 10 + Math.random() * 20;
            const antennaGeometry = new THREE.CylinderGeometry(0.5, 0.5, antennaHeight, 8);
            const antennaMaterial = new THREE.MeshStandardMaterial({
                color: 0xcccccc,
                roughness: 0.3,
                metalness: 0.8
            });
            const antenna = new THREE.Mesh(antennaGeometry, antennaMaterial);
            antenna.position.y = lowerHeight + upperHeight + antennaHeight / 2;
            buildingGroup.add(antenna);
            
            // Add blinking light at the top
            const blinkLightGeometry = new THREE.SphereGeometry(1, 16, 16);
            const blinkLightMaterial = new THREE.MeshBasicMaterial({
                color: 0xff0000,
                emissive: 0xff0000,
                emissiveIntensity: 2
            });
            const blinkLight = new THREE.Mesh(blinkLightGeometry, blinkLightMaterial);
            blinkLight.position.y = lowerHeight + upperHeight + antennaHeight + 0.5;
            
            // Add blinking animation
            blinkLight.userData.blink = {
                intensity: 2,
                minIntensity: 0.1,
                maxIntensity: 2,
                speed: 0.5 + Math.random() * 1.5,
                increasing: false
            };
            
            buildingGroup.add(blinkLight);
        }
        
        // Position the building
        buildingGroup.position.set(x, 0, z);
        
        // Add slight random rotation for variety
        buildingGroup.rotation.y = Math.random() * Math.PI * 0.25;
        
        buildingGroup.castShadow = true;
        buildingGroup.receiveShadow = true;
        
        // Save building dimensions and position for collision detection
        buildings.push({
            mesh: buildingGroup,
            width: width,
            height: height,
            depth: depth,
            x: x,
            z: z,
            isTallBuilding: true
        });
        
        scene.add(buildingGroup);
    }
    
    console.log("Added tall buildings. Total building count:", buildings.length);
}

// Create a pool of floating text elements to reuse
function initFloatingTextPool() {
    for (let i = 0; i < FLOATING_TEXT_POOL_SIZE; i++) {
        const textElement = document.createElement('div');
        textElement.className = 'floating-text';
        textElement.style.position = 'fixed';
        textElement.style.fontFamily = 'Orbitron, sans-serif';
        textElement.style.fontWeight = 'bold';
        textElement.style.zIndex = '100';
        textElement.style.pointerEvents = 'none';
        textElement.style.opacity = '0'; // Start hidden
        textElement.style.display = 'none'; // Hide initially
        document.body.appendChild(textElement);
        
        floatingTextPool.push({
            element: textElement,
            active: false
        });
    }
}

// Simplified update for projectiles with enhanced effects and frustum culling
function updateProjectiles() {
    if (gameState !== 'playing') return;
    
    const currentTime = Date.now();
    
    // Create frustum for culling
    const frustum = new THREE.Frustum();
    const projScreenMatrix = new THREE.Matrix4();
    projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(projScreenMatrix);
    
    // Update weapon cooldown UI
    if (weaponCooldown) {
        const elapsedTime = currentTime - lastFireTime;
        const cooldownPercent = Math.min(100, (elapsedTime / WEAPON_COOLDOWN_TIME) * 100);
        
        const cooldownBar = document.getElementById('cooldown-bar');
        if (cooldownBar) {
            cooldownBar.style.width = cooldownPercent + '%';
        }
        
        // Check if cooldown is complete
        if (elapsedTime >= WEAPON_COOLDOWN_TIME) {
            weaponCooldown = false;
            
            const cooldownText = document.getElementById('cooldown-text');
            if (cooldownText) {
                cooldownText.textContent = 'READY';
                cooldownText.style.color = '#bb33ff';
                
                // Add a brief flash effect when ready
                cooldownText.style.textShadow = '0 0 10px #aa55ff';
                setTimeout(() => {
                    if (cooldownText) {
                        cooldownText.style.textShadow = 'none';
                    }
                }, 200);
            }
        }
    }
    
    // Process each projectile with frustum culling
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const projectile = projectiles[i];
        
        // Move projectile
        if (projectile.active) {
            projectile.mesh.position.x += projectile.direction.x * projectile.speed * deltaTime;
            projectile.mesh.position.y += projectile.direction.y * projectile.speed * deltaTime;
            projectile.mesh.position.z += projectile.direction.z * projectile.speed * deltaTime;
            
            // Create a bounding sphere for the projectile for frustum culling
            const projectilePos = projectile.mesh.position.clone();
            const boundingSphere = new THREE.Sphere(projectilePos, 5); // Using a reasonable radius
            
            // Check if projectile is in view frustum
            const isVisible = frustum.intersectsSphere(boundingSphere);
            
            // Set visibility based on frustum culling
            projectile.mesh.visible = isVisible;
            
            // Only update visual effects if the projectile is visible
            if (isVisible) {
                // Update light position
                if (projectile.light) {
                    projectile.light.position.copy(projectile.mesh.position);
                    projectile.light.visible = true;
                }
                
                // Update trail position and orientation
                if (projectile.trail) {
                    projectile.trail.position.copy(projectile.mesh.position);
                    projectile.trail.lookAt(projectile.mesh.position.clone().sub(projectile.direction));
                    projectile.trail.visible = true;
                }
            } else {
                // Hide light and trail if projectile is not visible
                if (projectile.light) projectile.light.visible = false;
                if (projectile.trail) projectile.trail.visible = false;
            }
            
            // Check projectile lifetime
            const age = currentTime - projectile.created;
            if (age > PROJECTILE_LIFETIME) {
                // Remove projectile and light
                scene.remove(projectile.mesh);
                if (projectile.light) scene.remove(projectile.light);
                if (projectile.trail) scene.remove(projectile.trail);
                
                // Cleanup
                if (projectile.mesh.geometry) projectile.mesh.geometry.dispose();
                if (projectile.mesh.material) projectile.mesh.material.dispose();
                if (projectile.trail && projectile.trail.geometry) projectile.trail.geometry.dispose();
                if (projectile.trail && projectile.trail.material) projectile.trail.material.dispose();
                
                projectiles.splice(i, 1);
                continue;
            }
            
            // Only check collisions if projectile is visible (performance optimization)
            if (isVisible) {
                // Modified collision detection using projection-based method
                let hitDrone = checkProjectileDroneCollision(projectile);
                
                // Remove projectile if it hit a drone
                if (hitDrone) {
                    // Remove projectile
                    scene.remove(projectile.mesh);
                    if (projectile.light) scene.remove(projectile.light);
                    if (projectile.trail) scene.remove(projectile.trail);
                    
                    // Cleanup
                    if (projectile.mesh.geometry) projectile.mesh.geometry.dispose();
                    if (projectile.mesh.material) projectile.mesh.material.dispose();
                    if (projectile.trail && projectile.trail.geometry) projectile.trail.geometry.dispose();
                    if (projectile.trail && projectile.trail.material) projectile.trail.material.dispose();
                    
                    // Remove projectile from array
                    projectiles.splice(i, 1);
                }
            }
        }
    }
}

// Apply frustum culling to buildings
function applyBuildingFrustumCulling(frustum) {
    // Only process this once per frame for efficiency
    const visibleRadius = 200; // Only process buildings within this radius from player
    const playerPos = ship.position.clone();
    
    // Process each building
    for (const building of buildings) {
        // Skip if building is null or has no mesh
        if (!building || !building.mesh) continue;
        
        // Use a distance check first for quick rejection
        const buildingPos = new THREE.Vector3(building.x, building.height/2, building.z);
        const distance = buildingPos.distanceTo(playerPos);
        
        // If building is too far, hide it
        if (distance > visibleRadius) {
            building.mesh.visible = false;
            continue;
        }
        
        // For closer buildings, use proper frustum culling with bounding box or sphere
        // Create a sphere that encompasses the building
        const radius = Math.max(building.width, building.height, building.depth) / 2 + 5; // Add some padding
        const boundingSphere = new THREE.Sphere(buildingPos, radius);
        
        // Check if building is in view frustum
        building.mesh.visible = frustum.intersectsSphere(boundingSphere);
    }
}

// Add debug keys for performance testing
function setupPerformanceDebugKeys() {
    // Add to the existing event listeners
    document.addEventListener('keydown', function(event) {
        // Only in debug mode or when FPS is very low
        const fpsElement = document.getElementById('fps-counter');
        const fps = fpsElement ? parseInt(fpsElement.textContent.replace('FPS: ', '')) || 0 : 0;
        
        if (debugMode || fps < 10) {
            switch(event.key) {
                case '1':
                    // Toggle post-processing
                    if (composer) {
                        composer.passes.forEach(pass => {
                            if (pass.enabled !== undefined) {
                                pass.enabled = !pass.enabled;
                            }
                        });
                        console.log("Post-processing toggled");
                    }
                    break;
                case '2':
                    // Toggle shadows
                    scene.traverse(obj => {
                        if (obj.isMesh) {
                            obj.castShadow = !obj.castShadow;
                            obj.receiveShadow = !obj.receiveShadow;
                        }
                        if (obj.isLight && obj.shadow) {
                            obj.castShadow = !obj.castShadow;
                        }
                    });
                    console.log("Shadows toggled");
                    break;
                case '3':
                    // Reduce drone visibility range
                    window.visibilityRadius = window.visibilityRadius || 150;
                    window.visibilityRadius = window.visibilityRadius === 150 ? 75 : 150;
                    console.log("Visibility radius set to:", window.visibilityRadius);
                    break;
                case '4': 
                    // Toggle debug panel with performance stats
                    const debugPanel = document.getElementById('debug-panel');
                    if (debugPanel) {
                        debugPanel.style.display = debugPanel.style.display === 'none' ? 'block' : 'none';
                    }
                    debugMode = !debugMode;
                    console.log("Debug mode:", debugMode);
                    break;
            }
        }
    });
}

// Show performance help panel
function showPerformanceHelp() {
    const helpPanel = document.getElementById('performance-help');
    if (helpPanel && helpPanel.style.display !== 'block') {
        helpPanel.style.display = 'block';
        
        // Hide after 15 seconds
        setTimeout(() => {
            helpPanel.style.display = 'none';
        }, 15000);
    }
}
