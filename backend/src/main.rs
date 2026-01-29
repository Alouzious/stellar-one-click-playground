mod models;
mod app;
mod routes;
mod state;
use tokio::net::TcpListener;

use crate::state::AppState;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();
    let state = AppState::new();
    let app = app::create_router(state);


    let addr = "127.0.0.1:3000";
    let listener = TcpListener::bind(addr).await.unwrap();
    println!("Backend running at http://{}", addr);
    axum::serve(listener, app).await.unwrap();
}