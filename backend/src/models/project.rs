use serde::{Serialize, Deserialize};
use uuid::Uuid;

#[derive(Serialize, Deserialize, Clone)]
pub struct ProjectModel {
    pub id: Uuid,
    pub name: String,
    pub created_at: String,
}