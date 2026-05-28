# Vortex Linux + VNC Image

Builds Vortex from source on the latest Ubuntu LTS and runs it inside a
TigerVNC server with the Fluxbox window manager. noVNC is also exposed so
the desktop can be reached from a browser.

## Build

```sh
docker build -f docker/linux/Dockerfile.vnc -t vortex-vnc .
```

The first build takes several minutes — it installs the full Node.js + .NET
SDK + Electron + GTK toolchain, then runs `pnpm install` and
`pnpm run build:all` inside the image. Network access is required so the
build can fetch DuckDB extensions and the Electron binary.

## Run

```sh
docker run --rm -it \
    -p 5901:5901 \
    -p 6901:6901 \
    -e VNC_PASSWORD=vortex \
    vortex-vnc
```

Then either:

- Connect a VNC client to `localhost:5901`, or
- Open `http://localhost:6901/vnc.html` in a browser.

## Configuration

All knobs are environment variables — override them with `-e` on
`docker run`:

| Variable                  | Default                | Purpose                                  |
| ------------------------- | ---------------------- | ---------------------------------------- |
| `VNC_PASSWORD`            | _random, logged on start_ | Password the VNC client must supply. Pass via `-e` to set explicitly. |
| `VNC_PORT`                | `5901`                 | RFB port inside the container.           |
| `NOVNC_PORT`              | `6901`                 | HTTP port for the noVNC web client.      |
| `VNC_GEOMETRY`            | `1600x1000`            | Desktop resolution.                      |
| `VNC_DEPTH`               | `24`                   | Colour depth.                            |
| `VNC_DISPLAY`             | `:1`                   | X display number to start.               |
| `ELECTRON_DISABLE_SANDBOX`| `1`                    | Required when running Electron in Docker.|

`VNC_PASSWORD` has no default in the image so it can't leak via `docker
inspect`. If you don't pass one, the entrypoint generates a 16-character
random password and prints it to the container log on startup.

## Notes

- The container runs as the non-root user `vortex` (UID 1000). Override
  with `--build-arg USERNAME=...`, `USER_UID=...`, `USER_GID=...` at build
  time if you need a different UID for bind mounts.
- The `ubuntu:latest` tag tracks the current Ubuntu LTS release. Pin to a
  specific tag (e.g. `ubuntu:24.04`) by editing the `FROM` line if you need
  a reproducible base.
- The default `CMD` is `pnpm start`, which launches the Electron dev build
  produced by `pnpm run build:all`. Override the command (e.g.
  `docker run ... vortex-vnc bash`) to drop into a shell inside the VNC
  session.
