#!/bin/bash
set -euo pipefail

echo "Downloading Rust toolchain for offline installation..."

RUST_VERSION="1.85.0"
TEMP_DIR=$(mktemp -d)

cd "$TEMP_DIR"

# Download rustup-init
echo "Downloading rustup..."
curl -fL --retry 5 https://sh.rustup.rs -o rustup-init.sh
chmod +x rustup-init.sh

# Install Rust to a temporary location
export RUSTUP_HOME="$TEMP_DIR/rustup"
export CARGO_HOME="$TEMP_DIR/cargo"

echo "Installing Rust $RUST_VERSION..."
./rustup-init.sh -y --no-modify-path --profile minimal --default-toolchain "$RUST_VERSION"

# Add wasm target
echo "Adding wasm32-unknown-unknown target..."
"$CARGO_HOME/bin/rustup" target add wasm32-unknown-unknown

# Create vendor directory
mkdir -p runner/rust-vendor

# Package the installation
echo "Packaging Rust installation..."
cd "$TEMP_DIR"
tar -czf rust-install.tar.gz .rustup .cargo

# Move to project
mv rust-install.tar.gz "$OLDPWD/runner/rust-vendor/"

cd "$OLDPWD"
rm -rf "$TEMP_DIR"

echo "✅ Rust toolchain vendored to runner/rust-vendor/rust-install.tar.gz"
echo "File size: $(du -h runner/rust-vendor/rust-install.tar.gz | cut -f1)"
