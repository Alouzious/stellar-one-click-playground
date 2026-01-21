#!/bin/bash
set -euo pipefail

echo "=== Runner (Step 4: Soroban contract build) ==="
echo "User: $(id)"
echo "Workdir: $(pwd)"
echo ""

echo "Tool versions:"
stellar version
rustc --version
cargo --version
echo ""

echo "Preparing contract workspace..."
cp -R /runner/templates/hello-soroban .
cd hello-soroban
echo ""

echo "Building contract with stellar..."
stellar contract build || {
  echo "❌ error: exit status exit status: $?"
  exit 1
}

echo ""
echo "✅ Contract built successfully!"
ls -lh target/wasm32-unknown-unknown/release/*.wasm 2>/dev/null || true
