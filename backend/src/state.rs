use crate::models::{file::FileModel, project::ProjectModel};
use std::sync::Arc;
use tokio::sync::Mutex;

#[derive(Clone, Default)]
pub struct AppState {
    pub files: Arc<Mutex<Vec<FileModel>>>,
    pub projects: Arc<Mutex<Vec<ProjectModel>>>,
}