#!/bin/bash
set -euo pipefail

# Build first (in case not already built)
stellar-soroban contract build

# Generate deployer identity, if not exists
if ! stellar-soroban keys address deployer 2>/dev/null; then
  stellar-soroban keys generate deployer --network testnet --fund
fi

# Deploy to Stellar testnet
CONTRACT_ID=$(stellar-soroban contract deploy \
    --wasm target/wasm32v1-none/release/hello_soroban.wasm \
    --source deployer \
    --network testnet | tail -n 1)

echo "✅ Contract deployed!"
echo "Contract ID: $CONTRACT_ID"
