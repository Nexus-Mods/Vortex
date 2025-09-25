const fs = require('fs');
const path = require('path');

// Vortex development directory
const vortexDir = '/Users/veland/Library/Application Support/vortex_devel';

console.log('=== CHECKING DISCOVERED GAME PATHS ===\n');

// Check if Vortex directory exists
if (!fs.existsSync(vortexDir)) {
    console.log('❌ Vortex development directory not found:', vortexDir);
    process.exit(1);
}

// Check recent log entries for discovery information
const logFile = path.join(vortexDir, 'vortex.log');
if (fs.existsSync(logFile)) {
    console.log('🔍 Extracting discovered game paths from logs...\n');
    const logContent = fs.readFileSync(logFile, 'utf8');
    const lines = logContent.split('\n');
    
    // Find discovery logs
    const discoveryLogs = lines.filter(line => 
        line.includes('discovered game') || 
        line.includes('Found Cyberpunk 2077') ||
        line.includes('Found Balatro') ||
        line.includes('game discovery') ||
        line.includes('discovery result')
    ).slice(-10);
    
    console.log('📋 Recent discovery logs:');
    discoveryLogs.forEach(log => {
        console.log(`  ${log}`);
    });
    
    // Look for specific game paths in logs
    const gamePathLogs = lines.filter(line => 
        (line.includes('cyberpunk2077') || line.includes('Cyberpunk 2077')) &&
        (line.includes('path') || line.includes('found'))
    ).slice(-5);
    
    console.log('\n🎮 Cyberpunk 2077 path logs:');
    gamePathLogs.forEach(log => {
        console.log(`  ${log}`);
        
        // Try to extract path from log
        const pathMatch = log.match(/"path":"([^"]+)"/);
        if (pathMatch) {
            const gamePath = pathMatch[1];
            console.log(`    Extracted path: ${gamePath}`);
            
            // Check if path exists
            try {
                const stats = fs.statSync(gamePath);
                console.log(`    ✅ Path exists and is ${stats.isDirectory() ? 'directory' : 'file'}`);
                
                // List contents if it's a directory
                if (stats.isDirectory()) {
                    try {
                        const contents = fs.readdirSync(gamePath).slice(0, 10); // First 10 items
                        console.log(`    📁 Contents (first 10): ${contents.join(', ')}`);
                    } catch (e) {
                        console.log(`    ❌ Cannot read directory: ${e.message}`);
                    }
                }
            } catch (e) {
                console.log(`    ❌ Path does not exist or is not accessible: ${e.message}`);
            }
        }
    });
    
    // Check for "game no longer found" or "disappeared" messages
    console.log('\n⚠️  Game disappearance logs:');
    const disappearanceLogs = lines.filter(line => 
        line.includes('game no longer found') ||
        line.includes('disappeared') ||
        line.includes('no longer available') ||
        line.includes('ENOENT') ||
        line.includes('remove disappeared games')
    ).slice(-10);
    
    disappearanceLogs.forEach(log => {
        console.log(`  ${log}`);
    });
    
    // Check for profile switching logs with timing
    console.log('\n🔄 Profile switching sequence:');
    const profileLogs = lines.filter(line => 
        line.includes('profile change') || 
        line.includes('switched to no profile') ||
        line.includes('set game mode') ||
        line.includes('remove disappeared games')
    ).slice(-15);
    
    profileLogs.forEach(log => {
        const timestamp = log.split(' ')[0];
        const message = log.substring(log.indexOf('['));
        console.log(`  ${timestamp}: ${message}`);
    });
}

console.log('\n=== CHECKING GAME DIRECTORIES ===');

// Check game directories
const gameDirectories = ['cyberpunk2077', 'balatro'];
gameDirectories.forEach(gameId => {
    const gameDir = path.join(vortexDir, gameId);
    console.log(`\n📁 ${gameId}:`);
    
    if (fs.existsSync(gameDir)) {
        console.log(`  ✅ Game directory exists: ${gameDir}`);
        
        // Check for profiles
        const profilesDir = path.join(gameDir, 'profiles');
        if (fs.existsSync(profilesDir)) {
            const profiles = fs.readdirSync(profilesDir).filter(item => 
                fs.statSync(path.join(profilesDir, item)).isDirectory()
            );
            console.log(`  👤 Profiles: ${profiles.join(', ')}`);
        } else {
            console.log(`  ❌ No profiles directory`);
        }
        
        // Check for other important files
        const contents = fs.readdirSync(gameDir);
        console.log(`  📄 Contents: ${contents.join(', ')}`);
    } else {
        console.log(`  ❌ Game directory does not exist: ${gameDir}`);
    }
});

console.log('\n=== DEBUG COMPLETE ===');