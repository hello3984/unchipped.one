/**
 * Rendering system for X-Machina
 */
import * as THREE from 'three';
import { scene, camera, renderer } from '../core/game.js';
import EventBus from '../core/eventBus.js';

/**
 * Set up the renderer with initial settings
 */
export function setupRenderer() {
    console.log("Setting up renderer...");
    
    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0x404040, 2);
    scene.add(ambientLight);
    
    // Add directional light (sun)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(1, 10, 1).normalize();
    directionalLight.castShadow = true;
    scene.add(directionalLight);
    
    // Set up shadow properties
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 500;
    
    // Configure renderer
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    // Listen for window resize
    window.addEventListener('resize', onWindowResize);
    
    // Emit event that renderer is ready
    EventBus.emit('rendererReady');
}

/**
 * Handle window resize event
 */
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

/**
 * Cleanup resources when module is unloaded
 */
export function cleanup() {
    window.removeEventListener('resize', onWindowResize);
} 