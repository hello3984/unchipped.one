/**
 * Cityscape generator for X-Machina
 * Creates the city environment with buildings and structures
 */
import * as THREE from 'three';
import CONFIG from '../core/config.js';
import { scene } from '../core/game.js';

/**
 * Create the cityscape with buildings and ground
 */
export function createCityscape() {
    console.log("Creating cityscape...");
    
    // Create a ground plane
    const groundGeometry = new THREE.PlaneGeometry(CONFIG.CITY_SIZE * 2, CONFIG.CITY_SIZE * 2);
    const groundMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x111122,
        roughness: 0.8,
        metalness: 0.2
    });
    
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.5;
    ground.receiveShadow = true;
    scene.add(ground);
    
    // Create simple buildings as placeholders
    createBuildings();
    
    return {
        ground
    };
}

/**
 * Create buildings throughout the city
 */
function createBuildings() {
    // Using instanced mesh for better performance
    const buildingGeometry = new THREE.BoxGeometry(1, 1, 1);
    const buildingMaterial = new THREE.MeshStandardMaterial({
        color: 0x334455,
        roughness: 0.7,
        metalness: 0.3
    });
    
    // Create test building
    const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
    building.position.set(10, 5, 10);
    building.scale.set(5, 10, 5);
    building.castShadow = true;
    building.receiveShadow = true;
    scene.add(building);
}

/**
 * Clean up resources when module is unloaded
 */
export function cleanup() {
    // Clean up any resources as needed
} 