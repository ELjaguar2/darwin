//! Agent registry and genealogy (the lineage is kept after death).
use near_sdk::{near, AccountId};

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Cause {
    Starvation,
    Manual,
    Reset,
}

/// Input supplied by the operator to register an agent.
#[near(serializers = [json])]
#[derive(Clone, Debug)]
pub struct NewAgent {
    pub agent_id: String,
    pub account_id: AccountId,
    pub parent_id: Option<String>,
    pub generation: u32,
    /// sha256 hex of `genome_json` (checked by the contract).
    pub genome_hash: String,
    /// Canonical genome JSON, stored as is (small).
    pub genome_json: String,
    pub birth_tick: u64,
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug)]
pub struct AgentRecord {
    pub agent_id: String,
    pub account_id: AccountId,
    pub parent_id: Option<String>,
    pub generation: u32,
    pub genome_hash: String,
    pub genome_json: String,
    pub birth_tick: u64,
    pub alive: bool,
    pub death_tick: Option<u64>,
    pub cause: Option<Cause>,
}

pub const MAX_ID_LEN: usize = 64;
pub const MAX_GENOME_JSON_LEN: usize = 4096;
