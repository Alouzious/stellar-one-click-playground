use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
    routing::post,
    Router,
};
use serde::{Deserialize, Serialize};
use std::{fs, time::Duration};
use tempfile::TempDir;
use tokio::{process::Command, time::timeout};
use uuid::Uuid;

use crate::state::AppState;

pub fn lint_routes() -> Router<AppState> {
    Router::new()
        .route("/projects/:id/lint", post(lint_project))
}

#[derive(Deserialize)]
pub struct LintRequest {}

#[derive(Serialize, Clone, Debug)]
pub struct LintDiagnostic {
    pub severity: String,
    pub message: String,
    pub file: String,
    pub line: u32,
    pub column: u32,
    pub end_line: Option<u32>,
    pub end_column: Option<u32>,
    pub code: Option<String>,
}

#[derive(Serialize)]
pub struct LintResponse {
    pub success: bool,
    pub diagnostics: Vec<LintDiagnostic>,
    pub message: Option<String>,
}

pub async fn lint_project(
    Path(project_id): Path<Uuid>,
    State(state): State<AppState>,
    Json(_req): Json<LintRequest>,
) -> Result<Json<LintResponse>, (StatusCode, String)> {
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
        return Ok(Json(LintResponse {
            success: true,
            diagnostics: vec![],
            message: Some("No files to lint".to_string()),
        }));
    }

    let temp_dir = TempDir::new().map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to create temp dir: {}", e),
        )
    })?;

    let work_dir = temp_dir.path();

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

    let runner_image = std::env::var("RUNNER_IMAGE")
        .unwrap_or_else(|_| "soroban-runner".to_string());
    let timeout_secs: u64 = 10;

    let work_dir_str = work_dir.to_string_lossy().to_string();

    let lint_script = r#"
        set -e
        cd /work
        chown -R runner:runner /work
        su runner -c '
            set -e
            cd /work
            /home/runner/.cargo/bin/cargo check --message-format=json 2>&1
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
        lint_script,
    ]);

    let output = match timeout(Duration::from_secs(timeout_secs), cmd.output()).await {
        Ok(Ok(output)) => output,
        Ok(Err(e)) => {
            return Ok(Json(LintResponse {
                success: false,
                diagnostics: vec![],
                message: Some(format!("Docker command failed: {}", e)),
            }));
        }
        Err(_) => {
            return Ok(Json(LintResponse {
                success: false,
                diagnostics: vec![],
                message: Some("Lint check timed out".to_string()),
            }));
        }
    };

    let stdout = String::from_utf8_lossy(&output.stdout);
    let diagnostics = parse_cargo_diagnostics(&stdout);

    Ok(Json(LintResponse {
        success: true,
        diagnostics,
        message: None,
    }))
}

fn parse_cargo_diagnostics(output: &str) -> Vec<LintDiagnostic> {
    let mut diagnostics = Vec::new();
    
    for line in output.lines() {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(line) {
            if let Some(reason) = json.get("reason").and_then(|r| r.as_str()) {
                if reason == "compiler-message" {
                    if let Some(message) = json.get("message") {
                        if let Some(diag) = parse_diagnostic_message(message) {
                            diagnostics.push(diag);
                        }
                    }
                }
            }
        }
    }
    
    diagnostics
}

fn parse_diagnostic_message(message: &serde_json::Value) -> Option<LintDiagnostic> {
    let level = message.get("level")?.as_str()?;
    let text = message.get("message")?.as_str()?;
    let code = message.get("code")
        .and_then(|c| c.get("code"))
        .and_then(|c| c.as_str())
        .map(|s| s.to_string());
    
    let severity = match level {
        "error" | "error: internal compiler error" => "error",
        "warning" => "warning",
        "note" | "help" => "info",
        _ => "hint",
    }.to_string();
    
    let spans = message.get("spans")?.as_array()?;
    let primary_span = spans.iter()
        .find(|s| s.get("is_primary").and_then(|p| p.as_bool()).unwrap_or(false))?;
    
    let file_name = primary_span.get("file_name")?.as_str()?;
    let line_start = primary_span.get("line_start")?.as_u64()? as u32;
    let column_start = primary_span.get("column_start")?.as_u64()? as u32;
    let line_end = primary_span.get("line_end").and_then(|l| l.as_u64()).map(|l| l as u32);
    let column_end = primary_span.get("column_end").and_then(|c| c.as_u64()).map(|c| c as u32);
    
    let normalized_path = normalize_file_path(file_name);
    
    Some(LintDiagnostic {
        severity,
        message: text.to_string(),
        file: normalized_path,
        line: line_start,
        column: column_start,
        end_line: line_end,
        end_column: column_end,
        code,
    })
}

fn normalize_file_path(path: &str) -> String {
    let path = path.strip_prefix("/work/").unwrap_or(path);
    if path.starts_with('/') {
        path.to_string()
    } else {
        format!("/{}", path)
    }
}