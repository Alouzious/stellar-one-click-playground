// Final complete file structure - 9 files total
export const defaultTemplates = [
  // Cargo.toml - Required configuration with correct path
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
path = "contract/lib.rs"

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
`
  },

  // README with welcome info
  {
    name: "README.md",
    path: "/README.md",
    language: "markdown",
    content: `# 🦀 Soroban Smart Contract IDE

Welcome to your Soroban development environment!

## 📁 Project Structure

\`\`\`
📄 Cargo.toml          - Rust configuration
📄 README.md           - This file
📁 contract/
  📄 lib.rs            - Main contract (Hello World) ⭐
  📄 voting.rs         - Example: Voting contract
  📄 token.rs          - Example: Token contract
📁 tests/
  📄 test.rs           - Main contract tests
  📄 voting.rs         - Voting contract tests
  📄 token.rs          - Token contract tests
\`\`\`

## 🚀 Quick Start

1. **Edit** \`contract/lib.rs\` - Write your smart contract
2. **Click Build** 🔨 - Compile to WASM
3. **Click Test** 🧪 - Run tests
4. **Click Deploy** 🚀 - Deploy to Stellar testnet

## ⌨️ Keyboard Shortcuts

- \`Ctrl + B\` - Build contract
- \`Ctrl + T\` - Run tests
- \`Ctrl + N\` - New file
- \`Ctrl + S\` - Save (auto-saves already)

## 📚 Example Contracts

- \`contract/lib.rs\` - Hello World (starter)
- \`contract/voting.rs\` - Voting system
- \`contract/token.rs\` - Token contract

Each has tests in \`tests/\` folder!

## 🔗 Resources

- [Soroban Docs](https://soroban.stellar.org/docs)
- [Stellar Docs](https://developers.stellar.org)
- [Soroban Examples](https://github.com/stellar/soroban-examples)
`
  },

  // ============================================================================
  // CONTRACT FILES
  // ============================================================================

  // Main contract - Hello World (lib.rs)
  {
    name: "lib.rs",
    path: "/contract/lib.rs",
    language: "rust",
    content: `#![no_std]
use soroban_sdk::{contract, contractimpl, symbol_short, vec, Env, Symbol, Vec};

/// A simple Hello World contract
/// This is your main contract file - edit this to build your own!
#[contract]
pub struct HelloContract;

#[contractimpl]
impl HelloContract {
    /// Returns a friendly greeting
    pub fn hello(env: Env, to: Symbol) -> Vec<Symbol> {
        vec![&env, symbol_short!("Hello"), to]
    }
}
`
  },

  // Example: Voting Contract
  {
    name: "voting.rs",
    path: "/contract/voting.rs",
    language: "rust",
    content: `#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Env, Symbol};

/// Simple voting contract example
/// To use: Copy this code to lib.rs and the test to tests/test.rs!

#[derive(Clone)]
#[contracttype]
pub struct Proposal {
    pub id: u32,
    pub description: Symbol,
    pub yes_votes: u32,
    pub no_votes: u32,
}

#[contract]
pub struct VotingContract;

#[contractimpl]
impl VotingContract {
    /// Create a new proposal
    pub fn create_proposal(env: Env, id: u32, description: Symbol) {
        let proposal = Proposal {
            id,
            description,
            yes_votes: 0,
            no_votes: 0,
        };
        env.storage().instance().set(&id, &proposal);
    }
    
    /// Vote yes on a proposal
    pub fn vote_yes(env: Env, proposal_id: u32) {
        let mut proposal: Proposal = env.storage().instance().get(&proposal_id).unwrap();
        proposal.yes_votes += 1;
        env.storage().instance().set(&proposal_id, &proposal);
    }
    
    /// Vote no on a proposal
    pub fn vote_no(env: Env, proposal_id: u32) {
        let mut proposal: Proposal = env.storage().instance().get(&proposal_id).unwrap();
        proposal.no_votes += 1;
        env.storage().instance().set(&proposal_id, &proposal);
    }
    
    /// Get proposal results
    pub fn get_results(env: Env, proposal_id: u32) -> Proposal {
        env.storage().instance().get(&proposal_id).unwrap()
    }
}
`
  },

  // Example: Token Contract
  {
    name: "token.rs",
    path: "/contract/token.rs",
    language: "rust",
    content: `#![no_std]
use soroban_sdk::{contract, contractimpl, symbol_short, Address, Env, Symbol};

/// Simple token contract example
/// To use: Copy this code to lib.rs and the test to tests/test.rs!

#[contract]
pub struct TokenContract;

#[contractimpl]
impl TokenContract {
    /// Initialize the token with a name and total supply
    pub fn initialize(env: Env, admin: Address, name: Symbol, total_supply: i128) {
        env.storage().instance().set(&symbol_short!("NAME"), &name);
        env.storage().instance().set(&symbol_short!("ADMIN"), &admin);
        
        // Give all tokens to admin
        env.storage().instance().set(&admin, &total_supply);
    }
    
    /// Get token name
    pub fn name(env: Env) -> Symbol {
        env.storage().instance().get(&symbol_short!("NAME")).unwrap()
    }
    
    /// Get balance of an address
    pub fn balance(env: Env, address: Address) -> i128 {
        env.storage().instance().get(&address).unwrap_or(0)
    }
    
    /// Transfer tokens from one address to another
    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();
        
        let from_balance: i128 = env.storage().instance().get(&from).unwrap_or(0);
        let to_balance: i128 = env.storage().instance().get(&to).unwrap_or(0);
        
        if from_balance < amount {
            panic!("Insufficient balance");
        }
        
        env.storage().instance().set(&from, &(from_balance - amount));
        env.storage().instance().set(&to, &(to_balance + amount));
    }
}
`
  },

  // ============================================================================
  // TEST FILES
  // ============================================================================

  // Main contract tests (test.rs)
  {
    name: "test.rs",
    path: "/tests/test.rs",
    language: "rust",
    content: `#![cfg(test)]
use soroban_sdk::{symbol_short, vec, Env};

// We need to redefine the contract here for testing
// In Soroban, tests are compiled separately
use soroban_sdk::{contract, contractimpl, Symbol, Vec};

#[contract]
pub struct HelloContract;

#[contractimpl]
impl HelloContract {
    pub fn hello(env: Env, to: Symbol) -> Vec<Symbol> {
        vec![&env, symbol_short!("Hello"), to]
    }
}

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
fn test_hello_soroban() {
    let env = Env::default();
    let contract_id = env.register_contract(None, HelloContract);
    let client = HelloContractClient::new(&env, &contract_id);

    let result = client.hello(&symbol_short!("Soroban"));
    assert_eq!(
        result,
        vec![&env, symbol_short!("Hello"), symbol_short!("Soroban")]
    );
}
`
  },

  // Voting contract tests
  {
    name: "voting.rs",
    path: "/tests/voting.rs",
    language: "rust",
    content: `#![cfg(test)]
use soroban_sdk::{symbol_short, Env};
use soroban_sdk::{contract, contractimpl, contracttype, Symbol};

// Redefine contract for testing
#[derive(Clone)]
#[contracttype]
pub struct Proposal {
    pub id: u32,
    pub description: Symbol,
    pub yes_votes: u32,
    pub no_votes: u32,
}

#[contract]
pub struct VotingContract;

#[contractimpl]
impl VotingContract {
    pub fn create_proposal(env: Env, id: u32, description: Symbol) {
        let proposal = Proposal {
            id,
            description,
            yes_votes: 0,
            no_votes: 0,
        };
        env.storage().instance().set(&id, &proposal);
    }
    
    pub fn vote_yes(env: Env, proposal_id: u32) {
        let mut proposal: Proposal = env.storage().instance().get(&proposal_id).unwrap();
        proposal.yes_votes += 1;
        env.storage().instance().set(&proposal_id, &proposal);
    }
    
    pub fn vote_no(env: Env, proposal_id: u32) {
        let mut proposal: Proposal = env.storage().instance().get(&proposal_id).unwrap();
        proposal.no_votes += 1;
        env.storage().instance().set(&proposal_id, &proposal);
    }
    
    pub fn get_results(env: Env, proposal_id: u32) -> Proposal {
        env.storage().instance().get(&proposal_id).unwrap()
    }
}

#[test]
fn test_voting() {
    let env = Env::default();
    let contract_id = env.register_contract(None, VotingContract);
    let client = VotingContractClient::new(&env, &contract_id);

    // Create proposal
    client.create_proposal(&1, &symbol_short!("Prop1"));

    // Vote
    client.vote_yes(&1);
    client.vote_yes(&1);
    client.vote_no(&1);

    // Check results
    let results = client.get_results(&1);
    assert_eq!(results.yes_votes, 2);
    assert_eq!(results.no_votes, 1);
}

#[test]
fn test_multiple_proposals() {
    let env = Env::default();
    let contract_id = env.register_contract(None, VotingContract);
    let client = VotingContractClient::new(&env, &contract_id);

    // Create multiple proposals
    client.create_proposal(&1, &symbol_short!("Prop1"));
    client.create_proposal(&2, &symbol_short!("Prop2"));

    // Vote on proposals
    client.vote_yes(&1);
    client.vote_yes(&1);
    client.vote_no(&2);

    // Check results
    let results1 = client.get_results(&1);
    assert_eq!(results1.yes_votes, 2);
    assert_eq!(results1.no_votes, 0);

    let results2 = client.get_results(&2);
    assert_eq!(results2.yes_votes, 0);
    assert_eq!(results2.no_votes, 1);
}
`
  },

  // Token contract tests
  {
    name: "token.rs",
    path: "/tests/token.rs",
    language: "rust",
    content: `#![cfg(test)]
use soroban_sdk::{symbol_short, testutils::Address as _, Address, Env};
use soroban_sdk::{contract, contractimpl, Symbol};

// Redefine contract for testing
#[contract]
pub struct TokenContract;

#[contractimpl]
impl TokenContract {
    pub fn initialize(env: Env, admin: Address, name: Symbol, total_supply: i128) {
        env.storage().instance().set(&symbol_short!("NAME"), &name);
        env.storage().instance().set(&symbol_short!("ADMIN"), &admin);
        env.storage().instance().set(&admin, &total_supply);
    }
    
    pub fn name(env: Env) -> Symbol {
        env.storage().instance().get(&symbol_short!("NAME")).unwrap()
    }
    
    pub fn balance(env: Env, address: Address) -> i128 {
        env.storage().instance().get(&address).unwrap_or(0)
    }
    
    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();
        
        let from_balance: i128 = env.storage().instance().get(&from).unwrap_or(0);
        let to_balance: i128 = env.storage().instance().get(&to).unwrap_or(0);
        
        if from_balance < amount {
            panic!("Insufficient balance");
        }
        
        env.storage().instance().set(&from, &(from_balance - amount));
        env.storage().instance().set(&to, &(to_balance + amount));
    }
}

#[test]
fn test_token_initialize() {
    let env = Env::default();
    let contract_id = env.register_contract(None, TokenContract);
    let client = TokenContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);

    // Initialize token
    client.initialize(&admin, &symbol_short!("TOKEN"), &1000);

    // Check name and balance
    assert_eq!(client.name(), symbol_short!("TOKEN"));
    assert_eq!(client.balance(&admin), 1000);
}

#[test]
fn test_token_transfer() {
    let env = Env::default();
    let contract_id = env.register_contract(None, TokenContract);
    let client = TokenContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    // Initialize and transfer
    client.initialize(&admin, &symbol_short!("COIN"), &1000);
    
    env.mock_all_auths();
    client.transfer(&admin, &user, &100);

    // Check balances
    assert_eq!(client.balance(&admin), 900);
    assert_eq!(client.balance(&user), 100);
}
`
  },
];