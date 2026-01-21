FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive
SHELL ["/bin/bash", "-lc"]

# System deps
RUN set -euo pipefail; \
  apt-get update; \
  apt-get install -y --no-install-recommends \
    ca-certificates curl git bash jq unzip xz-utils \
    libdbus-1-3 \
    build-essential pkg-config clang lld \
    ; \
  rm -rf /var/lib/apt/lists/*

# Install Stellar CLI
COPY vendor/stellar-cli-23.4.1-linux-x64.tar.gz /tmp/stellar-cli.tar.gz
RUN set -euo pipefail; \
  mkdir -p /tmp/stellar && cd /tmp/stellar; \
  tar -xzf /tmp/stellar-cli.tar.gz; \
  binpath="$(find .  -maxdepth 4 -type f -name stellar | head -n 1)"; \
  echo "Found stellar at:  ${binpath}"; \
  [[ -n "${binpath}" ]]; \
  mv "${binpath}" /usr/local/bin/stellar; \
  chmod +x /usr/local/bin/stellar; \
  stellar --version; \
  rm -rf /tmp/stellar /tmp/stellar-cli.tar. gz

# Create non-root user
RUN useradd -m -u 10001 runner

# Prepare workdir
RUN mkdir -p /work && chown runner:runner /work

WORKDIR /work

# Copy templates and scripts
COPY templates/ /runner/templates/
COPY scripts/ /runner/scripts/
RUN chmod +x /runner/scripts/*.sh

# Switch to runner user and install rustup
USER runner

ENV RUSTUP_HOME=/home/runner/.rustup
ENV CARGO_HOME=/home/runner/.cargo
ENV PATH=/home/runner/.cargo/bin:$PATH

ARG RUST_VERSION=1.85.0

RUN set -euo pipefail; \
  curl -fL --retry 10 --retry-delay 3 --retry-all-errors --connect-timeout 30 --max-time 0 \
    https://sh.rustup.rs -o /tmp/rustup.sh; \
  sh /tmp/rustup.sh -y --no-modify-path --profile minimal --default-toolchain "${RUST_VERSION}"; \
  rm -f /tmp/rustup.sh; \
  rustc --version; \
  cargo --version; \
  rustup target add wasm32-unknown-unknown wasm32v1-none

ENTRYPOINT ["/runner/scripts/deploy.sh"]
