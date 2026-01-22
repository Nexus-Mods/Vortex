# Shared

This directory contains code shared by the [main](../main/) and [renderer](../renderer/) process.

## Rules

- Only platform-agnostic npm packages allowed
- No Node built-ins, Electron, or environment-specific libs
- No imports from main / renderer / preload
