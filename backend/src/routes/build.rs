use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
    routing::post,
    Router,
};
use base64::{engine::general_purpose, Engine as _};
use serde::{Deserialize, Serialize};
use std::{env, fs, time::Duration};
use tempfile::TempDir;
use tokio::{process::Command, time::timeout};
use uuid::Uuid;

use crate::state::AppState;

pub fn build_routes() -> Router<AppState> {
    Router::new().route("/projects/:id/build", post(build_project))
}

#[derive(Serialize)]
struct BuildResponse {
    success: bool,
    logs: String,
    wasm_base64: Option<String>,
    message: Option<String>,
}

#[derive(Deserialize)]
struct BuildRequest {}

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

    // 4. Run Docker build - use the runner user's cargo directly
    let runner_image = env::var("RUNNER_IMAGE").unwrap_or_else(|_| "soroban-runner".to_string());
    let timeout_secs: u64 = env::var("BUILD_TIMEOUT_SECONDS")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(90);

    let work_dir_str = work_dir.to_string_lossy().to_string();

    // Build script - run as root to fix permissions, then build as runner
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
        "--user", "root",  // Run as root to fix permissions
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
            }));
        }
        Err(_) => {
            return Ok(Json(BuildResponse {
                success: false,
                logs: format!("Build timed out after {} seconds", timeout_secs),
                wasm_base64: None,
                message: None,
            }));
        }
    };

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let logs = format!("status: {:?}\n\nstdout:\n{}\n\nstderr:\n{}", output.status, stdout, stderr);

    // 5. Find and read WASM file - look for any .wasm file
    let wasm_base64 = if output.status.success() {
        let target_dir = work_dir.join("target/wasm32-unknown-unknown/release");
        if let Ok(entries) = fs::read_dir(&target_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().and_then(|s| s.to_str()) == Some("wasm") {
                    // Skip .d files
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
        message: if !has_wasm && output.status.success() {
            Some("Build succeeded but no WASM file found".to_string())
        } else {
            None
        },
    }))
}