use axum::{Router, routing::{get, post}, Json, extract::{State, Path}};
use uuid::Uuid;
use crate::state::AppState;
use crate::models::file::FileModel;

pub fn file_routes() -> Router<AppState> {
    Router::new()
        .route("/", post(create_file).get(list_files))
        .route("/:id", get(get_file)) // Can add update/delete here
}

async fn create_file(
    State(state): State<AppState>,
    Json(file): Json<FileModel>,
) -> Json<FileModel> {
    let mut files = state.files.lock().await;
    let file = FileModel { id: Uuid::new_v4(), ..file };
    files.push(file.clone());
    Json(file)
}

async fn list_files(
    State(state): State<AppState>
) -> Json<Vec<FileModel>> {
    let files = state.files.lock().await;
    Json(files.clone())
}

async fn get_file(
    Path(id): Path<Uuid>,
    State(state): State<AppState>
) -> Json<Option<FileModel>> {
    let files = state.files.lock().await;
    Json(files.iter().find(|f| f.id == id).cloned())
}