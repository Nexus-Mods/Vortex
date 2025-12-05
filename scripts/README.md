# Scripts

Repository management scripts for native module development.

## Repository Commands

- `yarn modules:status [filter]` - Check status of managed repositories
- `yarn modules:summary` - Show project overview and statistics
- `yarn modules:setup` - Set up Git remotes
- `yarn modules:create-branch <name>` - Create feature branch across repos
- `yarn modules:delete-branch <name>` - Delete branch (supports --force --remote)
- `yarn modules:commit "<message>"` - Commit changes across repos
- `yarn modules:push` - Push to remote
- `yarn modules:open-prs <branch> [filter]` - Open PR creation links in browser

## Filters

- `cpp` - C++ modules: winapi-bindings, bsatk, esptk, loot, gamebryo-savegame, bsdiff-node
- `csharp` - C# projects: fomod-installer, dotnetprobe
- `nexus` - Nexus-Mods hosted repos
- `all` - All managed repositories

## Workflow Example

```bash
yarn modules:create-branch feature-name
# ... make changes ...
yarn modules:commit "Add feature"
yarn modules:push
yarn modules:open-prs feature-name cpp
```
