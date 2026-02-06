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
    severity: String,
    message: String,
    file: String,
    line: u32,
    column: u32,
    code: Option<String>,
}

#[derive(Serialize, Clone, Debug)]
struct ProgressUpdate {
    progress: u8,
    step: String,
    message: String,
}

#[derive(Serialize)]
struct BuildResponse {
    success: bool,
    logs: String,
    wasm_base64: Option<String>,
    message: Option<String>,
    errors: Vec<CompileError>,
    progress_updates: Vec<ProgressUpdate>,
}

#[derive(Serialize)]
struct TestResponse {
    success: bool,
    logs: String,
    message: Option<String>,
    progress_updates: Vec<ProgressUpdate>,
}

#[derive(Serialize)]
struct DeployResponse {
    success: bool,
    contract_id: Option<String>,
    logs: String,
    message: Option<String>,
    progress_updates: Vec<ProgressUpdate>,
}

#[derive(Deserialize)]
struct BuildRequest {}

#[derive(Deserialize)]
struct TestRequest {
    #[serde(default)]
    pub active_file: Option<String>,
}

#[derive(Deserialize)]
struct DeployRequest {
    wasm_base64: String,
    network: String,
}

// ============================================================================
// HELPER: Determine which test file to run based on active file
// ============================================================================

fn get_test_file_from_active(active_file: &Option<String>) -> Option<String> {
    if let Some(path) = active_file {
        // If user is in a test file, run that test
        if path.starts_with("/tests/") && path.ends_with(".rs") {
            let filename = path.trim_start_matches("/tests/").trim_end_matches(".rs");
            return Some(filename.to_string());
        }
        
        // If user is in contract files, map to corresponding tests
        if path.contains("lib.rs") {
            return Some("test".to_string());
        } else if path.contains("voting.rs") {
            return Some("voting".to_string());
        } else if path.contains("token.rs") {
            return Some("token".to_string());
        }
    }
    None // Run all tests if no specific match
}

// ============================================================================
// PROGRESS TRACKING
// ============================================================================

fn estimate_progress_from_logs(logs: &str, operation: &str) -> Vec<ProgressUpdate> {
    let mut updates = Vec::new();
    
    match operation {
        "build" => {
            if logs.contains("Compiling") {
                let count = logs.matches("Compiling").count();
                let progress = (20 + (count * 10).min(50)) as u8;
                updates.push(ProgressUpdate {
                    progress,
                    step: format!("Compiling ({} crates)", count),
                    message: "Building dependencies and contract code...".to_string(),
                });
            }
            if logs.contains("Finished") {
                updates.push(ProgressUpdate {
                    progress: 90,
                    step: "Compilation complete".to_string(),
                    message: "Generating WASM binary...".to_string(),
                });
            }
        }
        "test" => {
            if logs.contains("running") && logs.contains("test") {
                let test_count = logs.matches("test ").count();
                let progress = (30 + (test_count * 5).min(60)) as u8;
                updates.push(ProgressUpdate {
                    progress,
                    step: format!("Running tests ({} tests)", test_count),
                    message: "Executing test suite...".to_string(),
                });
            }
            if logs.contains("test result:") {
                updates.push(ProgressUpdate {
                    progress: 95,
                    step: "Tests completed".to_string(),
                    message: "Collecting results...".to_string(),
                });
            }
        }
        "deploy" => {
            if logs.contains("Generating deployment identity") {
                updates.push(ProgressUpdate {
                    progress: 20,
                    step: "Creating deployer account".to_string(),
                    message: "Generating keypair...".to_string(),
                });
            }
            if logs.contains("Deployer address") {
                updates.push(ProgressUpdate {
                    progress: 40,
                    step: "Funding account".to_string(),
                    message: "Requesting testnet XLM...".to_string(),
                });
            }
            if logs.contains("Deploying contract") {
                updates.push(ProgressUpdate {
                    progress: 60,
                    step: "Uploading to network".to_string(),
                    message: "Submitting transaction...".to_string(),
                });
            }
            if logs.contains("Contract ID:") {
                updates.push(ProgressUpdate {
                    progress: 95,
                    step: "Deployment complete".to_string(),
                    message: "Contract is live!".to_string(),
                });
            }
        }
        _ => {}
    }
    
    updates
}

// ============================================================================
// ERROR PARSING
// ============================================================================

fn parse_rust_errors(output: &str) -> Vec<CompileError> {
    let mut errors = Vec::new();
    
    let error_pattern = Regex::new(
        r"(?m)^(error|warning|help|note)\[?([^\]]*)\]?: (.+?)$"
    ).unwrap();
    
    let location_pattern = Regex::new(
        r"-->\s+([^:]+):(\d+):(\d+)"
    ).unwrap();
    
    let lines: Vec<&str> = output.lines().collect();
    
    for (i, line) in lines.iter().enumerate() {
        if let Some(caps) = error_pattern.captures(line) {
            let severity_raw = caps.get(1).map_or("error", |m| m.as_str());
            let code = caps.get(2).and_then(|m| {
                let s = m.as_str();
                if s.is_empty() { None } else { Some(s.to_string()) }
            });
            let message = caps.get(3).map_or("Unknown error", |m| m.as_str()).to_string();
            
            let severity = match severity_raw {
                "warning" => "warning",
                "note" | "help" => "info",
                _ => "error",
            }.to_string();
            
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

fn normalize_file_path(path: &str) -> String {
    let path = path.strip_prefix("/work/").unwrap_or(path);
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
    let supabase_url = &state.supabase_url;
    let supabase_key = &state.supabase_service_role_key;

    let url = format!("{}/rest/v1/files?project_id=eq.{}", supabase_url, project_id);

    let response = state
        .http_client
        .get(&url)
        .header("apikey", supabase_key)
        .header("Authorization", format!("Bearer {}", supabase_key))
        .send()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to fetch files: {}", e)))?;

    let files: Vec<serde_json::Value> = response.json().await.map_err(|e| {
        (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to parse files: {}", e))
    })?;

    if files.is_empty() {
        return Ok(Json(BuildResponse {
            success: false,
            logs: String::new(),
            wasm_base64: None,
            message: Some("No files found for this project".to_string()),
            errors: vec![],
            progress_updates: vec![],
        }));
    }

    let temp_dir = TempDir::new().map_err(|e| {
        (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to create temp dir: {}", e))
    })?;

    let work_dir = temp_dir.path();

    for file in &files {
        let path_str = file["path"].as_str().unwrap_or("");
        let content = file["content"].as_str().unwrap_or("");
        let file_path = work_dir.join(path_str.trim_start_matches('/'));
        
        if let Some(parent) = file_path.parent() {
            fs::create_dir_all(parent).map_err(|e| {
                (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to create directories: {}", e))
            })?;
        }
        fs::write(&file_path, content).map_err(|e| {
            (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to write file: {}", e))
        })?;
    }

    let runner_image = env::var("RUNNER_IMAGE").unwrap_or_else(|_| "soroban-runner".to_string());
    let timeout_secs: u64 = env::var("BUILD_TIMEOUT_SECONDS")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(300);

    let work_dir_str = work_dir.to_string_lossy().to_string();

    let build_script = r#"
        set -e
        cd /work
        chown -R runner:runner /work
        
        echo "=== Building Soroban Contract ==="
        su runner -c '
            set -e
            cd /work
            echo "Starting build..."
            /home/runner/.cargo/bin/cargo build --target wasm32-unknown-unknown --release 2>&1
            echo "Build finished."
        '
    "#;

    let mut cmd = Command::new("docker");
    cmd.args([
        "run", "--rm", "--user", "root", "--entrypoint", "bash",
        "-v", &format!("{}:/work", work_dir_str),
        "-w", "/work",
        &runner_image,
        "-c", build_script,
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
                progress_updates: vec![],
            }));
        }
        Err(_) => {
            return Ok(Json(BuildResponse {
                success: false,
                logs: format!("Build timed out after {} seconds", timeout_secs),
                wasm_base64: None,
                message: None,
                errors: vec![],
                progress_updates: vec![],
            }));
        }
    };

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let combined_output = format!("{}\n{}", stdout, stderr);
    let logs = format!("status: {:?}\n\nstdout:\n{}\n\nstderr:\n{}", output.status, stdout, stderr);

    let parsed_errors = parse_rust_errors(&combined_output);
    let progress_updates = estimate_progress_from_logs(&combined_output, "build");

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
                            errors: parsed_errors,
                            progress_updates,
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
        errors: parsed_errors,
        progress_updates,
        message: if !has_wasm && output.status.success() {
            Some("Build succeeded but no WASM file found".to_string())
        } else {
            None
        },
    }))
}

// ============================================================================
// TEST PROJECT - SMART TESTING (ONLY ACTIVE FILE)
// ============================================================================

async fn test_project(
    Path(project_id): Path<Uuid>,
    State(state): State<AppState>,
    Json(req): Json<TestRequest>,
) -> Result<Json<TestResponse>, (StatusCode, String)> {
    let supabase_url = &state.supabase_url;
    let supabase_key = &state.supabase_service_role_key;

    let url = format!("{}/rest/v1/files?project_id=eq.{}", supabase_url, project_id);

    let response = state
        .http_client
        .get(&url)
        .header("apikey", supabase_key)
        .header("Authorization", format!("Bearer {}", supabase_key))
        .send()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to fetch files: {}", e)))?;

    let files: Vec<serde_json::Value> = response.json().await.map_err(|e| {
        (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to parse files: {}", e))
    })?;

    if files.is_empty() {
        return Ok(Json(TestResponse {
            success: false,
            logs: String::new(),
            message: Some("No files found".to_string()),
            progress_updates: vec![],
        }));
    }

    let temp_dir = TempDir::new().map_err(|e| {
        (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to create temp dir: {}", e))
    })?;

    let work_dir = temp_dir.path();

    for file in &files {
        let path_str = file["path"].as_str().unwrap_or("");
        let content = file["content"].as_str().unwrap_or("");
        let file_path = work_dir.join(path_str.trim_start_matches('/'));
        
        if let Some(parent) = file_path.parent() {
            fs::create_dir_all(parent).map_err(|e| {
                (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to create directories: {}", e))
            })?;
        }
        fs::write(&file_path, content).map_err(|e| {
            (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to write file: {}", e))
        })?;
    }

    let runner_image = env::var("RUNNER_IMAGE").unwrap_or_else(|_| "soroban-runner".to_string());
    let timeout_secs: u64 = 1200;
    let work_dir_str = work_dir.to_string_lossy().to_string();

    // ========================================================================
    // SMART TESTING: Determine which test to run based on active file
    // ========================================================================
    let test_file = get_test_file_from_active(&req.active_file);
    
    let (test_command, test_description) = if let Some(test_name) = test_file {
        (
            format!("/home/runner/.cargo/bin/cargo test --test {} 2>&1", test_name),
            format!("Running tests for: {}.rs", test_name)
        )
    } else {
        (
            "/home/runner/.cargo/bin/cargo test 2>&1".to_string(),
            "Running ALL tests".to_string()
        )
    };

    let test_script = format!(r#"
        set -e
        cd /work
        chown -R runner:runner /work
        
        echo "=== {} ==="
        su runner -c '
            set -e
            cd /work
            {}
        '
    "#, test_description, test_command);

    let mut cmd = Command::new("docker");
    cmd.args([
        "run", "--rm", "--user", "root", "--entrypoint", "bash",
        "-v", &format!("{}:/work", work_dir_str),
        "-w", "/work",
        &runner_image,
        "-c", &test_script,
    ]);

    let output = match timeout(Duration::from_secs(timeout_secs), cmd.output()).await {
        Ok(Ok(output)) => output,
        Ok(Err(e)) => {
            return Ok(Json(TestResponse {
                success: false,
                logs: format!("Docker command failed: {}", e),
                message: None,
                progress_updates: vec![],
            }));
        }
        Err(_) => {
            return Ok(Json(TestResponse {
                success: false,
                logs: format!("Tests timed out after {} seconds", timeout_secs),
                message: None,
                progress_updates: vec![],
            }));
        }
    };

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let combined_output = format!("{}\n{}", stdout, stderr);
    let logs = format!("status: {:?}\n\nstdout:\n{}\n\nstderr:\n{}", output.status, stdout, stderr);

    let progress_updates = estimate_progress_from_logs(&combined_output, "test");

    Ok(Json(TestResponse {
        success: output.status.success(),
        logs,
        progress_updates,
        message: if output.status.success() {
            Some("Tests passed! ✅".to_string())
        } else {
            Some("Tests failed ❌".to_string())
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
    let wasm_bytes = general_purpose::STANDARD
        .decode(&req.wasm_base64)
        .map_err(|e| (StatusCode::BAD_REQUEST, format!("Invalid base64 WASM: {}", e)))?;

    let temp_dir = TempDir::new().map_err(|e| {
        (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to create temp dir: {}", e))
    })?;

    let work_dir = temp_dir.path();
    let wasm_path = work_dir.join("contract.wasm");

    fs::write(&wasm_path, wasm_bytes).map_err(|e| {
        (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to write WASM file: {}", e))
    })?;

    let runner_image = env::var("RUNNER_IMAGE").unwrap_or_else(|_| "soroban-runner".to_string());
    let timeout_secs: u64 = 600;
    let work_dir_str = work_dir.to_string_lossy().to_string();

    let deploy_script = format!(r#"
        set -e
        echo "=== Deploying to Stellar {} ==="
        chown -R runner:runner /work
        
        su runner -c '
            set -e
            cd /work
            echo "Generating deployment identity..."
            stellar keys generate deployer --network {} --fund 2>&1 | grep -v "^error" || true
            sleep 5
            
            DEPLOYER_ADDRESS=$(stellar keys address deployer)
            echo "Deployer address: $DEPLOYER_ADDRESS"
            
            echo "Deploying contract to {}..."
            CONTRACT_ID=$(stellar contract deploy \
                --wasm contract.wasm \
                --source deployer \
                --network {} 2>&1 | tee /tmp/deploy.log | tail -n 1)
            
            if echo "$CONTRACT_ID" | grep -qE "^C[A-Z0-9]{{55}}$"; then
                echo "✅ Contract deployed!"
                echo "Contract ID: $CONTRACT_ID"
            else
                echo "❌ Deployment failed!"
                exit 1
            fi
        '
    "#, req.network, req.network, req.network, req.network);

    let mut cmd = Command::new("docker");
    cmd.args([
        "run", "--rm", "--user", "root", "--entrypoint", "bash",
        "-v", &format!("{}:/work", work_dir_str),
        "-w", "/work",
        &runner_image,
        "-c", &deploy_script,
    ]);

    let output = match timeout(Duration::from_secs(timeout_secs), cmd.output()).await {
        Ok(Ok(output)) => output,
        Ok(Err(e)) => {
            return Ok(Json(DeployResponse {
                success: false,
                contract_id: None,
                logs: format!("Docker command failed: {}", e),
                message: Some("Failed to start deployment".to_string()),
                progress_updates: vec![],
            }));
        }
        Err(_) => {
            return Ok(Json(DeployResponse {
                success: false,
                contract_id: None,
                logs: format!("Deployment timed out after {} seconds", timeout_secs),
                message: Some("Deployment took too long".to_string()),
                progress_updates: vec![],
            }));
        }
    };

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let combined_output = format!("{}\n{}", stdout, stderr);
    let logs = format!("status: {:?}\n\nstdout:\n{}\n\nstderr:\n{}", output.status, stdout, stderr);

    let progress_updates = estimate_progress_from_logs(&combined_output, "deploy");

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
        logs,
        progress_updates,
        message: if success {
            Some(format!("Contract deployed successfully to {} network!", req.network))
        } else {
            Some("Deployment failed. Check logs for details.".to_string())
        },
    }))
}