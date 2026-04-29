# .NET probe

Simple executable that checks the installed .NET version of the host system.

## Usage

`dotnetprobe <version>`

Example:

`dotnetprobe 9` will check if the user has installed .NET 9 or higher.

## Buildling

```
dotnet publish -r <runtime-identifier> -o out
```

Output can be found in `out` directory after publishing.

Valid runtime identifiers:

- Windows: `win-x64`
- Linux: `linux-x64`
