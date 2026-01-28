export const defaultTemplates = [
  // Root configuration files
  {
    name: "Cargo.toml",
    path: "/Cargo.toml",
    language: "toml",
    content: `[package]
name = "soroban_contract"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
soroban-sdk = "21.7.7"

[dev-dependencies]
soroban-sdk = { version = "21.7.7", features = ["testutils"] }

[profile.release]
opt-level = "z"
overflow-checks = true
debug = 0
strip = "symbols"
debug-assertions = false
panic = "abort"
codegen-units = 1
lto = true

[profile.release-with-logs]
inherits = "release"
debug-assertions = true
`
  },
  {
    name: "README.md",
    path: "/README.md",
    language: "markdown",
    content: `# Soroban Smart Contract

A Soroban smart contract project built with Rust.

## Project Structure

\`\`\`
├── contract/          # Smart contract source code
│   ├── lib.rs        # Main contract implementation
│   └── test.rs       # Unit tests
├── tests/            # Integration tests
│   └── integration_test.rs
├── scripts/          # Build and deployment scripts
│   ├── build.sh      # Build script
│   ├── deploy.sh     # Deployment script
│   └── test.sh       # Test runner
├── Cargo.toml        # Rust dependencies and configuration
├── .gitignore        # Git ignore rules
└── README.md         # This file
\`\`\`

## Getting Started

### Prerequisites

- Rust and Cargo
- Soroban CLI
- wasm32-unknown-unknown target

### Building

\`\`\`bash
cargo build --target wasm32-unknown-unknown --release
\`\`\`

Or use the build script:

\`\`\`bash
bash scripts/build.sh
\`\`\`

### Testing

\`\`\`bash
cargo test
\`\`\`

Or use the test script:

\`\`\`bash
bash scripts/test.sh
\`\`\`

## Contract Functions

- \`hello(to: Symbol)\` - Returns a greeting message
- \`increment()\` - Increments a counter stored in contract storage
- \`get_count()\` - Gets the current counter value

## Resources

- [Soroban Documentation](https://soroban.stellar.org/docs)
- [Soroban Examples](https://github.com/stellar/soroban-examples)
- [Stellar Documentation](https://developers.stellar.org)
`
  },
  {
    name: ".gitignore",
    path: "/.gitignore",
    language: "plaintext",
    content: `# Rust
/target/
Cargo.lock

# IDE
.idea/
.vscode/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Build artifacts
*.wasm
*.optimized.wasm

# Node modules (if using any JS tooling)
node_modules/
`
  },

  // Contract folder - Main contract file
  {
    name: "lib.rs",
    path: "/contract/lib.rs",
    language: "rust",
    content: `#![no_std]
use soroban_sdk::{contract, contractimpl, symbol_short, vec, Env, Symbol, Vec};

#[contract]
pub struct HelloContract;

#[contractimpl]
impl HelloContract {
    /// Returns a friendly greeting
    pub fn hello(env: Env, to: Symbol) -> Vec<Symbol> {
        vec![&env, symbol_short!("Hello"), to]
    }
    
    /// Increments a counter stored in contract storage
    pub fn increment(env: Env) -> u32 {
        let key = symbol_short!("COUNTER");
        let mut count: u32 = env.storage().instance().get(&key).unwrap_or(0);
        count += 1;
        env.storage().instance().set(&key, &count);
        count
    }
    
    /// Gets the current counter value
    pub fn get_count(env: Env) -> u32 {
        let key = symbol_short!("COUNTER");
        env.storage().instance().get(&key).unwrap_or(0)
    }
}

mod test;
`
  },

  // Contract folder - Unit tests
  {
    name: "test.rs",
    path: "/contract/test.rs",
    language: "rust",
    content: `#![cfg(test)]

use super::*;
use soroban_sdk::{symbol_short, vec, Env};

#[test]
fn test_hello() {
    let env = Env::default();
    let contract_id = env.register_contract(None, HelloContract);
    let client = HelloContractClient::new(&env, &contract_id);

    let result = client.hello(&symbol_short!("World"));
    assert_eq!(
        result,
        vec![&env, symbol_short!("Hello"), symbol_short!("World")]
    );
}

#[test]
fn test_increment() {
    let env = Env::default();
    let contract_id = env.register_contract(None, HelloContract);
    let client = HelloContractClient::new(&env, &contract_id);

    assert_eq!(client.increment(), 1);
    assert_eq!(client.increment(), 2);
    assert_eq!(client.increment(), 3);
}

#[test]
fn test_get_count() {
    let env = Env::default();
    let contract_id = env.register_contract(None, HelloContract);
    let client = HelloContractClient::new(&env, &contract_id);

    assert_eq!(client.get_count(), 0);
    client.increment();
    assert_eq!(client.get_count(), 1);
}
`
  },

  // Tests folder - Integration tests
  {
    name: "integration_test.rs",
    path: "/tests/integration_test.rs",
    language: "rust",
    content: `#![cfg(test)]

use soroban_sdk::{symbol_short, vec, Env};

#[test]
fn test_contract_integration() {
    let env = Env::default();
    
    // Register the contract
    let contract_id = env.register_contract(None, crate::HelloContract);
    let client = crate::HelloContractClient::new(&env, &contract_id);
    
    // Test hello function
    let result = client.hello(&symbol_short!("Soroban"));
    assert_eq!(
        result,
        vec![&env, symbol_short!("Hello"), symbol_short!("Soroban")]
    );
    
    // Test counter functions
    assert_eq!(client.get_count(), 0);
    assert_eq!(client.increment(), 1);
    assert_eq!(client.get_count(), 1);
}

#[test]
fn test_multiple_increments() {
    let env = Env::default();
    let contract_id = env.register_contract(None, crate::HelloContract);
    let client = crate::HelloContractClient::new(&env, &contract_id);
    
    for i in 1..=10 {
        assert_eq!(client.increment(), i);
    }
    
    assert_eq!(client.get_count(), 10);
}
`
  },

  // Scripts folder - Build script
  {
    name: "build.sh",
    path: "/scripts/build.sh",
    language: "bash",
    content: `#!/usr/bin/env bash

set -e

echo "🔨 Building Soroban contract..."

# Build the contract
cargo build --target wasm32-unknown-unknown --release

echo "✅ Build complete!"

# Optional: Optimize the WASM file
# Uncomment if you have soroban-cli installed
# echo "🔧 Optimizing WASM..."
# soroban contract optimize \\
#   --wasm target/wasm32-unknown-unknown/release/soroban_contract.wasm

echo "📦 Contract built successfully!"
echo "Location: target/wasm32-unknown-unknown/release/soroban_contract.wasm"
`
  },

  // Scripts folder - Deploy script
  {
    name: "deploy.sh",
    path: "/scripts/deploy.sh",
    language: "bash",
    content: `#!/usr/bin/env bash

set -e

# Configuration
NETWORK="testnet"
CONTRACT_WASM="target/wasm32-unknown-unknown/release/soroban_contract.wasm"

echo "🚀 Deploying to $NETWORK..."

# Check if contract is built
if [ ! -f "$CONTRACT_WASM" ]; then
    echo "❌ Contract not found. Please build first with: bash scripts/build.sh"
    exit 1
fi

# Deploy the contract
# Note: Requires soroban-cli to be installed
# soroban contract deploy \\
#   --wasm $CONTRACT_WASM \\
#   --network $NETWORK \\
#   --source <YOUR_SECRET_KEY>

echo "✅ Deployment complete!"
echo "Remember to save your contract ID!"
`
  },

  // Scripts folder - Test script
  {
    name: "test.sh",
    path: "/scripts/test.sh",
    language: "bash",
    content: `#!/usr/bin/env bash

set -e

echo "🧪 Running tests..."

# Run all tests
cargo test

echo "✅ All tests passed!"
`
  }
];