use axum::Router;
use crate::state::AppState;
use crate::routes::{file::file_routes, project::project_routes};

pub fn create_router(state: AppState) -> Router {
    Router::new()
        .nest("/api/files", file_routes())
        .nest("/api/projects", project_routes())
        .with_state(state)
}