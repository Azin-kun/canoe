use near_sdk::json_types::U128;
use near_sdk::serde_json::json;
use near_sdk::store::{IterableMap, LookupSet, Vector};
use near_sdk::{env, near, require, AccountId, NearToken, Promise};

#[near(serializers = [borsh, json])]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Category {
    Flight,
    Hotel,
    Car,
}

impl Category {
    pub fn as_str(&self) -> &'static str {
        match self {
            Category::Flight => "flight",
            Category::Hotel => "hotel",
            Category::Car => "car",
        }
    }
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct Amounts {
    pub flight: U128,
    pub hotel: U128,
    pub car: U128,
}

impl Amounts {
    pub fn get(&self, category: Category) -> u128 {
        match category {
            Category::Flight => self.flight.0,
            Category::Hotel => self.hotel.0,
            Category::Car => self.car.0,
        }
    }

    pub fn set(&mut self, category: Category, value: u128) {
        match category {
            Category::Flight => self.flight = U128(value),
            Category::Hotel => self.hotel = U128(value),
            Category::Car => self.car = U128(value),
        }
    }

    pub fn total(&self) -> u128 {
        self.flight
            .0
            .checked_add(self.hotel.0)
            .and_then(|sum| sum.checked_add(self.car.0))
            .unwrap_or_else(|| env::panic_str("Amount overflow"))
    }
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Trip {
    pub id: u64,
    pub owner: AccountId,
    pub limits: Amounts,
    pub spent: Amounts,
    pub expires_at_ms: u64,
    pub open: bool,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Payment {
    pub trip_id: u64,
    pub category: Category,
    pub amount: U128,
    pub merchant: AccountId,
    pub quote_hash: String,
    pub quote_ref: String,
    pub paid_at_ms: u64,
}

#[near(contract_state)]
pub struct Contract {
    trips: IterableMap<u64, Trip>,
    payments: Vector<Payment>,
    paid_hashes: LookupSet<String>,
    next_trip_id: u64,
}

impl Default for Contract {
    fn default() -> Self {
        Self {
            trips: IterableMap::new(b"t"),
            payments: Vector::new(b"p"),
            paid_hashes: LookupSet::new(b"h"),
            next_trip_id: 0,
        }
    }
}

#[near]
impl Contract {
    #[payable]
    pub fn create_trip(&mut self, limits: Amounts, expires_at_ms: u64) -> u64 {
        let total = limits.total();
        require!(total > 0, "Budget must be greater than zero");
        require!(
            env::attached_deposit().as_yoctonear() == total,
            "Attached deposit must equal the sum of limits"
        );
        require!(expires_at_ms > env::block_timestamp_ms(), "Expiry must be in the future");

        let id = self.next_trip_id;
        self.next_trip_id += 1;
        let owner = env::predecessor_account_id();
        self.trips.insert(
            id,
            Trip { id, owner: owner.clone(), limits, spent: Amounts::default(), expires_at_ms, open: true },
        );
        emit("trip_created", json!({ "trip_id": id, "owner": owner, "total": U128(total) }));
        id
    }

    #[allow(clippy::too_many_arguments)]
    pub fn pay_quote(
        &mut self,
        trip_id: u64,
        category: Category,
        amount: U128,
        merchant: AccountId,
        quote_hash: String,
        quote_ref: String,
        quote_expires_at_ms: u64,
    ) -> Promise {
        let now = env::block_timestamp_ms();
        require!(
            quote_hash.len() == 64 && quote_hash.chars().all(|c| c.is_ascii_hexdigit()),
            "quote_hash must be 64 hex characters"
        );
        require!(amount.0 > 0, "Amount must be greater than zero");

        let trip = self.trips.get_mut(&trip_id).unwrap_or_else(|| env::panic_str("Trip not found"));
        require!(trip.owner == env::predecessor_account_id(), "Only the trip owner can do this");
        require!(trip.open, "Trip is closed");
        require!(trip.expires_at_ms > now, "Trip expired");
        require!(quote_expires_at_ms > now, "Quote expired");
        require!(!self.paid_hashes.contains(&quote_hash), "Quote already paid");

        let new_spent = trip
            .spent
            .get(category)
            .checked_add(amount.0)
            .unwrap_or_else(|| env::panic_str("Amount overflow"));
        require!(
            new_spent <= trip.limits.get(category),
            format!("Over category limit: {}", category.as_str())
        );
        trip.spent.set(category, new_spent);

        self.paid_hashes.insert(quote_hash.clone());
        self.payments.push(Payment {
            trip_id,
            category,
            amount,
            merchant: merchant.clone(),
            quote_hash: quote_hash.clone(),
            quote_ref: quote_ref.clone(),
            paid_at_ms: now,
        });
        emit(
            "payment",
            json!({
                "trip_id": trip_id, "category": category.as_str(), "amount": amount,
                "merchant": merchant, "quote_hash": quote_hash, "quote_ref": quote_ref
            }),
        );
        Promise::new(merchant).transfer(NearToken::from_yoctonear(amount.0))
    }

    pub fn withdraw_remaining(&mut self, trip_id: u64) -> Promise {
        let trip = self.trips.get_mut(&trip_id).unwrap_or_else(|| env::panic_str("Trip not found"));
        require!(trip.owner == env::predecessor_account_id(), "Only the trip owner can do this");
        require!(trip.open, "Trip is closed");
        let remaining = trip.limits.total() - trip.spent.total();
        trip.open = false;
        let owner = trip.owner.clone();
        emit("trip_closed", json!({ "trip_id": trip_id, "refunded": U128(remaining) }));
        Promise::new(owner).transfer(NearToken::from_yoctonear(remaining))
    }

    pub fn get_trip(&self, trip_id: u64) -> Option<Trip> {
        self.trips.get(&trip_id).cloned()
    }

    pub fn get_trips_by_owner(&self, owner: AccountId) -> Vec<Trip> {
        self.trips.values().filter(|trip| trip.owner == owner).cloned().collect()
    }

    pub fn get_payments(&self, trip_id: u64) -> Vec<Payment> {
        self.payments.iter().filter(|payment| payment.trip_id == trip_id).cloned().collect()
    }
}

/// NEP-297 event log: `EVENT_JSON:{"standard":"canoe","version":"1.0.0","event":...,"data":[...]}`
fn emit(event: &str, data: near_sdk::serde_json::Value) {
    env::log_str(&format!(
        "EVENT_JSON:{}",
        json!({ "standard": "canoe", "version": "1.0.0", "event": event, "data": [data] })
    ));
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::VMContextBuilder;
    use near_sdk::testing_env;

    const NOW_MS: u64 = 1_700_000_000_000;
    const DAY_MS: u64 = 86_400_000;
    const ONE_NEAR: u128 = 1_000_000_000_000_000_000_000_000;

    fn owner() -> AccountId {
        "alice.testnet".parse().unwrap()
    }
    fn stranger() -> AccountId {
        "bob.testnet".parse().unwrap()
    }
    fn merchant() -> AccountId {
        "merchant.testnet".parse().unwrap()
    }
    fn hash(c: char) -> String {
        std::iter::repeat(c).take(64).collect()
    }
    fn limits(flight: u128, hotel: u128, car: u128) -> Amounts {
        Amounts { flight: U128(flight), hotel: U128(hotel), car: U128(car) }
    }
    fn ctx(predecessor: AccountId, deposit: u128, now_ms: u64) {
        let mut builder = VMContextBuilder::new();
        builder
            .predecessor_account_id(predecessor.clone())
            .signer_account_id(predecessor)
            .attached_deposit(NearToken::from_yoctonear(deposit))
            .block_timestamp(now_ms * 1_000_000);
        testing_env!(builder.build());
    }
    /// Trip 0: flight 1.5 NEAR, hotel 1 NEAR, car 0.5 NEAR, valid for one day.
    fn new_trip(contract: &mut Contract) -> u64 {
        ctx(owner(), 3 * ONE_NEAR, NOW_MS);
        contract.create_trip(limits(ONE_NEAR + ONE_NEAR / 2, ONE_NEAR, ONE_NEAR / 2), NOW_MS + DAY_MS)
    }
    fn pay(contract: &mut Contract, trip_id: u64, category: Category, amount: u128, h: char) {
        let _ = contract.pay_quote(
            trip_id,
            category,
            U128(amount),
            merchant(),
            hash(h),
            "flight:query-1".to_string(),
            NOW_MS + 600_000,
        );
    }

    #[test]
    fn create_trip_stores_limits() {
        let mut c = Contract::default();
        let id = new_trip(&mut c);
        assert_eq!(id, 0);
        let trip = c.get_trip(0).unwrap();
        assert_eq!(trip.owner, owner());
        assert_eq!(trip.limits.total(), 3 * ONE_NEAR);
        assert_eq!(trip.spent.total(), 0);
        assert!(trip.open);
    }

    #[test]
    #[should_panic(expected = "Attached deposit must equal the sum of limits")]
    fn create_trip_rejects_wrong_deposit() {
        let mut c = Contract::default();
        ctx(owner(), ONE_NEAR, NOW_MS);
        c.create_trip(limits(ONE_NEAR, ONE_NEAR, 0), NOW_MS + DAY_MS);
    }

    #[test]
    #[should_panic(expected = "Budget must be greater than zero")]
    fn create_trip_rejects_zero_budget() {
        let mut c = Contract::default();
        ctx(owner(), 0, NOW_MS);
        c.create_trip(limits(0, 0, 0), NOW_MS + DAY_MS);
    }

    #[test]
    #[should_panic(expected = "Expiry must be in the future")]
    fn create_trip_rejects_past_expiry() {
        let mut c = Contract::default();
        ctx(owner(), ONE_NEAR, NOW_MS);
        c.create_trip(limits(ONE_NEAR, 0, 0), NOW_MS - 1);
    }

    #[test]
    fn pay_within_limit_records_payment() {
        let mut c = Contract::default();
        let id = new_trip(&mut c);
        ctx(owner(), 0, NOW_MS);
        pay(&mut c, id, Category::Flight, ONE_NEAR, 'a');
        let trip = c.get_trip(id).unwrap();
        assert_eq!(trip.spent.get(Category::Flight), ONE_NEAR);
        let payments = c.get_payments(id);
        assert_eq!(payments.len(), 1);
        assert_eq!(payments[0].merchant, merchant());
        assert_eq!(payments[0].category, Category::Flight);
        assert_eq!(payments[0].quote_hash, hash('a'));
    }

    #[test]
    #[should_panic(expected = "Over category limit: flight")]
    fn pay_over_limit_is_rejected() {
        let mut c = Contract::default();
        let id = new_trip(&mut c);
        ctx(owner(), 0, NOW_MS);
        pay(&mut c, id, Category::Flight, ONE_NEAR, 'a');
        pay(&mut c, id, Category::Flight, ONE_NEAR, 'b');
    }

    #[test]
    #[should_panic(expected = "Only the trip owner can do this")]
    fn pay_by_stranger_is_rejected() {
        let mut c = Contract::default();
        let id = new_trip(&mut c);
        ctx(stranger(), 0, NOW_MS);
        pay(&mut c, id, Category::Hotel, ONE_NEAR / 10, 'a');
    }

    #[test]
    #[should_panic(expected = "Quote already paid")]
    fn pay_same_quote_twice_is_rejected() {
        let mut c = Contract::default();
        let id = new_trip(&mut c);
        ctx(owner(), 0, NOW_MS);
        pay(&mut c, id, Category::Hotel, ONE_NEAR / 10, 'a');
        pay(&mut c, id, Category::Hotel, ONE_NEAR / 10, 'a');
    }

    #[test]
    #[should_panic(expected = "Quote expired")]
    fn pay_expired_quote_is_rejected() {
        let mut c = Contract::default();
        let id = new_trip(&mut c);
        ctx(owner(), 0, NOW_MS);
        let _ = c.pay_quote(id, Category::Car, U128(1), merchant(), hash('a'), "car:1".into(), NOW_MS - 1);
    }

    #[test]
    #[should_panic(expected = "Trip expired")]
    fn pay_after_trip_expiry_is_rejected() {
        let mut c = Contract::default();
        let id = new_trip(&mut c);
        ctx(owner(), 0, NOW_MS + 2 * DAY_MS);
        let _ = c.pay_quote(id, Category::Car, U128(1), merchant(), hash('a'), "car:1".into(), NOW_MS + 3 * DAY_MS);
    }

    #[test]
    #[should_panic(expected = "quote_hash must be 64 hex characters")]
    fn pay_with_bad_hash_is_rejected() {
        let mut c = Contract::default();
        let id = new_trip(&mut c);
        ctx(owner(), 0, NOW_MS);
        let _ = c.pay_quote(id, Category::Car, U128(1), merchant(), "xyz".into(), "car:1".into(), NOW_MS + 1000);
    }

    #[test]
    #[should_panic(expected = "Trip not found")]
    fn pay_unknown_trip_is_rejected() {
        let mut c = Contract::default();
        ctx(owner(), 0, NOW_MS);
        pay(&mut c, 42, Category::Flight, 1, 'a');
    }

    #[test]
    fn withdraw_closes_trip() {
        let mut c = Contract::default();
        let id = new_trip(&mut c);
        ctx(owner(), 0, NOW_MS);
        pay(&mut c, id, Category::Hotel, ONE_NEAR / 2, 'a');
        let _ = c.withdraw_remaining(id);
        assert!(!c.get_trip(id).unwrap().open);
    }

    #[test]
    #[should_panic(expected = "Trip is closed")]
    fn pay_after_withdraw_is_rejected() {
        let mut c = Contract::default();
        let id = new_trip(&mut c);
        ctx(owner(), 0, NOW_MS);
        let _ = c.withdraw_remaining(id);
        pay(&mut c, id, Category::Hotel, 1, 'a');
    }

    #[test]
    #[should_panic(expected = "Only the trip owner can do this")]
    fn withdraw_by_stranger_is_rejected() {
        let mut c = Contract::default();
        let id = new_trip(&mut c);
        ctx(stranger(), 0, NOW_MS);
        let _ = c.withdraw_remaining(id);
    }

    #[test]
    fn trips_are_listed_by_owner() {
        let mut c = Contract::default();
        new_trip(&mut c);
        ctx(stranger(), ONE_NEAR, NOW_MS);
        c.create_trip(limits(ONE_NEAR, 0, 0), NOW_MS + DAY_MS);
        assert_eq!(c.get_trips_by_owner(owner()).len(), 1);
        assert_eq!(c.get_trips_by_owner(stranger()).len(), 1);
        assert_eq!(c.get_trips_by_owner(merchant()).len(), 0);
    }
}
