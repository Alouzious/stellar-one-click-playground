#!/bin/bash
set -euo pipefail

echo "Vendoring Rust dependencies for Soroban..."

# Create temporary directory
TEMP_DIR=$(mktemp -d)
cd "$TEMP_DIR"

# Copy the template
cp -R runner/templates/hello-soroban .
cd hello-soroban

# Fetch all dependencies
echo "Fetching dependencies..."
cargo fetch --target wasm32-unknown-unknown

# Vendor them
echo "Vendoring dependencies..."
mkdir -p ../../runner/cargo-vendor
cargo vendor ../../runner/cargo-vendor

# Create cargo config
cat > ../../runner/cargo-vendor-config.toml <<'CARGOCONFIG'
[source.crates-io]
replace-with = "vendored-sources"

[source.vendored-sources]
directory = "/home/runner/.cargo/vendor"
CARGOCONFIG

echo "✅ Dependencies vendored to runner/cargo-vendor/"
echo "✅ Config saved to runner/cargo-vendor-config.toml"

# Cleanup
cd ../..
rm -rf "$TEMP_DIR"
