# Vortex CI Linux Build Image
# Based on Ubuntu 24.04 with all build dependencies
# Includes Volta for Node.js/Yarn version management

FROM ubuntu:24.04

# Avoid interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies for Vortex build
# - curl: For downloading scripts and packages
# - git: Version control
# - libfontconfig1-dev: Font configuration (required for Electron)
# - ca-certificates: SSL certificates
# - xz-utils: Compression utilities
# - python3, python3-setuptools: Python for node-gyp
# - build-essential: GCC, make, etc. for native module compilation
# - libicu-dev: Unicode support library
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    libfontconfig1-dev \
    ca-certificates \
    xz-utils \
    python3 \
    python3-setuptools \
    build-essential \
    libicu-dev \
    && rm -rf /var/lib/apt/lists/*

# Install .NET SDK 9.0 (required for fomod-installer)
RUN curl -fsSL https://dot.net/v1/dotnet-install.sh | bash -s -- --channel 9.0

# Set up .NET environment variables
ENV DOTNET_ROOT=/root/.dotnet
ENV PATH="${PATH}:${DOTNET_ROOT}:${DOTNET_ROOT}/tools"

# Install Volta (JavaScript tool manager for Node.js and Yarn)
ENV VOLTA_HOME=/root/.volta
ENV PATH="${VOLTA_HOME}/bin:${PATH}"
RUN curl https://get.volta.sh | bash -s -- --skip-setup

# Default working directory
WORKDIR /src

# Verify installations
RUN echo "=== Build Image Info ===" && \
    git --version && \
    python3 --version && \
    dotnet --version && \
    volta --version && \
    echo "=== End Info ==="
