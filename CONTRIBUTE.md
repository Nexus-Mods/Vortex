# Contributing

## Linux

### Requirements

- editor
- git
- [`volta`](https://volta.sh/)
- for [node-gyp](https://github.com/nodejs/node-gyp?tab=readme-ov-file#on-unix):
    - [A supported version of Python](https://devguide.python.org/versions/)
    - `make` and a C/++ toolchain (`build-essentials` on Debian/Ubuntu)
- [.NET 9](https://dotnet.microsoft.com/en-us/download)

### Setup

- Clone repository
- Install toolchain requirements: `volta install node yarn`
- Install dependencies: `yarn install`
- Build: `yarn build`
- Start: `yarn start`

To get `nxm` protocol handler to work you need to run the script `./scripts/linux-protocol-registration.sh`

