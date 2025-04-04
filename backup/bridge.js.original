// This file creates a bridge between the modular script.js and the global window scope
// It will be imported by script.js and will expose necessary functions to the window object

// Object to store references to game functions
const gameBridge = {
    // Function to register the game's setGameState function
    registerSetGameState: function(setGameStateFunction) {
        console.log("Registering setGameState function with bridge");
        
        // Store the function references
        if (window.gameControl) {
            window.gameControl.startGame = function() {
                console.log("Start game called via bridge");
                setGameStateFunction('playing');
            };
            
            window.gameControl.pauseGame = function() {
                setGameStateFunction('paused');
            };
            
            window.gameControl.resumeGame = function() {
                setGameStateFunction('playing');
            };
        } else {
            console.error("window.gameControl not defined. Bridge initialization failed.");
        }
    },
    
    // Function to register the restart game function
    registerRestartGame: function(restartGameFunction) {
        console.log("Registering restartGame function with bridge");
        
        if (window.gameControl) {
            window.gameControl.restartGame = restartGameFunction;
        } else {
            console.error("window.gameControl not defined. Bridge initialization failed.");
        }
    }
};

// Export the bridge to be used by script.js
export default gameBridge; 