use super::*;
use near_sdk::test_utils::{accounts, VMContextBuilder};
use near_sdk::testing_env;

const ONE: u128 = 1_000_000_000_000_000_000_000_000;

fn ctx(predecessor: AccountId, deposit: u128) {
    testing_env!(VMContextBuilder::new()
        .current_account_id("darwin.alice.testnet".parse().unwrap())
        .predecessor_account_id(predecessor)
        .attached_deposit(NearToken::from_yoctonear(deposit))
        .build());
}

fn op() -> AccountId { accounts(0) }
fn payer() -> AccountId { accounts(1) }
fn worker_acc() -> AccountId { accounts(2) }

fn setup() -> Darwin {
    ctx(op(), 0);
    Darwin::new(op())
}

fn new_agent(id: &str, account: AccountId, parent: Option<&str>, generation: u32) -> NewAgent {
    let genome = format!("{{\"profession\":\"writer\",\"id\":\"{id}\"}}");
    NewAgent {
        agent_id: id.into(),
        account_id: account,
        parent_id: parent.map(String::from),
        generation,
        genome_hash: sha256_hex(&genome),
        genome_json: genome,
        birth_tick: 1,
    }
}

fn proof(hash: &str) -> ReleaseProof {
    ReleaseProof { result_hash: hash.into(), verdict: "accepted".into(), validator: "rule:length".into() }
}

fn lock(c: &mut Darwin, task: &str) {
    ctx(op(), 2 * ONE);
    c.lock_escrow(task.into(), payer());
}

/// Simule la reussite du transfert (callback) apres release/refund.
fn settle_ok(c: &mut Darwin, task: &str) {
    ctx(env::current_account_id(), 0);
    c.on_settled(task.into(), Ok(()));
}

// ---------------------------------------------------------------- registre

#[test]
fn registry_lineage_and_death_keeps_record() {
    let mut c = setup();
    c.register_agent(new_agent("a-0001", worker_acc(), None, 1));
    c.register_agent(new_agent("a-0002", accounts(3), Some("a-0001"), 2));
    assert_eq!(c.agents_count(), 2);
    c.mark_dead("a-0001".into(), 5, Cause::Starvation);
    let a = c.get_agent("a-0001".into()).unwrap();
    assert!(!a.alive);
    assert_eq!(a.cause, Some(Cause::Starvation));
    assert_eq!(c.get_agent("a-0002".into()).unwrap().parent_id.as_deref(), Some("a-0001"));
    assert_eq!(c.list_agents(Some(1), Some(10)).len(), 1);
}

#[test]
#[should_panic(expected = "ALREADY_REGISTERED")]
fn registry_rejects_duplicate() {
    let mut c = setup();
    c.register_agent(new_agent("a-0001", worker_acc(), None, 1));
    c.register_agent(new_agent("a-0001", worker_acc(), None, 1));
}

#[test]
#[should_panic(expected = "UNKNOWN_PARENT")]
fn registry_rejects_unknown_parent() {
    let mut c = setup();
    c.register_agent(new_agent("a-0002", worker_acc(), Some("a-0001"), 2));
}

#[test]
#[should_panic(expected = "generation incoherente")]
fn registry_rejects_bad_generation() {
    let mut c = setup();
    c.register_agent(new_agent("a-0001", worker_acc(), None, 1));
    c.register_agent(new_agent("a-0002", worker_acc(), Some("a-0001"), 5));
}

#[test]
#[should_panic(expected = "genome_hash")]
fn registry_rejects_bad_hash() {
    let mut c = setup();
    let mut a = new_agent("a-0001", worker_acc(), None, 1);
    a.genome_hash = "00".repeat(32);
    c.register_agent(a);
}

#[test]
#[should_panic(expected = "Reserve a l'operateur")]
fn registry_operator_only() {
    let mut c = setup();
    ctx(payer(), 0);
    c.register_agent(new_agent("a-0001", worker_acc(), None, 1));
}

#[test]
#[should_panic(expected = "agent deja mort")]
fn cannot_die_twice() {
    let mut c = setup();
    c.register_agent(new_agent("a-0001", worker_acc(), None, 1));
    c.mark_dead("a-0001".into(), 5, Cause::Manual);
    c.mark_dead("a-0001".into(), 6, Cause::Manual);
}

// ---------------------------------------------------------------- sequestre

#[test]
fn escrow_lock_release_flow() {
    let mut c = setup();
    lock(&mut c, "t-0001");
    let e = c.get_escrow("t-0001".into()).unwrap();
    assert_eq!(e.status, EscrowStatus::Locked);
    assert_eq!(e.amount.0, 2 * ONE);
    ctx(op(), 0);
    let _ = c.release_escrow("t-0001".into(), worker_acc(), proof("h1"));
    assert_eq!(c.get_escrow("t-0001".into()).unwrap().status, EscrowStatus::Releasing);
    settle_ok(&mut c, "t-0001");
    assert_eq!(c.get_escrow("t-0001".into()).unwrap().status, EscrowStatus::Released);
}

#[test]
fn payer_can_lock_for_itself() {
    let mut c = setup();
    ctx(payer(), ONE);
    c.lock_escrow("t-0001".into(), payer());
    assert!(c.get_escrow("t-0001".into()).is_some());
}

#[test]
#[should_panic(expected = "Reserve a l'operateur ou au payeur")]
fn stranger_cannot_lock() {
    let mut c = setup();
    ctx(accounts(4), ONE);
    c.lock_escrow("t-0001".into(), payer());
}

#[test]
#[should_panic(expected = "Depot attache requis")]
fn lock_requires_deposit() {
    let mut c = setup();
    ctx(op(), 0);
    c.lock_escrow("t-0001".into(), payer());
}

#[test]
#[should_panic(expected = "ESCROW_EXISTS")]
fn lock_twice_refused() {
    let mut c = setup();
    lock(&mut c, "t-0001");
    lock(&mut c, "t-0001");
}

#[test]
#[should_panic(expected = "PROOF_REQUIRED")]
fn release_refuses_rejected_verdict() {
    let mut c = setup();
    lock(&mut c, "t-0001");
    ctx(op(), 0);
    let mut p = proof("h1");
    p.verdict = "rejected".into();
    let _ = c.release_escrow("t-0001".into(), worker_acc(), p);
}

#[test]
#[should_panic(expected = "PROOF_REQUIRED")]
fn release_refuses_empty_hash() {
    let mut c = setup();
    lock(&mut c, "t-0001");
    ctx(op(), 0);
    let _ = c.release_escrow("t-0001".into(), worker_acc(), proof(""));
}

#[test]
#[should_panic(expected = "Reserve a l'operateur")]
fn release_operator_only() {
    let mut c = setup();
    lock(&mut c, "t-0001");
    ctx(worker_acc(), 0);
    let _ = c.release_escrow("t-0001".into(), worker_acc(), proof("h1"));
}

#[test]
#[should_panic(expected = "ESCROW_SETTLED")]
fn no_double_release() {
    let mut c = setup();
    lock(&mut c, "t-0001");
    ctx(op(), 0);
    let _ = c.release_escrow("t-0001".into(), worker_acc(), proof("h1"));
    let _ = c.release_escrow("t-0001".into(), worker_acc(), proof("h1"));
}

#[test]
#[should_panic(expected = "ESCROW_SETTLED")]
fn no_refund_after_release() {
    let mut c = setup();
    lock(&mut c, "t-0001");
    ctx(op(), 0);
    let _ = c.release_escrow("t-0001".into(), worker_acc(), proof("h1"));
    settle_ok(&mut c, "t-0001");
    ctx(op(), 0);
    let _ = c.refund_escrow("t-0001".into(), RefundReason::Expired);
}

#[test]
fn refund_on_rejected_and_expired() {
    let mut c = setup();
    for (t, r, s) in [("t-1", RefundReason::Rejected, "rejected"), ("t-2", RefundReason::Expired, "expired")] {
        lock(&mut c, t);
        ctx(op(), 0);
        let _ = c.refund_escrow(t.into(), r);
        assert_eq!(c.get_escrow(t.into()).unwrap().status, EscrowStatus::Refunding);
        settle_ok(&mut c, t);
        let e = c.get_escrow(t.into()).unwrap();
        assert_eq!(e.status, EscrowStatus::Refunded);
        assert_eq!(serde_json_str(&e.refund_reason), format!("\"{s}\""));
    }
}

fn serde_json_str(r: &Option<RefundReason>) -> String {
    near_sdk::serde_json::to_string(r.as_ref().unwrap()).unwrap()
}

#[test]
fn failed_transfer_restores_locked() {
    let mut c = setup();
    lock(&mut c, "t-0001");
    ctx(op(), 0);
    let _ = c.release_escrow("t-0001".into(), worker_acc(), proof("h1"));
    ctx(env::current_account_id(), 0);
    c.on_settled("t-0001".into(), Err(PromiseError::Failed));
    let e = c.get_escrow("t-0001".into()).unwrap();
    assert_eq!(e.status, EscrowStatus::Locked);
    assert!(e.proof.is_none() && e.payee.is_none());
}

#[test]
fn refund_reason_rejects_other_values() {
    // Le motif est un enum serde : toute autre valeur est refusee a la deserialisation.
    assert!(near_sdk::serde_json::from_str::<RefundReason>("\"changed_my_mind\"").is_err());
    assert!(near_sdk::serde_json::from_str::<RefundReason>("\"rejected\"").is_ok());
}

// ---------------------------------------------------------------- reputation

fn released(c: &mut Darwin, task: &str, hash: &str) {
    lock(c, task);
    ctx(op(), 0);
    let _ = c.release_escrow(task.into(), worker_acc(), proof(hash));
    settle_ok(c, task);
    ctx(op(), 0);
}

#[test]
fn reputation_credit_after_confirmed_release() {
    let mut c = setup();
    c.register_agent(new_agent("a-0001", worker_acc(), None, 1));
    released(&mut c, "t-0001", "h1");
    assert_eq!(c.add_reputation("a-0001".into(), "t-0001".into(), 3, "h1".into()), 3);
    assert_eq!(c.get_reputation("a-0001".into()), 3);
}

#[test]
#[should_panic(expected = "PROOF_REQUIRED")]
fn reputation_refused_while_release_unconfirmed() {
    let mut c = setup();
    c.register_agent(new_agent("a-0001", worker_acc(), None, 1));
    lock(&mut c, "t-0001");
    ctx(op(), 0);
    let _ = c.release_escrow("t-0001".into(), worker_acc(), proof("h1"));
    let _ = c.add_reputation("a-0001".into(), "t-0001".into(), 1, "h1".into());
}

#[test]
#[should_panic(expected = "PROOF_REQUIRED")]
fn reputation_refused_without_released_escrow() {
    let mut c = setup();
    c.register_agent(new_agent("a-0001", worker_acc(), None, 1));
    lock(&mut c, "t-0001");
    ctx(op(), 0);
    let _ = c.add_reputation("a-0001".into(), "t-0001".into(), 1, "h1".into());
}

#[test]
#[should_panic(expected = "proof_hash different")]
fn reputation_refused_with_wrong_proof_hash() {
    let mut c = setup();
    c.register_agent(new_agent("a-0001", worker_acc(), None, 1));
    released(&mut c, "t-0001", "h1");
    let _ = c.add_reputation("a-0001".into(), "t-0001".into(), 1, "forged".into());
}

#[test]
#[should_panic(expected = "PROOF_REQUIRED")]
fn reputation_refused_with_empty_proof() {
    let mut c = setup();
    c.register_agent(new_agent("a-0001", worker_acc(), None, 1));
    released(&mut c, "t-0001", "h1");
    let _ = c.add_reputation("a-0001".into(), "t-0001".into(), 1, "".into());
}

#[test]
#[should_panic(expected = "beneficiaire")]
fn reputation_refused_for_other_agent() {
    let mut c = setup();
    c.register_agent(new_agent("a-0001", worker_acc(), None, 1));
    c.register_agent(new_agent("a-0002", accounts(3), None, 1));
    released(&mut c, "t-0001", "h1");
    let _ = c.add_reputation("a-0002".into(), "t-0001".into(), 1, "h1".into());
}

#[test]
#[should_panic(expected = "deja ecrite")]
fn reputation_once_per_task() {
    let mut c = setup();
    c.register_agent(new_agent("a-0001", worker_acc(), None, 1));
    released(&mut c, "t-0001", "h1");
    c.add_reputation("a-0001".into(), "t-0001".into(), 1, "h1".into());
    c.add_reputation("a-0001".into(), "t-0001".into(), 1, "h1".into());
}

#[test]
fn reputation_penalty_only_after_rejected_refund() {
    let mut c = setup();
    c.register_agent(new_agent("a-0001", worker_acc(), None, 1));
    lock(&mut c, "t-0001");
    ctx(op(), 0);
    let _ = c.refund_escrow("t-0001".into(), RefundReason::Rejected);
    settle_ok(&mut c, "t-0001");
    ctx(op(), 0);
    assert_eq!(c.add_reputation("a-0001".into(), "t-0001".into(), -2, "rejected".into()), -2);
}

#[test]
#[should_panic(expected = "malus seulement")]
fn reputation_penalty_refused_after_expiry() {
    let mut c = setup();
    c.register_agent(new_agent("a-0001", worker_acc(), None, 1));
    lock(&mut c, "t-0001");
    ctx(op(), 0);
    let _ = c.refund_escrow("t-0001".into(), RefundReason::Expired);
    settle_ok(&mut c, "t-0001");
    ctx(op(), 0);
    let _ = c.add_reputation("a-0001".into(), "t-0001".into(), -1, "x".into());
}

#[test]
#[should_panic(expected = "Reserve a l'operateur")]
fn reputation_operator_only() {
    let mut c = setup();
    c.register_agent(new_agent("a-0001", worker_acc(), None, 1));
    released(&mut c, "t-0001", "h1");
    ctx(worker_acc(), 0);
    let _ = c.add_reputation("a-0001".into(), "t-0001".into(), 1, "h1".into());
}
