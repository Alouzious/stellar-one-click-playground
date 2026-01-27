use serde::{Serialize, Deserialize};
use uuid::Uuid;

#[derive(Serialize, Deserialize, Clone)]
pub struct FileModel {
    pub id: Uuid,
    pub project_id: Uuid,
    pub name: String,
    pub path: String,
    pub language: String,
    pub content: String,
}