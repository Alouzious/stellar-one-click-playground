use axum::{Router, routing::{get, post}, Json, extract::{State, Path}};
use uuid::Uuid;
use crate::state::AppState;
use crate::models::project::ProjectModel;

pub fn project_routes() -> Router<AppState> {
    Router::new()
        .route("/", post(create_project).get(list_projects))
        .route("/:id", get(get_project))
}

async fn create_project(
    State(state): State<AppState>,
    Json(proj): Json<ProjectModel>,
) -> Json<ProjectModel> {
    let mut projects = state.projects.lock().await;
    let proj = ProjectModel { id: Uuid::new_v4(), ..proj };
    projects.push(proj.clone());
    Json(proj)
}

async fn list_projects(State(state): State<AppState>) -> Json<Vec<ProjectModel>> {
    let projects = state.projects.lock().await;
    Json(projects.clone())
}

async fn get_project(
    State(state): State<AppState>,
    Path(id): Path<Uuid>
) -> Json<Option<ProjectModel>> {
    let projects = state.projects.lock().await;
    Json(projects.iter().find(|p| p.id == id).cloned())
}