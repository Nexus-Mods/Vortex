# Testing Guide

## Structure

- `__tests__/` - Root-level integration and cross-cutting tests
- `src/**/__tests__/` - Unit tests colocated with source code
- Jest with TypeScript support

## Import Path Rules

**Root-level tests** (`__tests__/*.test.ts`):

```typescript
import InstallManager from "../src/extensions/mod_management/InstallManager";
jest.mock("../src/extensions/mod_management/util/dependencies");
```

**Module-specific tests** (`src/extensions/mod_management/__tests__/*.test.ts`):

```typescript
import InstallManager from "../InstallManager";
jest.mock("../util/dependencies");
```

## Common Issues

- **"Cannot find module"**: Check `jest.mock()` paths match file location relative to test
- **Import vs mock paths**: Both must be updated when moving test files
- **Missing mock parameters**: Update mock calls when method signatures change

## Running Tests

- `yarn test` - All tests
- `yarn test <path>` - Specific file or directory
- `yarn test --watch` - Watch mode
