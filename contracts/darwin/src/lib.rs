//! Contrat Darwin : registre des agents + sequestre des taches + reputation.
//!
//! Modele de confiance (D-015, D-024) : l'operateur (compte maitre) est l'oracle de validation.
//! Le contrat garantit seulement que : (1) l'argent verrouille ne sort que par `release_escrow`
//! avec une preuve `accepted` ou par `refund_escrow` pour `rejected`/`expired` ; (2) la reputation
//! ne se credite qu'apres une liberation confirmee correspondant a la preuve ; (3) la lignee est
//! conservee. Ce n'est pas "trustless".
pub mod escrow;
pub mod events;
pub mod registry;

use escrow::{Escrow, EscrowStatus, RefundReason, ReleaseProof};
use near_sdk::json_types::U128;
use near_sdk::serde_json::json;
use near_sdk::store::{IterableMap, LookupMap, LookupSet};
use near_sdk::{
    env, near, require, AccountId, BorshStorageKey, NearToken, PanicOnDefault, Promise, PromiseError,
};
use registry::{AgentRecord, Cause, NewAgent, MAX_GENOME_JSON_LEN, MAX_ID_LEN};

pub const MAX_LIST_LIMIT: u64 = 100;
pub const MAX_REPUTATION_DELTA: i32 = 100;

#[derive(BorshStorageKey)]
#[near]
enum StorageKey {
    Agents,
    Escrows,
    Reputation,
    RepApplied,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Darwin {
    operator: AccountId,
    agents: IterableMap<String, AgentRecord>,
    escrows: LookupMap<String, Escrow>,
    reputation: LookupMap<String, i64>,
    /// Cles "task_id|agent_id" deja creditees (une seule ecriture de reputation par tache et agent).
    rep_applied: LookupSet<String>,
}

fn sha256_hex(s: &str) -> String {
    env::sha256(s.as_bytes()).iter().map(|b| format!("{:02x}", b)).collect()
}

fn valid_id(s: &str) -> bool {
    !s.is_empty()
        && s.len() <= MAX_ID_LEN
        && s.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_' || b == b'.')
}

#[near]
impl Darwin {
    #[init]
    pub fn new(operator: AccountId) -> Self {
        Self {
            operator,
            agents: IterableMap::new(StorageKey::Agents),
            escrows: LookupMap::new(StorageKey::Escrows),
            reputation: LookupMap::new(StorageKey::Reputation),
            rep_applied: LookupSet::new(StorageKey::RepApplied),
        }
    }

    fn assert_operator(&self) {
        require!(env::predecessor_account_id() == self.operator, "Reserve a l'operateur");
    }

    // ------------------------------------------------------------------ registre

    pub fn register_agent(&mut self, record: NewAgent) {
        self.assert_operator();
        require!(valid_id(&record.agent_id), "agent_id invalide");
        require!(!self.agents.contains_key(&record.agent_id), "ALREADY_REGISTERED");
        require!(record.genome_json.len() <= MAX_GENOME_JSON_LEN, "genome trop gros");
        require!(
            sha256_hex(&record.genome_json) == record.genome_hash.to_lowercase(),
            "genome_hash ne correspond pas au genome"
        );
        match &record.parent_id {
            None => require!(record.generation == 1, "un fondateur est de generation 1"),
            Some(pid) => {
                let parent = self.agents.get(pid).unwrap_or_else(|| env::panic_str("UNKNOWN_PARENT"));
                require!(record.generation == parent.generation + 1, "generation incoherente avec le parent");
            }
        }
        events::emit(
            "agent_registered",
            json!({"agent_id": record.agent_id, "account_id": record.account_id,
                   "parent_id": record.parent_id, "generation": record.generation,
                   "genome_hash": record.genome_hash}),
        );
        let id = record.agent_id.clone();
        self.agents.insert(
            id,
            AgentRecord {
                agent_id: record.agent_id,
                account_id: record.account_id,
                parent_id: record.parent_id,
                generation: record.generation,
                genome_hash: record.genome_hash.to_lowercase(),
                genome_json: record.genome_json,
                birth_tick: record.birth_tick,
                alive: true,
                death_tick: None,
                cause: None,
            },
        );
    }

    pub fn mark_dead(&mut self, agent_id: String, death_tick: u64, cause: Cause) {
        self.assert_operator();
        let rec = self.agents.get_mut(&agent_id).unwrap_or_else(|| env::panic_str("UNKNOWN_AGENT"));
        require!(rec.alive, "agent deja mort");
        require!(death_tick >= rec.birth_tick, "death_tick avant la naissance");
        rec.alive = false;
        rec.death_tick = Some(death_tick);
        rec.cause = Some(cause.clone());
        events::emit("agent_died", json!({"agent_id": agent_id, "death_tick": death_tick, "cause": cause}));
    }

    pub fn get_agent(&self, agent_id: String) -> Option<AgentRecord> {
        self.agents.get(&agent_id).cloned()
    }

    pub fn agents_count(&self) -> u64 {
        self.agents.len() as u64
    }

    pub fn list_agents(&self, from: Option<u64>, limit: Option<u64>) -> Vec<AgentRecord> {
        let from = from.unwrap_or(0) as usize;
        let limit = limit.unwrap_or(MAX_LIST_LIMIT).min(MAX_LIST_LIMIT) as usize;
        self.agents.iter().skip(from).take(limit).map(|(_, v)| v.clone()).collect()
    }

    // ------------------------------------------------------------------ sequestre

    /// Verrouille le depot attache. Appelable par l'operateur ou par le payeur lui-meme.
    #[payable]
    pub fn lock_escrow(&mut self, task_id: String, payer: AccountId) {
        let caller = env::predecessor_account_id();
        require!(caller == self.operator || caller == payer, "Reserve a l'operateur ou au payeur");
        require!(valid_id(&task_id), "task_id invalide");
        let deposit = env::attached_deposit();
        require!(deposit > NearToken::from_yoctonear(0), "Depot attache requis");
        require!(!self.escrows.contains_key(&task_id), "ESCROW_EXISTS");
        let amount = deposit.as_yoctonear();
        self.escrows.insert(
            task_id.clone(),
            Escrow {
                task_id: task_id.clone(),
                payer: payer.clone(),
                amount: U128(amount),
                status: EscrowStatus::Locked,
                payee: None,
                proof: None,
                refund_reason: None,
            },
        );
        events::emit("escrow_locked", json!({"task_id": task_id, "payer": payer, "amount": U128(amount)}));
    }

    /// Libere vers `payee`. Exige une preuve `accepted` (resultat hash, validateur non vides).
    pub fn release_escrow(&mut self, task_id: String, payee: AccountId, proof: ReleaseProof) -> Promise {
        self.assert_operator();
        require!(proof.verdict == "accepted", "PROOF_REQUIRED : verdict doit etre accepted");
        require!(
            !proof.result_hash.is_empty() && proof.result_hash.len() <= 128,
            "PROOF_REQUIRED : result_hash"
        );
        require!(
            !proof.validator.is_empty() && proof.validator.len() <= 128,
            "PROOF_REQUIRED : validator"
        );
        let esc = self.escrows.get_mut(&task_id).unwrap_or_else(|| env::panic_str("ESCROW_UNKNOWN"));
        require!(esc.status == EscrowStatus::Locked, "ESCROW_SETTLED");
        esc.status = EscrowStatus::Releasing;
        esc.payee = Some(payee.clone());
        esc.proof = Some(proof);
        let amount = esc.amount.0;
        Promise::new(payee)
            .transfer(NearToken::from_yoctonear(amount))
            .then(Self::ext(env::current_account_id()).on_settled(task_id))
    }

    /// Rembourse le payeur. Seulement pour `rejected` ou `expired`.
    pub fn refund_escrow(&mut self, task_id: String, reason: RefundReason) -> Promise {
        self.assert_operator();
        let esc = self.escrows.get_mut(&task_id).unwrap_or_else(|| env::panic_str("ESCROW_UNKNOWN"));
        require!(esc.status == EscrowStatus::Locked, "ESCROW_SETTLED");
        esc.status = EscrowStatus::Refunding;
        esc.refund_reason = Some(reason);
        let (payer, amount) = (esc.payer.clone(), esc.amount.0);
        Promise::new(payer)
            .transfer(NearToken::from_yoctonear(amount))
            .then(Self::ext(env::current_account_id()).on_settled(task_id))
    }

    /// Callback : confirme le transfert, ou remet le sequestre a `locked` s'il a echoue.
    #[private]
    pub fn on_settled(&mut self, task_id: String, #[callback_result] result: Result<(), PromiseError>) {
        let esc = self.escrows.get_mut(&task_id).unwrap_or_else(|| env::panic_str("ESCROW_UNKNOWN"));
        let ok = result.is_ok();
        match (esc.status, ok) {
            (EscrowStatus::Releasing, true) => {
                esc.status = EscrowStatus::Released;
                let p = esc.proof.clone();
                events::emit(
                    "escrow_released",
                    json!({"task_id": task_id, "payee": esc.payee, "amount": esc.amount,
                           "result_hash": p.as_ref().map(|x| x.result_hash.clone()),
                           "validator": p.as_ref().map(|x| x.validator.clone())}),
                );
            }
            (EscrowStatus::Refunding, true) => {
                esc.status = EscrowStatus::Refunded;
                events::emit(
                    "escrow_refunded",
                    json!({"task_id": task_id, "payer": esc.payer, "amount": esc.amount,
                           "reason": esc.refund_reason}),
                );
            }
            (EscrowStatus::Releasing, false) | (EscrowStatus::Refunding, false) => {
                esc.status = EscrowStatus::Locked;
                esc.payee = None;
                esc.proof = None;
                esc.refund_reason = None;
                events::emit("escrow_transfer_failed", json!({"task_id": task_id}));
            }
            _ => env::panic_str("etat de sequestre inattendu"),
        }
    }

    pub fn get_escrow(&self, task_id: String) -> Option<Escrow> {
        self.escrows.get(&task_id).cloned()
    }

    // ------------------------------------------------------------------ reputation

    /// Credit (delta > 0) : exige un sequestre `released` vers ce meme agent, avec `proof_hash`
    /// = result_hash de la preuve. Debit (delta < 0) : exige un sequestre `refunded` pour `rejected`.
    pub fn add_reputation(&mut self, agent_id: String, task_id: String, delta: i32, proof_hash: String) -> i64 {
        self.assert_operator();
        require!(delta != 0 && delta.abs() <= MAX_REPUTATION_DELTA, "delta hors bornes");
        require!(!proof_hash.is_empty(), "PROOF_REQUIRED : proof_hash");
        let agent = self.agents.get(&agent_id).unwrap_or_else(|| env::panic_str("UNKNOWN_AGENT"));
        let esc = self.escrows.get(&task_id).unwrap_or_else(|| env::panic_str("ESCROW_UNKNOWN"));
        if delta > 0 {
            require!(esc.status == EscrowStatus::Released, "PROOF_REQUIRED : sequestre non libere");
            require!(esc.payee.as_ref() == Some(&agent.account_id), "le beneficiaire n'est pas cet agent");
            require!(
                esc.proof.as_ref().map(|p| p.result_hash.as_str()) == Some(proof_hash.as_str()),
                "PROOF_REQUIRED : proof_hash different de la preuve de liberation"
            );
        } else {
            require!(
                esc.status == EscrowStatus::Refunded && esc.refund_reason == Some(RefundReason::Rejected),
                "malus seulement apres un sequestre rembourse pour rejet"
            );
        }
        let key = format!("{}|{}", task_id, agent_id);
        require!(self.rep_applied.insert(key), "reputation deja ecrite pour cette tache");
        let total = self.reputation.get(&agent_id).copied().unwrap_or(0) + delta as i64;
        self.reputation.insert(agent_id.clone(), total);
        events::emit(
            "reputation_updated",
            json!({"agent_id": agent_id, "task_id": task_id, "delta": delta, "total": total, "proof_hash": proof_hash}),
        );
        total
    }

    pub fn get_reputation(&self, agent_id: String) -> i64 {
        self.reputation.get(&agent_id).copied().unwrap_or(0)
    }

    pub fn get_operator(&self) -> AccountId {
        self.operator.clone()
    }
}

#[cfg(test)]
mod tests;
