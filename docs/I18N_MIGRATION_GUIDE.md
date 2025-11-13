# How to Properly Use i18n in Vortex

## The Right Way

### 1. Determine the Namespace

Ask: "What feature/extension does this string belong to?"

- Collections feature → `collection`
- Mod operations → `mod_management`
- Downloads → `download_management`
- Profile management → `profile_management`
- Nexus integration → `nexus_integration`
- Game management → `gamemode_management`
- Extension manager → `extension_manager`
- Truly shared UI (OK, Cancel, Close) → `common`

### 2. Create Structured Keys

Use the format: `namespace:section.key` (standard i18next format)

**Examples:**
- `collection:browse.loading` → "Loading collections..."
- `mod_management:actions.install` → "Install Mod"
- `common:actions.close` → "Close"

**Key naming rules:**
- Use camelCase for keys: `searchPlaceholder`, not `search_placeholder`
- Group related strings: `browse.title`, `browse.loading`, `browse.error`
- Use semantic names: `selectGame` not `text1`
- `:` separates namespace from keys
- `.` separates nested key sections

### 3. Add to Namespace File

Edit `locales/en/{namespace}.json`:

```json
{
  "section": {
    "key": "English text here"
  }
}
```

### 4. Use in Code

```typescript
// Import with namespace:
const { t } = useTranslation(['collection', 'common']);

// Use the key:
<p>{t('collection:browse.loading', { isNamespaceKey: true })}</p>
<Button>{t('common:actions.search', { isNamespaceKey: true })}</Button>
```

### 5. Test

- Build: `yarn build`
- Start: `yarn start`
- Navigate to your feature
- Verify text appears correctly

## Example: BrowseNexusPage.tsx

See `src/extensions/browse_nexus/views/BrowseNexusPage.tsx` for a complete working example.

**Before:**
```typescript
const { t } = useTranslation(['collections', 'common']);
<p>{t('Loading collections...')}</p>
<Button>{t('Search')}</Button>
```

**After:**
```typescript
const { t } = useTranslation(['collection', 'common']);
<p>{t('collection:browse.loading', { isNamespaceKey: true })}</p>
<Button>{t('common:actions.search', { isNamespaceKey: true })}</Button>
```

## Available Namespaces

- `common` - Shared UI strings (buttons, actions, states)
- `collection` - Collections feature
- `mod_management` - Mod operations
- `download_management` - Downloads
- `profile_management` - Profiles
- `nexus_integration` - Nexus features
- `gamemode_management` - Game management
- `extension_manager` - Extension manager

## When Adding New Features

1. Check if namespace exists in `src/util/i18n.ts` line 165
2. If not, create `locales/en/{namespace}.json`
3. Add namespace to i18n.ts configuration
4. Use proper keys from day one

## DO NOT

❌ Use literal strings: `t("Install Mod")`
❌ Mix up namespace and key separators
❌ Add feature-specific strings to common.json
❌ Create strings without checking if they already exist

## DO

✅ Use namespaced keys: `t("mod_management:actions.install")`
✅ Use `:` for namespace separator (standard i18next)
✅ Use `.` for nested key separator (standard i18next)
✅ Organize strings logically in namespace files
✅ Check existing namespaces before creating strings

## For Translators

To add a new language:

1. Copy `locales/en/` → `locales/{your-language}/`
2. Translate the **values** only (keep keys unchanged)
3. Example:
   ```json
   // locales/de/collection.json
   {
     "browse": {
       "title": "Sammlungen durchsuchen ({{total}})",  // Was: "Browse Collections ({{total}})"
       "loading": "Sammlungen werden geladen..."      // Was: "Loading collections..."
     }
   }
   ```
4. Submit PR with your `locales/{language}/` folder

The structure provides context - you don't need to read code!
