use axum::{
    Router, 
    routing::{get, post}, 
    Json, 
    extract::{State, Path},
    http::StatusCode,
};
use uuid::Uuid;
use crate::state::AppState;
use crate::models::project::{ProjectModel, NewProject};

pub fn project_routes() -> Router<AppState> {
    Router::new()
        .route("/", post(create_project).get(list_projects))
        .route("/:id", get(get_project))
}

async fn create_project(
    State(state): State<AppState>,
    Json(new_proj): Json<NewProject>,
) -> Result<Json<ProjectModel>, (StatusCode, String)> {
    let url = format!("{}/rest/v1/projects", state.supabase_url.trim_end_matches('/'));
    
    // Prepare the project data - let Supabase generate id and created_at
    let body = serde_json::json!({
        "name": new_proj.name,
    });

    let response = state.http_client
        .post(&url)
        .header("apikey", &state.supabase_service_role_key)
        .header("Authorization", format!("Bearer {}", &state.supabase_service_role_key))
        .header("Content-Type", "application/json")
        .header("Prefer", "return=representation") // Tell Supabase to return the created row
        .json(&body)
        .send()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Request failed: {}", e)))?;

    let status = response.status();
    if !status.is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err((
            StatusCode::from_u16(status.as_u16()).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR), 
            format!("Supabase error: {}", error_text)
        ));
    }

    let mut projects: Vec<ProjectModel> = response.json().await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("JSON parse error: {}", e)))?;

    projects.pop()
        .ok_or((StatusCode::INTERNAL_SERVER_ERROR, "No project returned".to_string()))
        .map(Json)
}

async fn list_projects(
    State(state): State<AppState>,
) -> Result<Json<Vec<ProjectModel>>, (StatusCode, String)> {
    let url = format!("{}/rest/v1/projects?select=*&order=created_at.desc", 
                     state.supabase_url.trim_end_matches('/'));

    let response = state.http_client
        .get(&url)
        .header("apikey", &state.supabase_service_role_key)
        .header("Authorization", format!("Bearer {}", &state.supabase_service_role_key))
        .send()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Request failed: {}", e)))?;

    let status = response.status();
    if !status.is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err((
            StatusCode::from_u16(status.as_u16()).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR),
            format!("Supabase error: {}", error_text)
        ));
    }

    let projects: Vec<ProjectModel> = response.json().await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("JSON parse error: {}", e)))?;

    Ok(Json(projects))
}

async fn get_project(
    State(state): State<AppState>,
    Path(id): Path<Uuid>
) -> Result<Json<ProjectModel>, (StatusCode, String)> {
    let url = format!("{}/rest/v1/projects?id=eq.{}&select=*", 
                     state.supabase_url.trim_end_matches('/'), id);

    let response = state.http_client
        .get(&url)
        .header("apikey", &state.supabase_service_role_key)
        .header("Authorization", format!("Bearer {}", &state.supabase_service_role_key))
        .send()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Request failed: {}", e)))?;

    let status = response.status();
    if !status.is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err((
            StatusCode::from_u16(status.as_u16()).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR),
            format!("Supabase error: {}", error_text)
        ));
    }

    let mut projects: Vec<ProjectModel> = response.json().await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("JSON parse error: {}", e)))?;

    projects.pop()
        .ok_or((StatusCode::NOT_FOUND, "Project not found".to_string()))
        .map(Json)
}