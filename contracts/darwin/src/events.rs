//! NEP-297 (JSON) events emitted for every write.
use near_sdk::{env, serde_json::Value};

pub const STANDARD: &str = "darwin";
pub const VERSION: &str = "1.0.0";

pub fn emit(event: &str, data: Value) {
    let payload = near_sdk::serde_json::json!({
        "standard": STANDARD,
        "version": VERSION,
        "event": event,
        "data": [data],
    });
    env::log_str(&format!("EVENT_JSON:{}", payload));
}
