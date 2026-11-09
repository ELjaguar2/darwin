//! Sequestre : un par tache (id = task_id).
use near_sdk::json_types::U128;
use near_sdk::{near, AccountId};

#[near(serializers = [json, borsh])]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EscrowStatus {
    Locked,
    /// Transfert vers le beneficiaire en cours (confirme ou annule par callback).
    Releasing,
    Released,
    /// Transfert vers le payeur en cours.
    Refunding,
    Refunded,
}

/// Motifs de remboursement autorises : rien d'autre ne peut rendre l'argent.
#[near(serializers = [json, borsh])]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RefundReason {
    Rejected,
    Expired,
}

/// Preuve de validation exigee pour liberer un sequestre.
#[near(serializers = [json, borsh])]
#[derive(Clone, Debug)]
pub struct ReleaseProof {
    pub result_hash: String,
    /// Doit valoir exactement "accepted".
    pub verdict: String,
    pub validator: String,
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug)]
pub struct Escrow {
    pub task_id: String,
    pub payer: AccountId,
    pub amount: U128,
    pub status: EscrowStatus,
    pub payee: Option<AccountId>,
    pub proof: Option<ReleaseProof>,
    pub refund_reason: Option<RefundReason>,
}
