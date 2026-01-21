#!/bin/bash
set -euo pipefail

echo "=== Runner (Step 5: Deploy to Stellar Testnet) ==="
echo "User: $(id)"
echo "Workdir: $(pwd)"
echo ""

# Copy contract workspace
cp -R /runner/templates/hello-soroban /work/hello-soroban
cd /work/hello-soroban

echo "Building contract..."
stellar contract build 2>&1 | grep -E "(Finished|Wasm)" || true
echo ""

WASM_PATH="target/wasm32v1-none/release/hello_soroban.wasm"

if [[ !  -f "$WASM_PATH" ]]; then
  echo "❌ WASM file not found: $WASM_PATH"
  exit 1
fi

echo "✅ Contract WASM ready: $WASM_PATH"
echo ""

# Generate a new identity for deployment
echo "Generating deployment identity..."
stellar keys generate deployer --network testnet --fund 2>&1 | grep -v "^error" || true
DEPLOYER_ADDRESS=$(stellar keys address deployer)
echo "Deployer address: $DEPLOYER_ADDRESS"
echo ""

# Deploy contract
echo "Deploying contract to testnet..."
CONTRACT_ID=$(stellar contract deploy \
  --wasm "$WASM_PATH" \
  --source deployer \
  --network testnet 2>&1 | tail -n 1)

echo "✅ Contract deployed!"
echo "Contract ID: $CONTRACT_ID"
echo ""

# Invoke the hello function
echo "Invoking contract function:  hello"
RESULT=$(stellar contract invoke \
  --id "$CONTRACT_ID" \
  --source deployer \
  --network testnet \
  -- \
  hello \
  --to "World" 2>&1 | tail -n 1)

echo "✅ Contract invoked successfully!"
echo "Result: $RESULT"
echo ""
echo "=== Deployment Summary ==="
echo "Network: Stellar Testnet"
echo "Contract ID: $CONTRACT_ID"
echo "Deployer: $DEPLOYER_ADDRESS"
echo "Function called:  hello(\"World\")"
echo "Response: $RESULT"
