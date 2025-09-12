# Mac App Store Game Store Integration

This extension adds support for discovering and managing games installed through the Mac App Store in Vortex.

## Features

- Detects games installed through the Mac App Store
- Supports game discovery in both system and user Applications directories
- Provides basic game launching functionality

## How it Works

The extension scans the standard Mac App Store installation directories:
- `/Applications` (system-wide installations)
- `~/Applications` (user-specific installations)

It uses simple heuristics to identify likely games based on application names containing common game-related terms.

## Limitations

- Game detection is based on naming heuristics and may not be 100% accurate
- Does not integrate with the Mac App Store API for detailed game information
- Launching games may require the Mac App Store to be running

## Future Improvements

- Integration with system APIs for more accurate game detection
- Support for Mac App Store metadata retrieval
- Enhanced game launching capabilities