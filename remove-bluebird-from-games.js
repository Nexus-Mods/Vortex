const fs = require('fs');
const path = require('path');

// Get all game extension directories
const gamesDir = path.join(__dirname, 'extensions', 'games');
const gameDirs = fs.readdirSync(gamesDir, { withFileTypes: true })
  .filter(dirent => dirent.isDirectory())
  .map(dirent => path.join(gamesDir, dirent.name));

gameDirs.forEach(gameDir => {
  // Look for JavaScript files in each game directory
  const files = fs.readdirSync(gameDir)
    .filter(file => file.endsWith('.js'))
    .map(file => path.join(gameDir, file));
  
  files.forEach(filePath => {
    try {
      let content = fs.readFileSync(filePath, 'utf8');
      
      // Check if the file contains Bluebird import
      if (content.includes("const Promise = require('bluebird');")) {
        // Replace with a comment
        content = content.replace(
          "const Promise = require('bluebird');", 
          "// Bluebird import removed during migration to native Promises"
        );
        
        fs.writeFileSync(filePath, content);
        console.log(`Removed Bluebird import from ${filePath}`);
      }
    } catch (err) {
      console.error(`Error processing ${filePath}:`, err.message);
    }
  });
});

console.log('Finished removing Bluebird imports from game extension files');