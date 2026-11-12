//! Escrow: one per task (id = task_id).
use near_sdk::json_types::U128;
use near_sdk::{near, AccountId};

#[near(serializers = [json, borsh])]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EscrowStatus {
    Locked,
    /// Transfer to the payee in progress (confirmed or rolled back by callback).
    Releasing,
    Released,
    /// Transfer to the payer in progress.
    Refunding,
    Refunded,
}

/// Allowed refund reasons: nothing else can return the money.
#[near(serializers = [json, borsh])]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RefundReason {
    Rejected,
    Expired,
}

/// Validation proof required to release an escrow.
#[near(serializers = [json, borsh])]
#[derive(Clone, Debug)]
pub struct ReleaseProof {
    pub result_hash: String,
    /// Must be exactly "accepted".
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
