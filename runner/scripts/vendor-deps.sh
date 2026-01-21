#!/bin/bash
set -euo pipefail

echo "Creating vendored dependencies for offline build..."

# Create temp build directory
mkdir -p /tmp/vendor-prep
cp -R /runner/templates/hello-soroban /tmp/vendor-prep
cd /tmp/vendor-prep

# Download all dependencies
cargo fetch --target wasm32-unknown-unknown

# Vendor all dependencies
cargo vendor /home/runner/.cargo/vendor

# Create cargo config to use vendored dependencies
mkdir -p .cargo
cat > .cargo/config.toml <<'CARGOCONFIG'
[source.crates-io]
replace-with = "vendored-sources"

[source.vendored-sources]
directory = "/home/runner/.cargo/vendor"
CARGOCONFIG

echo "Dependencies vendored successfully"
