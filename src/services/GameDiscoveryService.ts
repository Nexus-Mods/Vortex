import { IExtensionApi } from '../types/IExtensionContext';
import { IGame } from '../types/IGame';
import { log } from '../util/log';
import { getSafe } from '../util/storeHelper';
import Bluebird from 'bluebird';
import * as path from 'path';
import { setDiscoveryProgress, setDiscoveryRunning, clearDiscoveryProgress } from '../extensions/gamemode_management/actions/discoveryProgress';
import { getMacOSGameFix, validateRequiredFilesWithMacOSCompat } from '../util/macOSGameCompatibility';

interface IDiscoveryProgress {
  current: number;
  total: number;
  message: string;
  gameId?: string;
}

interface IDiscoveryResult {
  gameId: string;
  gameName: string;
  path: string;
  enhanced: boolean;
}

class GameDiscoveryService {
  private api: IExtensionApi;
  private isDiscovering: boolean = false;
  private discoveryResults: IDiscoveryResult[] = [];
  private onProgressCallback: (progress: IDiscoveryProgress) => void;
  private onCompleteCallback: (results: IDiscoveryResult[]) => void;

  constructor(api: IExtensionApi) {
    this.api = api;
  }

  public async startDiscovery(onProgress: (progress: IDiscoveryProgress) => void, 
                              onComplete: (results: IDiscoveryResult[]) => void): Promise<void> {
    if (this.isDiscovering) {
      log('warn', 'Discovery already in progress');
      return;
    }

    this.isDiscovering = true;
    this.onProgressCallback = onProgress;
    this.onCompleteCallback = onComplete;
    this.discoveryResults = [];
    
    // Dispatch action to set discovery as running
    this.api.store.dispatch(setDiscoveryRunning(true));

    try {
      log('info', 'Starting game discovery at application launch');
      
      // Get all known games
      const state = this.api.getState();
      const knownGames: IGame[] = getSafe(state, ['session', 'gameMode', 'known'], []);
      
      log('info', 'Discovered games count', { count: knownGames.length });
      
      // Update progress
      this.onProgressCallback({
        current: 0,
        total: knownGames.length,
        message: 'Starting game discovery...'
      });
      
      // Dispatch action to update discovery progress
      this.api.store.dispatch(setDiscoveryProgress({
        current: 0,
        total: knownGames.length,
        message: 'Starting game discovery...'
      }));

      // Process each game
      for (let i = 0; i < knownGames.length; i++) {
        const game = knownGames[i];
        
        this.onProgressCallback({
          current: i,
          total: knownGames.length,
          message: `Discovering ${game.name}...`,
          gameId: game.id
        });
        
        // Dispatch action to update discovery progress
        this.api.store.dispatch(setDiscoveryProgress({
          current: i,
          total: knownGames.length,
          message: `Discovering ${game.name}...`,
          gameId: game.id
        }));

        try {
          // Run quick discovery for this game
          await this.discoverGame(game);
        } catch (err) {
          log('warn', 'Failed to discover game', { gameId: game.id, error: err.message });
        }
      }

      // Apply macOS enhancements
      await this.applyMacOSEnhancements();

      // Complete discovery
      this.onProgressCallback({
        current: knownGames.length,
        total: knownGames.length,
        message: 'Discovery complete'
      });
      
      // Dispatch action to update discovery progress
      this.api.store.dispatch(setDiscoveryProgress({
        current: knownGames.length,
        total: knownGames.length,
        message: 'Discovery complete'
      }));

      this.isDiscovering = false;
      this.api.store.dispatch(setDiscoveryRunning(false));
      
      // Send consolidated summary notification instead of individual notifications
      this.sendDiscoverySummary();
      
      this.onCompleteCallback(this.discoveryResults);
    } catch (err) {
      log('error', 'Game discovery failed', { error: err.message });
      this.isDiscovering = false;
      this.api.store.dispatch(setDiscoveryRunning(false));
      this.onCompleteCallback(this.discoveryResults);
    }
  }

  private async discoverGame(game: IGame): Promise<void> {
    log('debug', 'Discovering game', { gameId: game.id, gameName: game.name });
    
    try {
      // Emit discover-game event to trigger GameModeManager discovery
      await this.api.emitAndAwait('discover-game', game.id);
      
      // Check if game was discovered
      const state = this.api.getState();
      const discoveryResult = getSafe(state, ['settings', 'gameMode', 'discovered', game.id], undefined);
      
      if (discoveryResult && discoveryResult.path) {
        this.discoveryResults.push({
          gameId: game.id,
          gameName: game.name,
          path: discoveryResult.path,
          enhanced: false
        });
        
        // Ensure the discovery result is properly persisted
        log('info', 'Game discovered and persisted', { 
          gameId: game.id, 
          gameName: game.name, 
          path: discoveryResult.path 
        });
      }
    } catch (err) {
      log('warn', 'Game discovery failed for game', { gameId: game.id, error: err.message });
    }
  }

  private async applyMacOSEnhancements(): Promise<void> {
    log('info', 'Applying macOS enhancements to discovered games');
    
    const macOSGames = this.discoveryResults.filter(result => 
      this.isMacOSGame(result.gameId)
    );
    
    for (let i = 0; i < macOSGames.length; i++) {
      const game = macOSGames[i];
      
      this.onProgressCallback({
        current: i,
        total: macOSGames.length,
        message: `Enhancing ${game.gameName} for macOS...`,
        gameId: game.gameId
      });
      
      // Dispatch action to update discovery progress
      this.api.store.dispatch(setDiscoveryProgress({
        current: i,
        total: macOSGames.length,
        message: `Enhancing ${game.gameName} for macOS...`,
        gameId: game.gameId
      }));
      
      try {
        // Apply macOS enhancement (this would call the existing enhancement logic)
        await this.enhanceGameForMacOS(game.gameId, game.path);
        
        // Update the result to mark as enhanced
        const index = this.discoveryResults.findIndex(r => r.gameId === game.gameId);
        if (index !== -1) {
          this.discoveryResults[index].enhanced = true;
        }
      } catch (err) {
        log('warn', 'Failed to enhance game for macOS', { gameId: game.gameId, error: err.message });
      }
    }
  }

  /**
   * Send a consolidated summary of discovery results instead of individual notifications
   */
  private sendDiscoverySummary(): void {
    const discoveredCount = this.discoveryResults.length;
    const enhancedCount = this.discoveryResults.filter(result => result.enhanced).length;
    
    if (discoveredCount > 0 || enhancedCount > 0) {
      let message = '';
      
      if (discoveredCount > 0 && enhancedCount > 0) {
        message = `Discovered ${discoveredCount} game${discoveredCount !== 1 ? 's' : ''}`;
        if (enhancedCount > 0) {
          message += ` and enhanced ${enhancedCount} for macOS`;
        }
      } else if (discoveredCount > 0) {
        message = `Discovered ${discoveredCount} game${discoveredCount !== 1 ? 's' : ''}`;
      } else if (enhancedCount > 0) {
        message = `Enhanced ${enhancedCount} game${enhancedCount !== 1 ? 's' : ''} for macOS`;
      }
      
      // Only send notification if we have something to report
      if (message) {
        this.api.sendNotification({
          id: 'game-discovery-summary',
          type: 'success',
          title: 'Game Discovery Complete',
          message: message,
          displayMS: 5000
        });
      }
    } else {
      log('info', 'No games discovered or enhanced during discovery process');
    }
  }

  private isMacOSGame(gameId: string): boolean {
    // This would check if the game needs macOS enhancement
    // For now, we'll assume all games on macOS might need enhancement
    return process.platform === 'darwin';
  }

  private async enhanceGameForMacOS(gameId: string, gamePath: string): Promise<void> {
    // Apply actual macOS enhancement using the compatibility layer
    log('debug', 'Enhancing game for macOS', { gameId, gamePath });
    
    try {
      // Get the macOS game fix for this game
      const gameFix = getMacOSGameFix(gameId);
      if (gameFix) {
        log('info', 'Applying macOS compatibility fix', { 
          gameId, 
          gameName: gameFix.gameId,
          windowsExecutable: gameFix.windowsExecutable,
          macOSAppBundle: gameFix.macOSAppBundle
        });
        
        // Validate required files with macOS compatibility
        const requiredFiles = [gameFix.windowsExecutable];
        if (gameFix.alternativeFiles) {
          requiredFiles.push(...gameFix.alternativeFiles);
        }
        
        await validateRequiredFilesWithMacOSCompat(gamePath, requiredFiles, gameId);
        log('info', 'macOS compatibility validation completed', { gameId });
      } else {
        log('debug', 'No macOS compatibility fix found for game', { gameId });
      }
      
      return Promise.resolve();
    } catch (err) {
      log('warn', 'Failed to enhance game for macOS', { gameId, error: err.message });
      throw err;
    }
  }

  public isDiscoveryRunning(): boolean {
    return this.isDiscovering;
  }

  public getDiscoveryResults(): IDiscoveryResult[] {
    return [...this.discoveryResults];
  }
}

export default GameDiscoveryService;