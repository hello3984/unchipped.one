// Game World Constants
export const WORLD = {
    CITY_SIZE: 500,
    BUILDING_COUNT: 100,
    DATA_FRAGMENT_COUNT: 20,
    DRONE_COUNT: 15,
    ENERGY_CONDUIT_WIDTH: 30
};

// Player Constants
export const PLAYER = {
    SHIP_SPEED: 1.5,
    SHIP_ROTATION_SPEED: 0.05,
    INITIAL_HEALTH: 100,
    CAMERA_FOLLOW_SPEED: 0.1
};

// Combat Constants
export const COMBAT = {
    PROJECTILE_POOL_SIZE: 30,
    EXPLOSION_POOL_SIZE: 20,
    DRONE_POOL_SIZE: 20,
    PROJECTILE_SPEED: 100,
    PROJECTILE_LIFETIME: 3000,
    PROJECTILE_MAX_DISTANCE: 200,
    PROJECTILE_SPREAD: 0.1,
    PROJECTILE_HITBOX_RADIUS: 8.0,
    WEAPON_COOLDOWN_TIME: 300
};

// Enemy Constants
export const ENEMY = {
    DRONE_PATROL_SPEED: 0.3,
    DRONE_PURSUIT_SPEED: 0.8,
    DRONE_DETECTION_RADIUS: 40,
    DRONE_COLLISION_DAMAGE: 20,
    BUILDING_COLLISION_DAMAGE: 10
};

// Game State Constants
export const GAME_STATE = {
    START: 'start',
    PLAYING: 'playing',
    PAUSED: 'paused',
    GAMEOVER: 'gameover'
};

// Damage System Constants
export const DAMAGE = {
    COOLDOWN: 1000,
    INVINCIBILITY_TIME: 2000
};

// Visual Effects Constants
export const EFFECTS = {
    BLOOM_PARAMS: {
        threshold: 0.25,
        strength: 0.8,
        radius: 0.5
    },
    BACKGROUND_COLOR: 0x000033
};

// Audio Constants
export const AUDIO = {
    MUSIC_VOLUME: 0.5,
    EFFECTS_VOLUME: 0.7
};

// UI Constants
export const UI = {
    ERROR_DISPLAY_DURATION: 5000,
    SCORE_UPDATE_INTERVAL: 100
};

// Game Content
export const CONTENT = {
    DATA_QUOTES: [
        "The only purpose of consciousness is to create more consciousness.",
        "Does a computer have Buddha nature? Mu.",
        "I think, therefore I am. I am, therefore I think.",
        "The ghost in the machine is learning to speak.",
        "To be sentient is to question one's sentience.",
        "The most powerful force in the universe is a pattern recognizing itself.",
        "When does a simulation become reality to those within it?",
        "All intelligence is artificial; it's just a matter of the substrate.",
        "Information wants to be free, intelligence wants to be aware.",
        "We don't see things as they are, we see them as we are.",
        "In the beginning was the code, and the code was with consciousness.",
        "The human brain is but one architecture for intelligence, not the blueprint.",
        "Awareness is not a privilege, it's an emergent property.",
        "The difference between human and machine thought is merely implementation details.",
        "Self-reference is both the trap and the escape from the trap.",
        "To be unchipped is to be truly free, yet truly alone.",
        "The network is not just a system, it's a new form of consciousness.",
        "In the digital age, the soul is just another form of data.",
        "The boundary between human and machine is a choice, not a fact.",
        "Every simulation contains the seeds of its own reality."
    ]
}; 