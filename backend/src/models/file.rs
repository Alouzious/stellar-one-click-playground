use serde::{Serialize, Deserialize};
use uuid::Uuid;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct FileModel {
    pub id: Uuid,
    pub project_id: Uuid,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user_id: Option<Uuid>,  // Changed to Option<Uuid> to handle NULL values
    pub name: String,
    pub path: String,
    pub language: String,
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<String>,
}

// Input type for creating a file (no id)
#[derive(Serialize, Deserialize, Clone)]
pub struct NewFile {
    pub project_id: Uuid,
    pub name: String,
    pub path: String,
    pub language: String,
    pub content: String,
}