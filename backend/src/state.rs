use reqwest::Client;
use std::env;

#[derive(Clone)]
pub struct AppState {
    pub http_client: Client,
    pub supabase_url: String,
    pub supabase_service_role_key: String,
}

impl AppState {
    pub fn new() -> Self {
        let supabase_url = env::var("SUPABASE_URL")
            .expect("SUPABASE_URL must be set in .env");
        let supabase_service_role_key = env::var("SUPABASE_SERVICE_ROLE_KEY")
            .expect("SUPABASE_SERVICE_ROLE_KEY must be set in .env");

        Self {
            http_client: Client::new(),
            supabase_url,
            supabase_service_role_key,
        }
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}