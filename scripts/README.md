# Scripts

Repository management scripts for native module development.

## Repository Commands

- `node scripts/manage-node-modules.js status [filter]` - Check status of managed repositories
- `node scripts/manage-node-modules.js summary` - Show project overview and statistics
- `node scripts/manage-node-modules.js setup-remotes` - Set up Git remotes
- `node scripts/manage-node-modules.js create-branch <name>` - Create feature branch across repos
- `node scripts/manage-node-modules.js delete-branch <name>` - Delete branch (supports --force --remote)
- `node scripts/manage-node-modules.js commit "<message>"` - Commit changes across repos
- `node scripts/manage-node-modules.js push` - Push to remote
- `node scripts/open-pr-links.js <branch> [filter]` - Open PR creation links in browser

## Filters

- `cpp` - C++ modules: winapi-bindings, bsatk, loot, gamebryo-savegame
- `csharp` - C# projects: fomod-installer, dotnetprobe
- `nexus` - Nexus-Mods hosted repos
- `all` - All managed repositories

## Workflow Example

```bash
node scripts/manage-node-modules.js create-branch feature-name
# ... make changes ...
node scripts/manage-node-modules.js commit "Add feature"
node scripts/manage-node-modules.js push
node scripts/open-pr-links.js feature-name cpp
```
