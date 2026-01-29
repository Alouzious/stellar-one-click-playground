use axum::{Router, routing::{get, post}, Json, extract::{State, Path}};
use uuid::Uuid;
use crate::state::AppState;
use crate::models::file::FileModel;

pub fn file_routes() -> Router<AppState> {
    Router::new()
        .route("/", post(create_file).get(list_files))
        .route("/:id", get(get_file))
}

// Input type for creating a file (no id)
#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct NewFile {
    pub project_id: Uuid,
    pub name: String,
    pub path: String,
    pub language: String,
    pub content: String,
}

async fn create_file(
    State(state): State<AppState>,
    Json(file): Json<NewFile>,
) -> Json<FileModel> {
    let url = format!("{}/rest/v1/files", state.supabase_url);
    
    let payload = serde_json::json!({
        "project_id": file.project_id,
        "name": file.name,
        "path": file.path,
        "language": file.language,
        "content": file.content
    });

    let response = state.http_client
        .post(&url)
        .header("apikey", &state.supabase_service_role_key)
        .header("Authorization", format!("Bearer {}", &state.supabase_service_role_key))
        .header("Content-Type", "application/json")
        .header("Prefer", "return=representation")
        .json(&payload)
        .send()
        .await
        .expect("Failed to create file");

    let created_file: Vec<FileModel> = response.json().await.expect("Failed to parse response");
    Json(created_file.into_iter().next().expect("No file returned"))
}

async fn list_files(
    State(state): State<AppState>
) -> Json<Vec<FileModel>> {
    let url = format!("{}/rest/v1/files?select=id,project_id,name,path,language,content", state.supabase_url);
    
    let response = state.http_client
        .get(&url)
        .header("apikey", &state.supabase_service_role_key)
        .header("Authorization", format!("Bearer {}", &state.supabase_service_role_key))
        .send()
        .await
        .expect("Failed to fetch files");

    // Parse as raw JSON first to debug
    let text = response.text().await.expect("Failed to get response text");
    
    // Try to parse, if it fails, return empty list with error logged
    match serde_json::from_str::<Vec<FileModel>>(&text) {
        Ok(files) => Json(files),
        Err(e) => {
            eprintln!("Failed to parse files: {}", e);
            eprintln!("Response was: {}", text);
            Json(vec![])
        }
    }
}

async fn get_file(
    Path(id): Path<Uuid>,
    State(state): State<AppState>
) -> Json<Option<FileModel>> {
    let url = format!("{}/rest/v1/files?id=eq.{}&select=id,project_id,name,path,language,content", state.supabase_url, id);
    
    let response = state.http_client
        .get(&url)
        .header("apikey", &state.supabase_service_role_key)
        .header("Authorization", format!("Bearer {}", &state.supabase_service_role_key))
        .send()
        .await
        .expect("Failed to fetch file");

    let files: Vec<FileModel> = response.json().await.unwrap_or_default();
    Json(files.into_iter().next())
}