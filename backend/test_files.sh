#!/bin/bash

# Add Cargo.toml
curl -s -X POST http://127.0.0.1:3000/api/files \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "'"$PROJECT_ID"'",
    "name": "Cargo.toml",
    "path": "/Cargo.toml",
    "language": "toml",
    "content": "[package]\nname = \"demo\"\nversion = \"0.1.0\"\nedition = \"2021\"\n\n[lib]\ncrate-type = [\"cdylib\"]\n\n[dependencies]\nsoroban-sdk = \"21.7.7\"\n"
  }' | jq .

echo "---"

# Add lib.rs
curl -s -X POST http://127.0.0.1:3000/api/files \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "'"$PROJECT_ID"'",
    "name": "lib.rs",
    "path": "/contract/lib.rs",
    "language": "rust",
    "content": "#![no_std]\nuse soroban_sdk::*;\n\n#[contracttype]\npub struct HelloContract;\n\n#[contractimpl]\nimpl HelloContract {\n  pub fn hello() -> &'\''static str { \"Hello, Soroban!\" }\n}\n"
  }' | jq .
