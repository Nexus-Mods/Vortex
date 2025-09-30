const fs = require('fs');
const path = require('path');

// Test script to verify discovered games persistence
console.log('=== Testing Discovered Games Persistence ===\n');

// Get the Vortex user data directory
const userDataDir = path.join(process.env.HOME, 'Library/Application Support/Vortex');
const discoveredGamesFile = path.join(userDataDir, 'discovered_games.json');

console.log('User Data Directory:', userDataDir);
console.log('Discovered Games File:', discoveredGamesFile);

// Check if the file exists
if (fs.existsSync(discoveredGamesFile)) {
    console.log('✅ Discovered games file exists');
    
    // Read and display the content
    try {
        const data = fs.readFileSync(discoveredGamesFile, 'utf8');
        const discoveredGames = JSON.parse(data);
        
        console.log('\nDiscovered Games:');
        Object.keys(discoveredGames).forEach(gameId => {
            console.log(`  ${gameId}: ${discoveredGames[gameId].path || 'No path'}`);
        });
        
        console.log(`\nTotal discovered games: ${Object.keys(discoveredGames).length}`);
    } catch (err) {
        console.log('❌ Error reading discovered games file:', err.message);
    }
} else {
    console.log('⚠️  Discovered games file does not exist yet');
    console.log('   This is normal if you haven\'t discovered any games yet');
}

console.log('\n=== Test Complete ===');