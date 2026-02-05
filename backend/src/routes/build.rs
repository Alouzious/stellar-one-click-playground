use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
    routing::post,
    Router,
};
use base64::{engine::general_purpose, Engine as _};
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::{env, fs, time::Duration};
use tempfile::TempDir;
use tokio::{process::Command, time::timeout};
use uuid::Uuid;

use crate::state::AppState;

pub fn build_routes() -> Router<AppState> {
    Router::new()
        .route("/projects/:id/build", post(build_project))
        .route("/projects/:id/test", post(test_project))
        .route("/projects/:id/deploy", post(deploy_project))
}

// ============================================================================
// STRUCTS
// ============================================================================

#[derive(Serialize, Clone, Debug)]
struct CompileError {
    severity: String,  // "error", "warning", "info"
    message: String,
    file: String,
    line: u32,
    column: u32,
    code: Option<String>, // Error code like E0425
}

#[derive(Serialize)]
struct BuildResponse {
    success: bool,
    logs: String,
    wasm_base64: Option<String>,
    message: Option<String>,
    errors: Vec<CompileError>, // ← NEW: Error list
}

#[derive(Serialize)]
struct TestResponse {
    success: bool,
    logs: String,
    message: Option<String>,
}

#[derive(Serialize)]
struct DeployResponse {
    success: bool,
    contract_id: Option<String>,
    logs: String,
    message: Option<String>,
}

#[derive(Deserialize)]
struct BuildRequest {}

#[derive(Deserialize)]
struct TestRequest {}

#[derive(Deserialize)]
struct DeployRequest {
    wasm_base64: String,
    network: String,
}

// ============================================================================
// ERROR PARSING FUNCTION
// ============================================================================

/// Parse Rust compiler errors from output
fn parse_rust_errors(output: &str) -> Vec<CompileError> {
    let mut errors = Vec::new();
    
    // Regex patterns for Rust compiler output
    let error_pattern = Regex::new(
        r"(?m)^(error|warning|help|note)\[?([^\]]*)\]?: (.+?)$"
    ).unwrap();
    
    let location_pattern = Regex::new(
        r"-->\s+([^:]+):(\d+):(\d+)"
    ).unwrap();
    
    let lines: Vec<&str> = output.lines().collect();
    
    for (i, line) in lines.iter().enumerate() {
        // Match error/warning line
        if let Some(caps) = error_pattern.captures(line) {
            let severity_raw = caps.get(1).map_or("error", |m| m.as_str());
            let code = caps.get(2).and_then(|m| {
                let s = m.as_str();
                if s.is_empty() { None } else { Some(s.to_string()) }
            });
            let message = caps.get(3).map_or("Unknown error", |m| m.as_str()).to_string();
            
            // Map severity
            let severity = match severity_raw {
                "warning" => "warning",
                "note" | "help" => "info",
                _ => "error",
            }.to_string();
            
            // Look for location in next few lines
            let mut file = "unknown".to_string();
            let mut line_num = 0;
            let mut col = 0;
            
            for j in (i + 1)..(i + 5).min(lines.len()) {
                if let Some(loc_caps) = location_pattern.captures(lines[j]) {
                    file = loc_caps.get(1).map_or("unknown", |m| m.as_str()).to_string();
                    line_num = loc_caps.get(2)
                        .and_then(|m| m.as_str().parse().ok())
                        .unwrap_or(0);
                    col = loc_caps.get(3)
                        .and_then(|m| m.as_str().parse().ok())
                        .unwrap_or(0);
                    break;
                }
            }
            
            // Only add if we found a valid location
            if line_num > 0 {
                errors.push(CompileError {
                    severity,
                    message,
                    file: normalize_file_path(&file),
                    line: line_num,
                    column: col,
                    code,
                });
            }
        }
    }
    
    errors
}

/// Normalize file paths to match frontend structure
fn normalize_file_path(path: &str) -> String {
    // Remove /work/ prefix if present
    let path = path.strip_prefix("/work/").unwrap_or(path);
    
    // Add leading slash if not present
    if path.starts_with('/') {
        path.to_string()
    } else {
        format!("/{}", path)
    }
}

// ============================================================================
// BUILD PROJECT
// ============================================================================

async fn build_project(
    Path(project_id): Path<Uuid>,
    State(state): State<AppState>,
    Json(_req): Json<BuildRequest>,
) -> Result<Json<BuildResponse>, (StatusCode, String)> {
    // 1. Fetch files from Supabase
    let supabase_url = &state.supabase_url;
    let supabase_key = &state.supabase_service_role_key;

    let url = format!(
        "{}/rest/v1/files?project_id=eq.{}",
        supabase_url, project_id
    );

    let response = state
        .http_client
        .get(&url)
        .header("apikey", supabase_key)
        .header("Authorization", format!("Bearer {}", supabase_key))
        .send()
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to fetch files: {}", e),
            )
        })?;

    let files: Vec<serde_json::Value> = response.json().await.map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to parse files: {}", e),
        )
    })?;

    if files.is_empty() {
        return Ok(Json(BuildResponse {
            success: false,
            logs: String::new(),
            wasm_base64: None,
            message: Some("No files found for this project".to_string()),
            errors: vec![],
        }));
    }

    // 2. Create temp directory
    let temp_dir = TempDir::new().map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to create temp dir: {}", e),
        )
    })?;

    let work_dir = temp_dir.path();

    // 3. Write files to temp directory
    for file in &files {
        let path_str = file["path"].as_str().unwrap_or("");
        let content = file["content"].as_str().unwrap_or("");

        let file_path = work_dir.join(path_str.trim_start_matches('/'));
        if let Some(parent) = file_path.parent() {
            fs::create_dir_all(parent).map_err(|e| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    format!("Failed to create directories: {}", e),
                )
            })?;
        }

        fs::write(&file_path, content).map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to write file: {}", e),
            )
        })?;
    }

    // 4. Run Docker build
    let runner_image = env::var("RUNNER_IMAGE").unwrap_or_else(|_| "soroban-runner".to_string());
    let timeout_secs: u64 = env::var("BUILD_TIMEOUT_SECONDS")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(300);

    let work_dir_str = work_dir.to_string_lossy().to_string();

    let build_script = r#"
        set -e
        cd /work
        
        # Fix ownership to runner user
        chown -R runner:runner /work
        
        echo "=== Building Soroban Contract ==="
        echo "Running as: $(whoami)"
        echo ""
        
        # Now switch to runner and build
        su runner -c '
            set -e
            cd /work
            echo "Switched to user: $(whoami)"
            echo "Files in /work:"
            ls -la /work
            echo ""
            echo "Building with cargo..."
            /home/runner/.cargo/bin/cargo build --target wasm32-unknown-unknown --release 2>&1
            echo ""
            echo "Build complete. Checking output..."
            if [ -d "target/wasm32-unknown-unknown/release" ]; then
                ls -la target/wasm32-unknown-unknown/release/ | grep .wasm || echo "No WASM files found"
            else
                echo "Target directory not created"
            fi
        '
    "#;

    let mut cmd = Command::new("docker");
    cmd.args([
        "run",
        "--rm",
        "--user", "root",
        "--entrypoint", "bash",
        "-v",
        &format!("{}:/work", work_dir_str),
        "-w",
        "/work",
        &runner_image,
        "-c",
        build_script,
    ]);

    let output = match timeout(Duration::from_secs(timeout_secs), cmd.output()).await {
        Ok(Ok(output)) => output,
        Ok(Err(e)) => {
            return Ok(Json(BuildResponse {
                success: false,
                logs: format!("Docker command failed: {}", e),
                wasm_base64: None,
                message: None,
                errors: vec![],
            }));
        }
        Err(_) => {
            return Ok(Json(BuildResponse {
                success: false,
                logs: format!("Build timed out after {} seconds", timeout_secs),
                wasm_base64: None,
                message: None,
                errors: vec![],
            }));
        }
    };

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let combined_output = format!("{}\n{}", stdout, stderr);
    let logs = format!("status: {:?}\n\nstdout:\n{}\n\nstderr:\n{}", output.status, stdout, stderr);

    // ========================================================================
    // PARSE ERRORS FROM COMPILER OUTPUT
    // ========================================================================
    let parsed_errors = parse_rust_errors(&combined_output);
    
    if !parsed_errors.is_empty() {
        println!("🐛 Found {} compilation errors/warnings", parsed_errors.len());
        for error in &parsed_errors {
            println!("  {} [{}:{}:{}] {}", 
                error.severity, error.file, error.line, error.column, error.message);
        }
    }

    // 5. Find and read WASM file
    let wasm_base64 = if output.status.success() {
        let target_dir = work_dir.join("target/wasm32-unknown-unknown/release");
        if let Ok(entries) = fs::read_dir(&target_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().and_then(|s| s.to_str()) == Some("wasm") {
                    if path.to_string_lossy().contains(".d") {
                        continue;
                    }
                    if let Ok(wasm_bytes) = fs::read(&path) {
                        let wasm_filename = path.file_name().unwrap().to_string_lossy();
                        return Ok(Json(BuildResponse {
                            success: true,
                            logs: format!("{}\n\n✅ Found WASM file: {}", logs, wasm_filename),
                            wasm_base64: Some(general_purpose::STANDARD.encode(&wasm_bytes)),
                            message: Some(format!("Built successfully: {}", wasm_filename)),
                            errors: parsed_errors, // Include warnings even on success
                        }));
                    }
                }
            }
        }
        None
    } else {
        None
    };

    let has_wasm = wasm_base64.is_some();
    let success = output.status.success() && has_wasm;
    
    Ok(Json(BuildResponse {
        success,
        logs,
        wasm_base64,
        errors: parsed_errors, // ← NEW: Include errors
        message: if !has_wasm && output.status.success() {
            Some("Build succeeded but no WASM file found".to_string())
        } else {
            None
        },
    }))
}

// ============================================================================
// TEST PROJECT
// ============================================================================

async fn test_project(
    Path(project_id): Path<Uuid>,
    State(state): State<AppState>,
    Json(_req): Json<TestRequest>,
) -> Result<Json<TestResponse>, (StatusCode, String)> {
    // 1. Fetch files from Supabase
    let supabase_url = &state.supabase_url;
    let supabase_key = &state.supabase_service_role_key;

    let url = format!(
        "{}/rest/v1/files?project_id=eq.{}",
        supabase_url, project_id
    );

    let response = state
        .http_client
        .get(&url)
        .header("apikey", supabase_key)
        .header("Authorization", format!("Bearer {}", supabase_key))
        .send()
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to fetch files: {}", e),
            )
        })?;

    let files: Vec<serde_json::Value> = response.json().await.map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to parse files: {}", e),
        )
    })?;

    if files.is_empty() {
        return Ok(Json(TestResponse {
            success: false,
            logs: String::new(),
            message: Some("No files found for this project".to_string()),
        }));
    }

    // 2. Create temp directory
    let temp_dir = TempDir::new().map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to create temp dir: {}", e),
        )
    })?;

    let work_dir = temp_dir.path();

    // 3. Write files to temp directory
    for file in &files {
        let path_str = file["path"].as_str().unwrap_or("");
        let content = file["content"].as_str().unwrap_or("");

        let file_path = work_dir.join(path_str.trim_start_matches('/'));
        if let Some(parent) = file_path.parent() {
            fs::create_dir_all(parent).map_err(|e| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    format!("Failed to create directories: {}", e),
                )
            })?;
        }

        fs::write(&file_path, content).map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to write file: {}", e),
            )
        })?;
    }

    // 4. Run cargo test
    let runner_image = env::var("RUNNER_IMAGE").unwrap_or_else(|_| "soroban-runner".to_string());
    let timeout_secs: u64 = env::var("TEST_TIMEOUT_SECONDS")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(1200);

    let work_dir_str = work_dir.to_string_lossy().to_string();

    let test_script = r#"
        set -e
        cd /work
        
        # Fix ownership to runner user
        chown -R runner:runner /work
        
        echo "=== Running Tests ==="
        echo "Running as: $(whoami)"
        echo ""
        
        # Switch to runner and run tests
        su runner -c '
            set -e
            cd /work
            echo "Switched to user: $(whoami)"
            echo "Running cargo test..."
            /home/runner/.cargo/bin/cargo test 2>&1
        '
    "#;

    let mut cmd = Command::new("docker");
    cmd.args([
        "run",
        "--rm",
        "--user", "root",
        "--entrypoint", "bash",
        "-v",
        &format!("{}:/work", work_dir_str),
        "-w",
        "/work",
        &runner_image,
        "-c",
        test_script,
    ]);

    let output = match timeout(Duration::from_secs(timeout_secs), cmd.output()).await {
        Ok(Ok(output)) => output,
        Ok(Err(e)) => {
            return Ok(Json(TestResponse {
                success: false,
                logs: format!("Docker command failed: {}", e),
                message: None,
            }));
        }
        Err(_) => {
            return Ok(Json(TestResponse {
                success: false,
                logs: format!("Tests timed out after {} seconds", timeout_secs),
                message: None,
            }));
        }
    };

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let logs = format!("status: {:?}\n\nstdout:\n{}\n\nstderr:\n{}", output.status, stdout, stderr);

    Ok(Json(TestResponse {
        success: output.status.success(),
        logs,
        message: if output.status.success() {
            Some("All tests passed! ✅".to_string())
        } else {
            Some("Some tests failed ❌".to_string())
        },
    }))
}

// ============================================================================
// DEPLOY PROJECT
// ============================================================================

async fn deploy_project(
    Path(project_id): Path<Uuid>,
    State(_state): State<AppState>,
    Json(req): Json<DeployRequest>,
) -> Result<Json<DeployResponse>, (StatusCode, String)> {
    // 1. Decode the WASM from base64
    let wasm_bytes = general_purpose::STANDARD
        .decode(&req.wasm_base64)
        .map_err(|e| (StatusCode::BAD_REQUEST, format!("Invalid base64 WASM: {}", e)))?;

    // 2. Create temp directory for deployment
    let temp_dir = TempDir::new().map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to create temp dir: {}", e),
        )
    })?;

    let work_dir = temp_dir.path();
    let wasm_path = work_dir.join("contract.wasm");

    // 3. Write WASM file to temp directory
    fs::write(&wasm_path, wasm_bytes).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to write WASM file: {}", e),
        )
    })?;

    // 4. Run deployment in Docker container
    let runner_image = env::var("RUNNER_IMAGE").unwrap_or_else(|_| "soroban-runner".to_string());
    let timeout_secs: u64 = env::var("DEPLOY_TIMEOUT_SECONDS")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(600);

    let work_dir_str = work_dir.to_string_lossy().to_string();

    let deploy_script = format!(r#"
        set -e
        
        echo "=== Deploying to Stellar {} ==="
        echo "User: $(whoami)"
        echo "Workdir: $(pwd)"
        echo ""
        
        # Fix ownership
        chown -R runner:runner /work
        
        # Switch to runner user for deployment
        su runner -c '
            set -e
            cd /work
            
            echo "WASM file info:"
            ls -lh contract.wasm
            echo ""
            
            echo "Generating deployment identity..."
            stellar keys generate deployer --network {} --fund 2>&1 | grep -v "^error" || true
            sleep 5
            
            DEPLOYER_ADDRESS=$(stellar keys address deployer)
            echo "Deployer address: $DEPLOYER_ADDRESS"
            echo ""
            
            echo "Deploying contract to {}..."
            CONTRACT_ID=$(stellar contract deploy \
                --wasm contract.wasm \
                --source deployer \
                --network {} 2>&1 | tee /tmp/deploy.log | tail -n 1)
            
            # Check if deployment succeeded
            if echo "$CONTRACT_ID" | grep -qE "^C[A-Z0-9]{{55}}$"; then
                echo "✅ Contract deployed!"
                echo "Contract ID: $CONTRACT_ID"
                echo ""
                echo "=== Deployment Summary ==="
                echo "Network: Stellar {}"
                echo "Contract ID: $CONTRACT_ID"
                echo "Deployer: $DEPLOYER_ADDRESS"
            else
                echo "❌ Deployment failed!"
                echo "Output: $CONTRACT_ID"
                cat /tmp/deploy.log || true
                exit 1
            fi
        '
    "#, req.network, req.network, req.network, req.network, req.network);

    let mut cmd = Command::new("docker");
    cmd.args([
        "run",
        "--rm",
        "--user", "root",
        "--entrypoint", "bash",
        "-v",
        &format!("{}:/work", work_dir_str),
        "-w",
        "/work",
        &runner_image,
        "-c",
        &deploy_script,
    ]);

    let output = match timeout(Duration::from_secs(timeout_secs), cmd.output()).await {
        Ok(Ok(output)) => output,
        Ok(Err(e)) => {
            return Ok(Json(DeployResponse {
                success: false,
                contract_id: None,
                logs: format!("Docker command failed: {}", e),
                message: Some("Failed to start deployment container".to_string()),
            }));
        }
        Err(_) => {
            return Ok(Json(DeployResponse {
                success: false,
                contract_id: None,
                logs: format!("Deployment timed out after {} seconds", timeout_secs),
                message: Some("Deployment took too long".to_string()),
            }));
        }
    };

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let combined_logs = format!("status: {:?}\n\nstdout:\n{}\n\nstderr:\n{}", output.status, stdout, stderr);

    // 5. Parse contract ID from output
    let contract_id = stdout
        .lines()
        .find(|line| line.contains("Contract ID:"))
        .and_then(|line| line.split(':').nth(1))
        .map(|id| id.trim().to_string())
        .or_else(|| {
            stdout
                .lines()
                .find(|line| line.contains("C") && line.len() >= 56)
                .and_then(|line| {
                    line.split_whitespace()
                        .find(|word| word.starts_with('C') && word.len() == 56)
                        .map(|s| s.to_string())
                })
        });

    let success = output.status.success() && contract_id.is_some();

    Ok(Json(DeployResponse {
        success,
        contract_id: contract_id.clone(),
        logs: combined_logs,
        message: if success {
            Some(format!(
                "Contract deployed successfully to {} network!",
                req.network
            ))
        } else {
            Some("Deployment failed. Check logs for details.".to_string())
        },
    }))
}