/**
 * Example Legacy Extension
 * 
 * This is an example of how legacy extensions should be structured
 * to work with the Legacy Extension Shim.
 */

function main(context) {
  // Example of legacy game registration pattern
  context.registerGame({
    id: 'example-game',
    name: 'Example Game',
    mergeMods: true,
    queryPath: () => {
      // Example game detection logic
      return Promise.resolve('/path/to/game');
    },
    supportedTools: [
      {
        id: 'example-tool',
        name: 'Example Tool',
        executable: () => 'tool.exe',
        requiredFiles: ['tool.exe'],
        relative: true
      }
    ],
    executable: () => 'game.exe',
    requiredFiles: ['game.exe'],
    environment: {
      SteamAPPId: '12345'
    },
    details: {
      steamAppId: 12345,
      nexusPageId: 'examplegame'
    }
  });

  // Example of legacy once callback pattern
  context.once(() => {
    console.log('Example Legacy Extension: Post-initialization setup');
    
    // Example of accessing the API after initialization
    const state = context.api.getState();
    console.log('Current state available:', !!state);
    
    // Example of sending a notification
    context.api.sendNotification({
      type: 'info',
      title: 'Example Legacy Extension',
      message: 'Successfully loaded and initialized!',
      displayMS: 3000
    });
    
    // Example of accessing extension APIs (if available)
    if (context.api.ext && context.api.ext.someExtensionMethod) {
      try {
        context.api.ext.someExtensionMethod();
      } catch (err) {
        console.warn('Extension method not available:', err.message);
      }
    }
  });
}

// Export the main function (legacy pattern)
module.exports = main;