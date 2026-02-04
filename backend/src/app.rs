use axum::Router;
use crate::state::AppState;
use crate::routes::{file::file_routes, project::project_routes, build::build_routes,};

// CORS imports
use tower_http::cors::{CorsLayer, Any};

pub fn create_router(state: AppState) -> Router {
    // Development-friendly CORS: allow all origins, methods, and headers.
    // For production restrict to a known origin instead of `Any`.
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    Router::new()
        .nest("/api/files", file_routes())
        .nest("/api/projects", project_routes())
        .nest("/api", build_routes())
        .with_state(state)
        .layer(cors)
}