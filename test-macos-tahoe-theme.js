const { BrowserWindow } = require("electron");

const windows = BrowserWindow.getAllWindows();
if (windows.length > 0) {
  const mainWindow = windows[0];
  
  // Test script to check macOS Tahoe theme availability and functionality
  mainWindow.webContents.executeJavaScript(`
    (async function() {
      console.log("=== macOS Tahoe Theme Test ===");
      
      // Check if Vortex API is available
      if (!window.vortexApi) {
        console.error("Vortex API not available");
        return;
      }
      
      // Get current theme
      const currentTheme = window.vortexApi.store.getState().settings.interface.currentTheme;
      console.log("Current theme:", currentTheme);
      
      // Check available themes
      try {
        // Try to access the theme switcher extension
        const extensions = window.vortexApi.store.getState().session.extensions;
        console.log("Theme switcher extension loaded:", !!extensions['theme-switcher']);
        
        // Emit event to read themes
        window.vortexApi.events.emit('read-themes');
        
        // Wait a bit for themes to load
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Try to switch to macOS Tahoe theme
        console.log("Attempting to switch to macOS Tahoe theme...");
        window.vortexApi.events.emit('select-theme', 'macos-tahoe');
        
        // Wait and check if theme changed
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const newTheme = window.vortexApi.store.getState().settings.interface.currentTheme;
        console.log("Theme after switch attempt:", newTheme);
        
        if (newTheme === 'macos-tahoe') {
          console.log("✅ Successfully switched to macOS Tahoe theme!");
        } else {
          console.log("❌ Failed to switch to macOS Tahoe theme");
        }
        
        // Check if CSS is applied
        const stylesheets = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
        const themeStylesheets = stylesheets.filter(link => 
          link.href && link.href.includes('macos-tahoe')
        );
        console.log("macOS Tahoe stylesheets found:", themeStylesheets.length);
        themeStylesheets.forEach(sheet => console.log("  -", sheet.href));
        
      } catch (error) {
        console.error("Error during theme test:", error);
      }
    })();
  `);
} else {
  console.log("No Vortex windows found");
}