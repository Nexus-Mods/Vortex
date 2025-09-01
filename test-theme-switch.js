// Test script to verify theme switching functionality
const { app, BrowserWindow } = require('electron');
const path = require('path');

// Wait for app to be ready
app.whenReady().then(() => {
  console.log('Testing theme switching...');
  
  // Get the main window
  const windows = BrowserWindow.getAllWindows();
  if (windows.length > 0) {
    const mainWindow = windows[0];
    
    // Execute JavaScript in the renderer process to test theme switching
    mainWindow.webContents.executeJavaScript(`
      // Check if Vortex API is available
      if (window.vortexApi) {
        console.log('Vortex API found, testing theme switch...');
        
        // Get current theme
        const currentTheme = window.vortexApi.store.getState().settings.interface.currentTheme;
        console.log('Current theme:', currentTheme);
        
        // Try to switch to compact theme
        window.vortexApi.events.emit('select-theme', 'compact');
        console.log('Emitted select-theme event for compact');
        
        // Check theme after switch
        setTimeout(() => {
          const newTheme = window.vortexApi.store.getState().settings.interface.currentTheme;
          console.log('Theme after switch:', newTheme);
        }, 1000);
      } else {
        console.log('Vortex API not available yet');
      }
    `).then(result => {
      console.log('Theme switch test executed:', result);
    }).catch(err => {
      console.error('Error executing theme switch test:', err);
    });
  } else {
    console.log('No windows found');
  }
});