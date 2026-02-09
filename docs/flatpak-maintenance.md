# Flatpak Maintenance

How to build and update the Flatpak package.

> [!note] Prerequisites
> See [Flatpak basics in CONTRIBUTE.md](../CONTRIBUTE.md#flatpak-basics-linux-packaging).

## Helper Scripts

Scripts in `flatpak/scripts/` automate common tasks. They manage their own virtual environment and can run from any directory.

> [!tip]
> Use `python` instead if `python3` does not work on your system.

### Development workflow

| Script               | Purpose                                                    |
| -------------------- | ---------------------------------------------------------- |
| `flatpak_sources.py` | Regenerate `flatpak/generated-sources.json` from lockfiles |
| `flatpak_build.py`   | Build the Flatpak with standard defaults                   |
| `flatpak_run.py`     | Run the build output without installing                    |

### Distribution workflow

| Script              | Purpose                                               |
| ------------------- | ----------------------------------------------------- |
| `flatpak_bundle.py` | Export to a local repo and create a `.flatpak` bundle |

## Typical Workflow

**1. Regenerate sources** (whenever `yarn.lock` changes):

```bash
python3 flatpak/scripts/flatpak_sources.py
```

**2. Build:**

```bash
python3 flatpak/scripts/flatpak_build.py
```

**3. Test:**

```bash
python3 flatpak/scripts/flatpak_run.py
```

**4. Bundle (optional):**

```bash
python3 flatpak/scripts/flatpak_bundle.py
```

## Runtime Updates

Update `runtime-version`, `base-version`, and SDK extensions together to maintain ABI compatibility.

Current baselines:

- Runtime: `org.freedesktop.Platform` 25.08
- BaseApp: `org.electronjs.Electron2.BaseApp` 25.08
- Node SDK: `org.freedesktop.Sdk.Extension.node22`
- .NET SDK: `org.freedesktop.Sdk.Extension.dotnet9`

## References

- [Flatpak Electron guide](https://docs.flatpak.org/en/latest/electron.html)
- [Flatpak .NET guide](https://docs.flatpak.org/en/latest/dotnet.html)
- [flatpak-builder documentation](https://docs.flatpak.org/en/latest/flatpak-builder.html)
