//! Registre des agents et genealogie (la lignee est conservee apres la mort).
use near_sdk::{near, AccountId};

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Cause {
    Starvation,
    Manual,
    Reset,
}

/// Entree fournie par l'operateur pour enregistrer un agent.
#[near(serializers = [json])]
#[derive(Clone, Debug)]
pub struct NewAgent {
    pub agent_id: String,
    pub account_id: AccountId,
    pub parent_id: Option<String>,
    pub generation: u32,
    /// sha256 hex du `genome_json` (verifie par le contrat).
    pub genome_hash: String,
    /// JSON canonique du genome, stocke tel quel (petit).
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
