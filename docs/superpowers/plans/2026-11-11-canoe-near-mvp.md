# CANOE NEAR MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an on-chain Trip Budget to the flight-finder fork. The owner locks NEAR per category (flight, hotel, car) and approves each payment for a tracked offer from their own wallet. The contract enforces the limits and transfers NEAR to a merchant account on testnet.

**Architecture:** A Rust contract `contracts/canoe-budget` (near-sdk 5.29) holds trip budgets and pays merchants. It is built and tested inside the `sourcescan/cargo-near` Docker image, so no Rust toolchain is installed on Windows. The Next.js app (`apps/web`) gains:
- `lib/canoe/*`: pure, unit-tested helpers for quotes, offers, rates and contract args.
- Two API routes: `/api/canoe/offers` and `/api/canoe/rate`.
- A `/trip` page whose wallet layer is `@hot-labs/near-connect` + `near-api-js`, following the official NEAR hello-near template.

**Tech Stack:** Rust + near-sdk 5.29.0, Docker image `sourcescan/cargo-near:0.22.0-rust-1.97.1`, near-cli-rs, Next.js 16 / React 19 / TypeScript strict, Prisma 7, Vitest, next-intl, `near-api-js@7.3.1`, `@hot-labs/near-connect@0.11.4`.

**Spec:** `docs/superpowers/specs/2026-11-11-canoe-near-design.md`

## Global Constraints

- Submission deadline: **2026-11-14T23:59:00Z**. The repository must be public by then.
- Network: NEAR **testnet** only. Contract account `budget.canoe-dev.testnet`, demo merchant `canoe-dev.testnet`.
- Never commit keys or secrets. Keys live in the near-cli legacy keychain (`~/.near-credentials`) or in shell environment variables. `wallet testing.docx` stays outside the repo.
- Steps marked **[USER CONFIRM]** sign transactions, deploy, push or publish. Do not run them until the user says yes in chat.
- Repo rules (CLAUDE.md): CSS Modules only (no inline styles, no Tailwind), TypeScript strict, no `any`, no committed `.env` files, API routes return `apiSuccess()` / `apiError()`.
- Every new UI string goes in `messages/<locale>/canoe.json` for **all five** locales (`en, de, es, fr, pt`). The key sets must be identical, because `src/i18n/messages-parity.test.ts` enforces parity.
- Contract enum JSON uses the variant names exactly: `"Flight" | "Hotel" | "Car"`.
- Demo scale: quotes are multiplied by `NEXT_PUBLIC_CANOE_DEMO_SCALE_BPS` (default `100` = 1%) so real prices fit testnet balances. The UI shows this scale, and it is part of the quote hash.
- Booking with airlines, hotels or rental companies is **simulated**. The NEAR transfer is **real** on testnet. Both statements appear in the UI and the README.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Work on branch `canoe-near`. The baseline tag `pre-hackathon` already exists at `266d798`.

## File Map

| File | Responsibility |
|---|---|
| `contracts/canoe-budget/Cargo.toml`, `rust-toolchain.toml`, `.gitignore` | Contract crate config |
| `contracts/canoe-budget/src/lib.rs` | Contract state, methods and unit tests |
| `contracts/canoe-budget/scripts/{test,build}.sh` | Run `cargo test` / `cargo near build` in Docker |
| `apps/web/src/lib/canoe/types.ts` | Shared types: `Category`, `Offer`, `Rate`, `Quote` |
| `apps/web/src/lib/canoe/config.ts` | Network, contract, merchant, RPC, explorer and demo-scale config |
| `apps/web/src/lib/canoe/quote.ts` (+ test) | Fiat→yocto conversion, NEAR formatting, canonical JSON, sha256, `buildQuote` |
| `apps/web/src/lib/canoe/contract.ts` (+ test) | Contract view types and argument builders |
| `apps/web/src/lib/canoe/offers.ts` (+ test) | Normalize Prisma rows to `Offer`; sample offers |
| `apps/web/src/lib/canoe/rate.ts` (+ test) | CoinGecko NEAR price with a 60 s cache and a labelled fallback |
| `apps/web/src/app/api/canoe/offers/route.ts` | `GET` offers for the current actor |
| `apps/web/src/app/api/canoe/rate/route.ts` | `GET ?currency=XXX` rate |
| `apps/web/src/components/canoe/NearProvider.tsx` | Wallet context (connect, view, call → tx hash) |
| `apps/web/src/components/canoe/TripBudget.tsx` | Page orchestrator: wallet bar, trip summary, data loading |
| `apps/web/src/components/canoe/TripCreateForm.tsx` | Create-budget form |
| `apps/web/src/components/canoe/OfferList.tsx` | Offers with quotes and "Approve & pay" |
| `apps/web/src/components/canoe/PaymentHistory.tsx` | Payments with explorer links |
| `apps/web/src/components/canoe/TripBudget.module.css` | Styles |
| `apps/web/src/app/trip/page.tsx` | `/trip` route |
| `apps/web/src/components/hotels/TravelNav.tsx` | Add the "Trip Budget" link |
| `apps/web/messages/{en,de,es,fr,pt}/canoe.json` | UI strings |
| `apps/web/src/i18n/request.ts`, `apps/web/src/test/setup-intl.ts` | Register the `canoe` message area |
| `README.md`, `LICENSE` | CANOE judge section, disclosure, copyright line |

---

### Task 1: Boot the upstream app locally (baseline check)

**Files:** none (verification only)

**Interfaces:**
- Consumes: nothing
- Produces: a running instance at `http://localhost:3003`, with setup finished (admin password plus an AI provider and key chosen in the browser). Later tasks rely on `SELF_HOSTED=true` and a signed-in owner.

- [ ] **Step 1: Create the local `.env` for Docker Compose.** It is gitignored. Values are generated, never typed into chat.

```bash
cd "/c/azin/Claude Workspace/Canoe/canoe"
cp .env.example .env
sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$(openssl rand -hex 16)/" .env
sed -i "s/^ADMIN_SESSION_SECRET=.*/ADMIN_SESSION_SECRET=$(openssl rand -hex 32)/" .env
sed -i "s/^CRON_SECRET=.*/CRON_SECRET=$(openssl rand -hex 32)/" .env
git status --short .env   # Expected: no output (ignored)
```

- [ ] **Step 2: Build and start the stack**

Run: `docker compose up -d --build` (first build takes 5–15 min)
Then: `curl -s http://localhost:3003/api/health`
Expected: JSON containing `"ok":true`

- [ ] **Step 3: Finish setup in the browser.** Open `http://localhost:3003`. Complete the setup wizard: create the admin profile and password, then pick an AI provider and model and paste the API key. The user enters the key; never paste it into chat. Open `/hotels` and confirm the page loads.

- [ ] **Step 4: Prepare a dev loop for `apps/web`.** Run DB and Redis from compose and the web app with hot reload.

```bash
docker compose stop web
export $(grep -v '^#' .env | xargs)
export DATABASE_URL="postgresql://postgres:${POSTGRES_PASSWORD}@localhost:5433/flight_finder"
export REDIS_URL="redis://localhost:6380" SELF_HOSTED=true
npm install
npm run db:generate
npm run dev   # http://localhost:3003
```

Expected: the same admin session works at `http://localhost:3003/hotels`. No commit (nothing changed).

---

### Task 2: Contract `canoe-budget` with unit tests

**Files:**
- Create: `contracts/canoe-budget/Cargo.toml`
- Create: `contracts/canoe-budget/rust-toolchain.toml`
- Create: `contracts/canoe-budget/.gitignore`
- Create: `contracts/canoe-budget/scripts/test.sh`
- Create: `contracts/canoe-budget/scripts/build.sh`
- Create: `contracts/canoe-budget/src/lib.rs`

**Interfaces:**
- Produces (JSON ABI used by the web tasks):
  - `create_trip({ limits: { flight: string, hotel: string, car: string }, expires_at_ms: number }) -> number`. Payable. The deposit must equal the sum of the limits (yocto strings).
  - `pay_quote({ trip_id: number, category: "Flight"|"Hotel"|"Car", amount: string, merchant: string, quote_hash: string /*64 hex*/, quote_ref: string, quote_expires_at_ms: number })`. Transfers `amount` to `merchant`.
  - `withdraw_remaining({ trip_id: number })`
  - `get_trip({ trip_id }) -> Trip | null`
  - `get_trips_by_owner({ owner }) -> Trip[]`
  - `get_payments({ trip_id }) -> Payment[]`
  - `Trip = { id, owner, limits: Amounts, spent: Amounts, expires_at_ms, open }`
  - `Payment = { trip_id, category, amount, merchant, quote_hash, quote_ref, paid_at_ms }`
  - Panic messages (exact): `"Budget must be greater than zero"`, `"Attached deposit must equal the sum of limits"`, `"Expiry must be in the future"`, `"Trip not found"`, `"Only the trip owner can do this"`, `"Trip is closed"`, `"Trip expired"`, `"Quote expired"`, `"Quote already paid"`, `"quote_hash must be 64 hex characters"`, `"Amount must be greater than zero"`, `"Over category limit: flight|hotel|car"`.

- [ ] **Step 1: Crate config files**

`contracts/canoe-budget/Cargo.toml`:

```toml
[package]
name = "canoe-budget"
description = "CANOE trip budget: per-category NEAR limits with owner-approved merchant payments"
version = "0.1.0"
edition = "2021"
license = "MIT"

[lib]
crate-type = ["cdylib", "rlib"]

[dependencies]
near-sdk = "5.29.0"

[dev-dependencies]
near-sdk = { version = "5.29.0", features = ["unit-testing"] }

[profile.release]
codegen-units = 1
opt-level = "z"
lto = true
debug = false
panic = "abort"
overflow-checks = true
```

`contracts/canoe-budget/rust-toolchain.toml`:

```toml
[toolchain]
channel = "1.97.1"
targets = ["wasm32-unknown-unknown"]
```

`contracts/canoe-budget/.gitignore`:

```text
/target
```

`contracts/canoe-budget/scripts/test.sh`:

```bash
#!/usr/bin/env bash
# Runs the contract unit tests inside the cargo-near image (no local Rust needed).
set -euo pipefail
cd "$(dirname "$0")/.."
HOST_DIR="$(pwd -W 2>/dev/null || pwd)"
MSYS_NO_PATHCONV=1 docker run --rm -v "${HOST_DIR}:/host" -w /host \
  sourcescan/cargo-near:0.22.0-rust-1.97.1 cargo test -- --nocapture
```

`contracts/canoe-budget/scripts/build.sh`:

```bash
#!/usr/bin/env bash
# Builds target/near/canoe_budget.wasm inside the cargo-near image.
set -euo pipefail
cd "$(dirname "$0")/.."
HOST_DIR="$(pwd -W 2>/dev/null || pwd)"
MSYS_NO_PATHCONV=1 docker run --rm -v "${HOST_DIR}:/host" -w /host \
  sourcescan/cargo-near:0.22.0-rust-1.97.1 cargo near build non-reproducible-wasm
ls -la target/near/canoe_budget.wasm
```

Run: `chmod +x contracts/canoe-budget/scripts/*.sh`

- [ ] **Step 2: Write `src/lib.rs` with the tests first and stub methods.** Every method body is `unimplemented!()`, so the tests compile and then fail.

`contracts/canoe-budget/src/lib.rs`:

```rust
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
        unimplemented!()
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
        unimplemented!()
    }

    pub fn withdraw_remaining(&mut self, trip_id: u64) -> Promise {
        unimplemented!()
    }

    pub fn get_trip(&self, trip_id: u64) -> Option<Trip> {
        unimplemented!()
    }

    pub fn get_trips_by_owner(&self, owner: AccountId) -> Vec<Trip> {
        unimplemented!()
    }

    pub fn get_payments(&self, trip_id: u64) -> Vec<Payment> {
        unimplemented!()
    }
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
```

- [ ] **Step 3: Run the tests and confirm they fail**

Run: `bash contracts/canoe-budget/scripts/test.sh`
Expected: compiles, then many tests FAIL with `not implemented`. The first run downloads crates, which takes a few minutes.

- [ ] **Step 4: Implement the methods.** Replace the six `unimplemented!()` bodies inside `#[near] impl Contract`, and add the private helpers below that block (outside `#[near]`).

```rust
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
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `bash contracts/canoe-budget/scripts/test.sh`
Expected: `test result: ok. 16 passed; 0 failed`

- [ ] **Step 6: Build the wasm**

Run: `bash contracts/canoe-budget/scripts/build.sh`
Expected: `target/near/canoe_budget.wasm` exists, roughly 100–250 KB.

- [ ] **Step 7: Commit**

```bash
git add contracts/canoe-budget
git commit -m "feat(contract): add canoe-budget trip budget contract with unit tests

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Deploy the contract to testnet **[USER CONFIRM]**

**Files:** none

**Interfaces:**
- Consumes: `contracts/canoe-budget/target/near/canoe_budget.wasm` (Task 2)
- Produces: a live contract at `budget.canoe-dev.testnet` with the methods from Task 2

- [ ] **Step 1: Install near-cli-rs.** Run: `npm install -g near-cli-rs`, then `near --version`. Expected: a version is printed.

- [ ] **Step 2: Import keys (the user does this, interactively).** Run `near account import-account`, then choose `using-private-key`. Paste the key as `ed25519:<private key from wallet testing.docx>`, choose `testnet`, and save to the **legacy keychain**. Do this for `canoe-dev.testnet` and `canoe-user1.testnet`. The key goes into the terminal only, never into chat or a file inside the repo.

- [ ] **Step 3: Create the contract sub-account [USER CONFIRM]**

```bash
near account create-account fund-myself budget.canoe-dev.testnet '3 NEAR' autogenerate-new-keypair save-to-legacy-keychain sign-as canoe-dev.testnet network-config testnet sign-with-legacy-keychain send
```

Expected: `New account <budget.canoe-dev.testnet> created successfully.` If a flag is rejected, run `near` and follow the interactive menu with the same choices.

- [ ] **Step 4: Deploy [USER CONFIRM]**

```bash
near contract deploy budget.canoe-dev.testnet use-file contracts/canoe-budget/target/near/canoe_budget.wasm without-init-call network-config testnet sign-with-legacy-keychain send
```

Expected: `Contract code has been successfully deployed.`

- [ ] **Step 5: Smoke test from the CLI [USER CONFIRM]**

```bash
NOW_MS=$(($(date +%s)*1000)); EXP=$((NOW_MS+86400000))
near contract call-function as-transaction budget.canoe-dev.testnet create_trip json-args "{\"limits\":{\"flight\":\"100000000000000000000000\",\"hotel\":\"100000000000000000000000\",\"car\":\"0\"},\"expires_at_ms\":$EXP}" prepaid-gas '30.0 Tgas' attached-deposit '0.2 NEAR' sign-as canoe-user1.testnet network-config testnet sign-with-legacy-keychain send
near contract call-function as-read-only budget.canoe-dev.testnet get_trips_by_owner json-args '{"owner":"canoe-user1.testnet"}' network-config testnet now
```

Expected: the first call returns `0` and logs `EVENT_JSON:{"standard":"canoe",...,"event":"trip_created"...}`. The view returns one trip with `"open": true`. Write the tx hash into `docs/canoe/testnet-log.md` (create it with the header `# CANOE testnet log`).

- [ ] **Step 6: Commit the log**

```bash
git add docs/canoe/testnet-log.md
git commit -m "docs: record canoe-budget testnet deployment

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Shared types, config and quote helpers

**Files:**
- Create: `apps/web/src/lib/canoe/types.ts`
- Create: `apps/web/src/lib/canoe/config.ts`
- Create: `apps/web/src/lib/canoe/quote.ts`
- Test: `apps/web/src/lib/canoe/quote.test.ts`

**Interfaces:**
- Produces:
  - `type Category = 'flight' | 'hotel' | 'car'`
  - `interface Offer { id: string; category: Category; label: string; price: number; currency: string; observedAt: string; sourceUrl: string | null; sample: boolean }`
  - `interface Rate { currency: string; nearPrice: number; fetchedAt: string; source: 'coingecko' | 'fallback' }`
  - `interface Quote { offerId: string; category: Category; quoteRef: string; fiatAmount: number; currency: string; nearPrice: number; rateSource: Rate['source']; scaleBps: number; amountYocto: string; createdAtMs: number; expiresAtMs: number; quoteHash: string }`
  - `fiatToYocto(amount: number, nearPrice: number): bigint`
  - `applyScale(yocto: bigint, scaleBps: number): bigint`
  - `nearToYocto(near: string): bigint`
  - `formatNear(yocto: bigint | string, digits?: number): string`
  - `canonicalJson(value: unknown): string`
  - `sha256Hex(text: string): Promise<string>`
  - `buildQuote(offer: Offer, rate: Rate, nowMs: number, scaleBps?: number): Promise<Quote>`
  - config: `CANOE_NETWORK`, `CANOE_CONTRACT`, `CANOE_MERCHANT`, `CANOE_RPC_URLS`, `CANOE_DEMO_SCALE_BPS`, `QUOTE_TTL_MS`, `explorerTxUrl(hash)`, `explorerAccountUrl(account)`

- [ ] **Step 1: Write the types and config**

`apps/web/src/lib/canoe/types.ts`:

```ts
export type Category = 'flight' | 'hotel' | 'car';

export const CATEGORIES: readonly Category[] = ['flight', 'hotel', 'car'];

export interface Offer {
  id: string;
  category: Category;
  label: string;
  price: number;
  currency: string;
  observedAt: string;
  sourceUrl: string | null;
  sample: boolean;
}

export interface Rate {
  currency: string;
  /** Fiat units for one NEAR, e.g. 2.5 USD or 40000 IDR. */
  nearPrice: number;
  fetchedAt: string;
  source: 'coingecko' | 'fallback';
}

export interface Quote {
  offerId: string;
  category: Category;
  quoteRef: string;
  fiatAmount: number;
  currency: string;
  nearPrice: number;
  rateSource: Rate['source'];
  scaleBps: number;
  amountYocto: string;
  createdAtMs: number;
  expiresAtMs: number;
  quoteHash: string;
}
```

`apps/web/src/lib/canoe/config.ts`:

```ts
export type NearNetwork = 'mainnet' | 'testnet';

export const CANOE_NETWORK: NearNetwork =
  process.env.NEXT_PUBLIC_NEAR_NETWORK === 'mainnet' ? 'mainnet' : 'testnet';
export const CANOE_CONTRACT = process.env.NEXT_PUBLIC_CANOE_CONTRACT || 'budget.canoe-dev.testnet';
export const CANOE_MERCHANT = process.env.NEXT_PUBLIC_CANOE_MERCHANT || 'canoe-dev.testnet';
export const CANOE_RPC_URLS: Record<NearNetwork, string[]> = {
  mainnet: ['https://free.rpc.fastnear.com'],
  testnet: ['https://test.rpc.fastnear.com'],
};

/** Basis points applied to every quote so real prices fit testnet balances (100 = 1%). */
const parsedScale = Number.parseInt(process.env.NEXT_PUBLIC_CANOE_DEMO_SCALE_BPS ?? '100', 10);
export const CANOE_DEMO_SCALE_BPS = Number.isInteger(parsedScale) && parsedScale > 0 && parsedScale <= 10_000 ? parsedScale : 100;

export const QUOTE_TTL_MS = 10 * 60 * 1000;

const EXPLORER = CANOE_NETWORK === 'mainnet' ? 'https://nearblocks.io' : 'https://testnet.nearblocks.io';
export const explorerTxUrl = (hash: string) => `${EXPLORER}/txns/${hash}`;
export const explorerAccountUrl = (account: string) => `${EXPLORER}/address/${account}`;
```

- [ ] **Step 2: Write the failing tests**

`apps/web/src/lib/canoe/quote.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { applyScale, buildQuote, canonicalJson, fiatToYocto, formatNear, nearToYocto, sha256Hex } from './quote';
import type { Offer, Rate } from './types';

const NEAR = 10n ** 24n;
const offer: Offer = {
  id: 'q1', category: 'flight', label: 'CGK → DPS', price: 1_500_000, currency: 'IDR',
  observedAt: '2026-11-11T03:00:00.000Z', sourceUrl: null, sample: false,
};
const rate: Rate = { currency: 'IDR', nearPrice: 40_000, fetchedAt: '2026-11-11T03:00:00.000Z', source: 'coingecko' };

describe('fiatToYocto', () => {
  it('converts IDR at 40,000 per NEAR', () => {
    expect(fiatToYocto(1_500_000, 40_000)).toBe(375n * NEAR / 10n);
  });
  it('converts USD at 2.5 per NEAR', () => {
    expect(fiatToYocto(10, 2.5)).toBe(4n * NEAR);
  });
  it('rejects non-positive input', () => {
    expect(() => fiatToYocto(0, 2.5)).toThrow(/positive/);
    expect(() => fiatToYocto(10, 0)).toThrow(/positive/);
  });
});

describe('applyScale', () => {
  it('applies basis points', () => {
    expect(applyScale(4n * NEAR, 100)).toBe(4n * NEAR / 100n);
    expect(applyScale(4n * NEAR, 10_000)).toBe(4n * NEAR);
  });
});

describe('nearToYocto / formatNear', () => {
  it('parses decimal NEAR strings', () => {
    expect(nearToYocto('1.5')).toBe(15n * NEAR / 10n);
    expect(nearToYocto('0')).toBe(0n);
    expect(nearToYocto(' 2 ')).toBe(2n * NEAR);
  });
  it('rejects invalid strings', () => {
    expect(() => nearToYocto('abc')).toThrow(/Invalid NEAR amount/);
    expect(() => nearToYocto('-1')).toThrow(/Invalid NEAR amount/);
  });
  it('formats yocto as trimmed NEAR', () => {
    expect(formatNear(15n * NEAR / 10n)).toBe('1.5');
    expect(formatNear('37500000000000000000000000')).toBe('37.5');
    expect(formatNear(0n)).toBe('0');
    expect(formatNear(123456n * NEAR / 1_000_000n, 2)).toBe('0.12');
  });
});

describe('canonicalJson / sha256Hex', () => {
  it('sorts keys recursively', () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: [3, { f: 1, e: 0 }] } })).toBe('{"a":{"c":[3,{"e":0,"f":1}],"d":2},"b":1}');
  });
  it('hashes with sha256', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

describe('buildQuote', () => {
  it('builds a deterministic scaled quote', async () => {
    const a = await buildQuote(offer, rate, 1_000, 100);
    const b = await buildQuote(offer, rate, 1_000, 100);
    expect(a).toEqual(b);
    expect(a.amountYocto).toBe((375n * NEAR / 1000n).toString());
    expect(a.quoteRef).toBe('flight:q1');
    expect(a.expiresAtMs).toBe(1_000 + 10 * 60 * 1000);
    expect(a.quoteHash).toMatch(/^[0-9a-f]{64}$/);
  });
  it('changes the hash when the scale changes', async () => {
    const a = await buildQuote(offer, rate, 1_000, 100);
    const b = await buildQuote(offer, rate, 1_000, 200);
    expect(a.quoteHash).not.toBe(b.quoteHash);
  });
  it('rejects a rate in another currency', async () => {
    await expect(buildQuote(offer, { ...rate, currency: 'USD' }, 1_000, 100)).rejects.toThrow(/currency/);
  });
});
```

- [ ] **Step 3: Run the tests and confirm they fail**

Run: `npx vitest run src/lib/canoe/quote.test.ts` (from `apps/web`)
Expected: FAIL. `Cannot find module './quote'`

- [ ] **Step 4: Implement `quote.ts`**

`apps/web/src/lib/canoe/quote.ts`:

```ts
import { CANOE_DEMO_SCALE_BPS, QUOTE_TTL_MS } from './config';
import type { Offer, Quote, Rate } from './types';

const YOCTO_PER_NEAR = 10n ** 24n;
const MICRO = 1_000_000;

export function fiatToYocto(amount: number, nearPrice: number): bigint {
  if (!(amount > 0) || !(nearPrice > 0) || !Number.isFinite(amount) || !Number.isFinite(nearPrice)) {
    throw new Error('amount and nearPrice must be positive numbers');
  }
  const amountMicro = BigInt(Math.round(amount * MICRO));
  const priceMicro = BigInt(Math.round(nearPrice * MICRO));
  return (amountMicro * YOCTO_PER_NEAR) / priceMicro;
}

export function applyScale(yocto: bigint, scaleBps: number): bigint {
  return (yocto * BigInt(scaleBps)) / 10_000n;
}

export function nearToYocto(near: string): bigint {
  const text = near.trim();
  if (!/^\d+(\.\d{1,24})?$/.test(text)) throw new Error(`Invalid NEAR amount: ${near}`);
  const [whole, fraction = ''] = text.split('.');
  return BigInt(whole) * YOCTO_PER_NEAR + BigInt(fraction.padEnd(24, '0'));
}

export function formatNear(yocto: bigint | string, digits = 4): string {
  const value = typeof yocto === 'bigint' ? yocto : BigInt(yocto);
  const whole = value / YOCTO_PER_NEAR;
  const fraction = (value % YOCTO_PER_NEAR).toString().padStart(24, '0').slice(0, digits).replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function buildQuote(offer: Offer, rate: Rate, nowMs: number, scaleBps = CANOE_DEMO_SCALE_BPS): Promise<Quote> {
  if (offer.currency !== rate.currency) {
    throw new Error(`Rate currency ${rate.currency} does not match offer currency ${offer.currency}`);
  }
  const amountYocto = applyScale(fiatToYocto(offer.price, rate.nearPrice), scaleBps).toString();
  const body = {
    offerId: offer.id,
    category: offer.category,
    quoteRef: `${offer.category}:${offer.id}`,
    fiatAmount: offer.price,
    currency: offer.currency,
    nearPrice: rate.nearPrice,
    rateSource: rate.source,
    scaleBps,
    amountYocto,
    createdAtMs: nowMs,
    expiresAtMs: nowMs + QUOTE_TTL_MS,
  };
  return { ...body, quoteHash: await sha256Hex(canonicalJson(body)) };
}
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `npx vitest run src/lib/canoe/quote.test.ts`
Expected: PASS, 12 tests.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/canoe
git commit -m "feat(canoe): add quote, config and type helpers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Contract argument builders and view types

**Files:**
- Create: `apps/web/src/lib/canoe/contract.ts`
- Test: `apps/web/src/lib/canoe/contract.test.ts`

**Interfaces:**
- Consumes: `Category`, `CATEGORIES`, `Quote` (Task 4), `nearToYocto` (Task 4)
- Produces:
  - `type ContractCategory = 'Flight' | 'Hotel' | 'Car'`
  - `interface ContractAmounts { flight: string; hotel: string; car: string }`
  - `interface ContractTrip { id: number; owner: string; limits: ContractAmounts; spent: ContractAmounts; expires_at_ms: number; open: boolean }`
  - `interface ContractPayment { trip_id: number; category: ContractCategory; amount: string; merchant: string; quote_hash: string; quote_ref: string; paid_at_ms: number }`
  - `toContractCategory(c: Category): ContractCategory`
  - `fromContractCategory(c: ContractCategory): Category`
  - `remaining(trip: ContractTrip, c: Category): bigint`
  - `createTripCall(limitsNear: Record<Category, string>, expiresAtMs: number): { args: { limits: ContractAmounts; expires_at_ms: number }; deposit: string }`
  - `payQuoteArgs(tripId: number, quote: Quote, merchant: string): Record<string, unknown>`

- [ ] **Step 1: Write the failing tests**

`apps/web/src/lib/canoe/contract.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createTripCall, fromContractCategory, payQuoteArgs, remaining, toContractCategory, type ContractTrip } from './contract';
import type { Quote } from './types';

const NEAR = 10n ** 24n;
const trip: ContractTrip = {
  id: 3, owner: 'canoe-user1.testnet', open: true, expires_at_ms: 2_000_000_000_000,
  limits: { flight: (2n * NEAR).toString(), hotel: NEAR.toString(), car: '0' },
  spent: { flight: (NEAR / 2n).toString(), hotel: '0', car: '0' },
};

describe('category mapping', () => {
  it('maps both ways', () => {
    expect(toContractCategory('hotel')).toBe('Hotel');
    expect(fromContractCategory('Car')).toBe('car');
  });
});

describe('remaining', () => {
  it('subtracts spent from limit', () => {
    expect(remaining(trip, 'flight')).toBe(3n * NEAR / 2n);
    expect(remaining(trip, 'car')).toBe(0n);
  });
});

describe('createTripCall', () => {
  it('builds yocto limits and a matching deposit', () => {
    const call = createTripCall({ flight: '1', hotel: '0.5', car: '0' }, 99);
    expect(call.args).toEqual({ limits: { flight: NEAR.toString(), hotel: (NEAR / 2n).toString(), car: '0' }, expires_at_ms: 99 });
    expect(call.deposit).toBe((3n * NEAR / 2n).toString());
  });
  it('rejects an empty budget', () => {
    expect(() => createTripCall({ flight: '0', hotel: '0', car: '0' }, 99)).toThrow(/greater than zero/);
  });
});

describe('payQuoteArgs', () => {
  it('maps a quote to contract args', () => {
    const quote = { category: 'flight', amountYocto: '42', quoteHash: 'a'.repeat(64), quoteRef: 'flight:q1', expiresAtMs: 5 } as Quote;
    expect(payQuoteArgs(3, quote, 'canoe-dev.testnet')).toEqual({
      trip_id: 3, category: 'Flight', amount: '42', merchant: 'canoe-dev.testnet',
      quote_hash: 'a'.repeat(64), quote_ref: 'flight:q1', quote_expires_at_ms: 5,
    });
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run src/lib/canoe/contract.test.ts`
Expected: FAIL. `Cannot find module './contract'`

- [ ] **Step 3: Implement `contract.ts`**

`apps/web/src/lib/canoe/contract.ts`:

```ts
import { nearToYocto } from './quote';
import { CATEGORIES, type Category, type Quote } from './types';

export type ContractCategory = 'Flight' | 'Hotel' | 'Car';

export interface ContractAmounts {
  flight: string;
  hotel: string;
  car: string;
}

export interface ContractTrip {
  id: number;
  owner: string;
  limits: ContractAmounts;
  spent: ContractAmounts;
  expires_at_ms: number;
  open: boolean;
}

export interface ContractPayment {
  trip_id: number;
  category: ContractCategory;
  amount: string;
  merchant: string;
  quote_hash: string;
  quote_ref: string;
  paid_at_ms: number;
}

const TO_CONTRACT: Record<Category, ContractCategory> = { flight: 'Flight', hotel: 'Hotel', car: 'Car' };

export const toContractCategory = (category: Category): ContractCategory => TO_CONTRACT[category];

export function fromContractCategory(category: ContractCategory): Category {
  const match = CATEGORIES.find((c) => TO_CONTRACT[c] === category);
  if (!match) throw new Error(`Unknown category ${category}`);
  return match;
}

export function remaining(trip: ContractTrip, category: Category): bigint {
  return BigInt(trip.limits[category]) - BigInt(trip.spent[category]);
}

export function createTripCall(limitsNear: Record<Category, string>, expiresAtMs: number) {
  const limits: ContractAmounts = {
    flight: nearToYocto(limitsNear.flight).toString(),
    hotel: nearToYocto(limitsNear.hotel).toString(),
    car: nearToYocto(limitsNear.car).toString(),
  };
  const total = CATEGORIES.reduce((sum, c) => sum + BigInt(limits[c]), 0n);
  if (total <= 0n) throw new Error('Budget must be greater than zero');
  return { args: { limits, expires_at_ms: expiresAtMs }, deposit: total.toString() };
}

export function payQuoteArgs(tripId: number, quote: Quote, merchant: string): Record<string, unknown> {
  return {
    trip_id: tripId,
    category: toContractCategory(quote.category),
    amount: quote.amountYocto,
    merchant,
    quote_hash: quote.quoteHash,
    quote_ref: quote.quoteRef,
    quote_expires_at_ms: quote.expiresAtMs,
  };
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run src/lib/canoe/contract.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/canoe/contract.ts apps/web/src/lib/canoe/contract.test.ts
git commit -m "feat(canoe): add contract argument builders and view types

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Offers normalization and `GET /api/canoe/offers`

**Files:**
- Create: `apps/web/src/lib/canoe/offers.ts`
- Test: `apps/web/src/lib/canoe/offers.test.ts`
- Create: `apps/web/src/app/api/canoe/offers/route.ts`

**Interfaces:**
- Consumes: `Offer` (Task 4); `hotelActor()` and `HotelActor` from `@/lib/hotels/access`; `HotelError` (has `.status`) from `@/lib/hotels/domain`; `prisma` from `@/lib/prisma`; `apiSuccess` / `apiError` from `@/lib/api-response`
- Produces:
  - `interface FlightSnapshotRow { price: number; currency: string; scrapedAt: Date; bookingUrl: string | null; airline: string; fetchRunId: string | null; status: string }`
  - `cheapestLatestFlight(rows: FlightSnapshotRow[]): FlightSnapshotRow | null`. Rows must be sorted by `scrapedAt` desc.
  - `flightOffer(query: { id: string; origin: string; destination: string; dateFrom: Date; label: string | null }, best: FlightSnapshotRow): Offer`
  - `hotelOffer(row: { id: string; hotelName: string; latestPrice: number | null; currency: string; lastCheckedAt: Date | null }): Offer | null`
  - `carOffer(row: { id: string; label: string; latestPriceMinor: bigint | null; currency: string; lastCheckedAt: Date | null }): Offer | null`
  - `minorToMajor(minor: bigint, currency: string): number`
  - `sampleOffers(now: Date): Offer[]`, used when `CANOE_SAMPLE_OFFERS=true`
  - HTTP: `GET /api/canoe/offers` returns `{ ok: true, data: { offers: Offer[] } }`, or `{ ok: false, error }` with the actor's status (401/403/404)

- [ ] **Step 1: Write the failing tests**

`apps/web/src/lib/canoe/offers.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { carOffer, cheapestLatestFlight, flightOffer, hotelOffer, minorToMajor, sampleOffers, type FlightSnapshotRow } from './offers';

const row = (price: number, fetchRunId: string | null, minutesAgo: number, status = 'available'): FlightSnapshotRow => ({
  price, currency: 'USD', airline: 'GA', bookingUrl: 'https://example.test/book', fetchRunId, status,
  scrapedAt: new Date(Date.UTC(2026, 10, 11, 12, 0) - minutesAgo * 60_000),
});

describe('cheapestLatestFlight', () => {
  it('picks the cheapest available fare from the latest run only', () => {
    const rows = [row(120, 'r2', 0), row(99, 'r2', 1), row(80, 'r1', 200), row(70, 'r2', 2, 'sold_out')];
    expect(cheapestLatestFlight(rows)?.price).toBe(99);
  });
  it('groups rows without a run id by a one-hour window', () => {
    const rows = [row(150, null, 0), row(140, null, 30), row(60, null, 120)];
    expect(cheapestLatestFlight(rows)?.price).toBe(140);
  });
  it('returns null when nothing is available', () => {
    expect(cheapestLatestFlight([])).toBeNull();
    expect(cheapestLatestFlight([row(50, 'r', 0, 'sold_out')])).toBeNull();
  });
});

describe('offer builders', () => {
  it('builds a flight offer', () => {
    const offer = flightOffer({ id: 'q1', origin: 'CGK', destination: 'DPS', dateFrom: new Date('2026-12-10T00:00:00Z'), label: null }, row(99, 'r', 0));
    expect(offer).toMatchObject({ id: 'q1', category: 'flight', label: 'CGK → DPS · 2026-12-10 · GA', price: 99, currency: 'USD', sample: false });
  });
  it('builds hotel offers and skips missing prices', () => {
    expect(hotelOffer({ id: 'h1', hotelName: 'Beach Inn', latestPrice: 210.5, currency: 'USD', lastCheckedAt: null })).toMatchObject({ category: 'hotel', price: 210.5 });
    expect(hotelOffer({ id: 'h2', hotelName: 'X', latestPrice: null, currency: 'USD', lastCheckedAt: null })).toBeNull();
  });
  it('converts car minor units by currency precision', () => {
    expect(minorToMajor(12345n, 'USD')).toBe(123.45);
    expect(minorToMajor(5000n, 'JPY')).toBe(5000);
    expect(carOffer({ id: 'c1', label: 'Economy', latestPriceMinor: 9900n, currency: 'EUR', lastCheckedAt: null })).toMatchObject({ category: 'car', price: 99 });
    expect(carOffer({ id: 'c2', label: 'X', latestPriceMinor: null, currency: 'EUR', lastCheckedAt: null })).toBeNull();
  });
  it('labels sample offers', () => {
    const samples = sampleOffers(new Date('2026-11-11T00:00:00Z'));
    expect(samples.map((s) => s.category)).toEqual(['flight', 'hotel', 'car']);
    expect(samples.every((s) => s.sample && s.label.startsWith('Sample · '))).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run src/lib/canoe/offers.test.ts`
Expected: FAIL. `Cannot find module './offers'`

- [ ] **Step 3: Implement `offers.ts`**

`apps/web/src/lib/canoe/offers.ts`:

```ts
import type { Offer } from './types';

export interface FlightSnapshotRow {
  price: number;
  currency: string;
  scrapedAt: Date;
  bookingUrl: string | null;
  airline: string;
  fetchRunId: string | null;
  status: string;
}

const HOUR_MS = 60 * 60 * 1000;
export const SAMPLE_PREFIX = 'Sample · ';

/** Rows must be sorted by scrapedAt descending. */
export function cheapestLatestFlight(rows: FlightSnapshotRow[]): FlightSnapshotRow | null {
  const latest = rows[0];
  if (!latest) return null;
  const sameRun = (r: FlightSnapshotRow) =>
    latest.fetchRunId !== null
      ? r.fetchRunId === latest.fetchRunId
      : latest.scrapedAt.getTime() - r.scrapedAt.getTime() <= HOUR_MS;
  const candidates = rows.filter((r) => sameRun(r) && r.status === 'available' && r.price > 0);
  return candidates.reduce<FlightSnapshotRow | null>((best, r) => (best === null || r.price < best.price ? r : best), null);
}

export function flightOffer(
  query: { id: string; origin: string; destination: string; dateFrom: Date; label: string | null },
  best: FlightSnapshotRow,
): Offer {
  const date = query.dateFrom.toISOString().slice(0, 10);
  return {
    id: query.id,
    category: 'flight',
    label: query.label ?? `${query.origin} → ${query.destination} · ${date} · ${best.airline}`,
    price: best.price,
    currency: best.currency,
    observedAt: best.scrapedAt.toISOString(),
    sourceUrl: best.bookingUrl,
    sample: false,
  };
}

export function hotelOffer(row: { id: string; hotelName: string; latestPrice: number | null; currency: string; lastCheckedAt: Date | null }): Offer | null {
  if (row.latestPrice === null || !(row.latestPrice > 0)) return null;
  return {
    id: row.id, category: 'hotel', label: row.hotelName, price: row.latestPrice, currency: row.currency,
    observedAt: (row.lastCheckedAt ?? new Date(0)).toISOString(), sourceUrl: null, sample: false,
  };
}

export function minorToMajor(minor: bigint, currency: string): number {
  const digits = new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
  return Number(minor) / 10 ** digits;
}

export function carOffer(row: { id: string; label: string; latestPriceMinor: bigint | null; currency: string; lastCheckedAt: Date | null }): Offer | null {
  if (row.latestPriceMinor === null || row.latestPriceMinor <= 0n) return null;
  return {
    id: row.id, category: 'car', label: row.label, price: minorToMajor(row.latestPriceMinor, row.currency), currency: row.currency,
    observedAt: (row.lastCheckedAt ?? new Date(0)).toISOString(), sourceUrl: null, sample: false,
  };
}

/** Clearly labelled demo offers, enabled with CANOE_SAMPLE_OFFERS=true when live scraping is unavailable. */
export function sampleOffers(now: Date): Offer[] {
  const observedAt = now.toISOString();
  const base = { currency: 'IDR', observedAt, sourceUrl: null, sample: true } as const;
  return [
    { ...base, id: 'sample-flight-cgk-dps', category: 'flight', label: `${SAMPLE_PREFIX}CGK → DPS · 2026-12-10`, price: 1_500_000 },
    { ...base, id: 'sample-hotel-bali', category: 'hotel', label: `${SAMPLE_PREFIX}Bali beach hotel · 3 nights`, price: 1_350_000 },
    { ...base, id: 'sample-car-dps', category: 'car', label: `${SAMPLE_PREFIX}Ngurah Rai economy car · 3 days`, price: 750_000 },
  ];
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run src/lib/canoe/offers.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Write the route**

`apps/web/src/app/api/canoe/offers/route.ts`:

```ts
import { apiError, apiSuccess } from '@/lib/api-response';
import { hotelActor, type HotelActor } from '@/lib/hotels/access';
import { HotelError } from '@/lib/hotels/domain';
import { prisma } from '@/lib/prisma';
import { carOffer, cheapestLatestFlight, flightOffer, hotelOffer, sampleOffers } from '@/lib/canoe/offers';
import type { Offer } from '@/lib/canoe/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  let actor: HotelActor;
  try {
    actor = await hotelActor();
  } catch (error) {
    if (error instanceof HotelError) return apiError(error.message, error.status);
    throw error;
  }
  const owner = actor.userId === null ? {} : { userId: actor.userId };
  const today = new Date(new Date().toISOString().slice(0, 10));

  const [queries, hotels, cars] = await Promise.all([
    prisma.query.findMany({
      where: { ...owner, isSeed: false, dateFrom: { gte: today } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true, origin: true, destination: true, dateFrom: true, label: true,
        snapshots: {
          orderBy: { scrapedAt: 'desc' },
          take: 60,
          select: { price: true, currency: true, scrapedAt: true, bookingUrl: true, airline: true, fetchRunId: true, status: true },
        },
      },
    }),
    prisma.hotelTracker.findMany({ where: { ...owner, latestPrice: { not: null } }, orderBy: { createdAt: 'desc' }, take: 50 }),
    prisma.carTracker.findMany({ where: { ...owner, latestPriceMinor: { not: null } }, orderBy: { createdAt: 'desc' }, take: 50 }),
  ]);

  const offers: Offer[] = [];
  for (const query of queries) {
    const best = cheapestLatestFlight(query.snapshots);
    if (best) offers.push(flightOffer(query, best));
  }
  for (const hotel of hotels) {
    const search = hotel.search as { currency?: unknown };
    const offer = hotelOffer({
      id: hotel.id,
      hotelName: hotel.hotelName,
      latestPrice: hotel.latestPrice === null ? null : Number(hotel.latestPrice),
      currency: typeof search.currency === 'string' ? search.currency : 'USD',
      lastCheckedAt: hotel.lastCheckedAt,
    });
    if (offer) offers.push(offer);
  }
  for (const car of cars) {
    const offer = carOffer(car);
    if (offer) offers.push(offer);
  }
  if (process.env.CANOE_SAMPLE_OFFERS === 'true') offers.push(...sampleOffers(new Date()));

  return apiSuccess({ offers });
}
```

- [ ] **Step 6: Typecheck and try it**

Run: `npm run typecheck --workspace=@flight-finder/web`
Expected: no errors.
Then, with the dev server running and signed in as admin (start `npm run dev` with `CANOE_SAMPLE_OFFERS=true` exported), open `http://localhost:3003/api/canoe/offers` in the browser.
Expected: `{"ok":true,"data":{"offers":[...]}}`, including the three `Sample · ` offers.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/canoe/offers.ts apps/web/src/lib/canoe/offers.test.ts apps/web/src/app/api/canoe/offers
git commit -m "feat(canoe): expose tracked offers for trip payments

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: NEAR rate and `GET /api/canoe/rate`

**Files:**
- Create: `apps/web/src/lib/canoe/rate.ts`
- Test: `apps/web/src/lib/canoe/rate.test.ts`
- Create: `apps/web/src/app/api/canoe/rate/route.ts`

**Interfaces:**
- Consumes: `Rate` (Task 4)
- Produces:
  - `parseCoingecko(body: unknown, currency: string): number | null`
  - `fallbackRates(): Record<string, number>`. Reads the `CANOE_FALLBACK_RATES` JSON env. Default: `{"USD":2.5,"IDR":40000,"EUR":2.3}`.
  - `getNearRate(currency: string, fetchImpl?: typeof fetch, now?: () => Date): Promise<Rate>`. Has a 60 s in-memory cache per currency. Throws `Error('No NEAR rate for XXX')` if both CoinGecko and the fallback miss.
  - `clearRateCache(): void` (tests)
  - HTTP: `GET /api/canoe/rate?currency=IDR` returns `{ ok: true, data: { rate: Rate } }`; 400 on a bad currency; 503 when no rate is available

- [ ] **Step 1: Write the failing tests**

`apps/web/src/lib/canoe/rate.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearRateCache, getNearRate, parseCoingecko } from './rate';

const now = () => new Date('2026-11-11T00:00:00.000Z');
const okFetch = (body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch;

beforeEach(() => clearRateCache());

describe('parseCoingecko', () => {
  it('reads near.<currency>', () => {
    expect(parseCoingecko({ near: { idr: 41000 } }, 'IDR')).toBe(41000);
    expect(parseCoingecko({ near: {} }, 'IDR')).toBeNull();
    expect(parseCoingecko('nope', 'IDR')).toBeNull();
  });
});

describe('getNearRate', () => {
  it('uses CoinGecko when it answers', async () => {
    const rate = await getNearRate('IDR', okFetch({ near: { idr: 41000 } }), now);
    expect(rate).toEqual({ currency: 'IDR', nearPrice: 41000, fetchedAt: '2026-11-11T00:00:00.000Z', source: 'coingecko' });
  });
  it('caches for 60 seconds', async () => {
    const fetchImpl = okFetch({ near: { usd: 3 } });
    await getNearRate('USD', fetchImpl, now);
    await getNearRate('USD', fetchImpl, now);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it('falls back to the labelled default table', async () => {
    const failing = vi.fn(async () => { throw new Error('offline'); }) as unknown as typeof fetch;
    const rate = await getNearRate('USD', failing, now);
    expect(rate).toMatchObject({ currency: 'USD', nearPrice: 2.5, source: 'fallback' });
  });
  it('throws when no rate exists', async () => {
    const failing = vi.fn(async () => new Response('{}', { status: 500 })) as unknown as typeof fetch;
    await expect(getNearRate('JPY', failing, now)).rejects.toThrow('No NEAR rate for JPY');
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run src/lib/canoe/rate.test.ts`
Expected: FAIL. `Cannot find module './rate'`

- [ ] **Step 3: Implement `rate.ts`**

`apps/web/src/lib/canoe/rate.ts`:

```ts
import type { Rate } from './types';

const CACHE_MS = 60_000;
const DEFAULT_FALLBACK: Record<string, number> = { USD: 2.5, IDR: 40_000, EUR: 2.3 };
const cache = new Map<string, { rate: Rate; at: number }>();

export function clearRateCache(): void {
  cache.clear();
}

export function parseCoingecko(body: unknown, currency: string): number | null {
  if (!body || typeof body !== 'object') return null;
  const near = (body as Record<string, unknown>).near;
  if (!near || typeof near !== 'object') return null;
  const value = (near as Record<string, unknown>)[currency.toLowerCase()];
  return typeof value === 'number' && value > 0 ? value : null;
}

export function fallbackRates(): Record<string, number> {
  const raw = process.env.CANOE_FALLBACK_RATES;
  if (!raw) return DEFAULT_FALLBACK;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed).filter((e): e is [string, number] => typeof e[1] === 'number' && e[1] > 0),
    );
  } catch {
    return DEFAULT_FALLBACK;
  }
}

export async function getNearRate(currency: string, fetchImpl: typeof fetch = fetch, now: () => Date = () => new Date()): Promise<Rate> {
  const code = currency.toUpperCase();
  const at = now().getTime();
  const hit = cache.get(code);
  if (hit && at - hit.at < CACHE_MS) return hit.rate;

  let rate: Rate | null = null;
  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=near&vs_currencies=${code.toLowerCase()}`;
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(5_000), headers: { accept: 'application/json' } });
    const price = response.ok ? parseCoingecko(await response.json(), code) : null;
    if (price) rate = { currency: code, nearPrice: price, fetchedAt: now().toISOString(), source: 'coingecko' };
  } catch {
    rate = null;
  }
  if (!rate) {
    const price = fallbackRates()[code];
    if (!price) throw new Error(`No NEAR rate for ${code}`);
    rate = { currency: code, nearPrice: price, fetchedAt: now().toISOString(), source: 'fallback' };
  }
  cache.set(code, { rate, at });
  return rate;
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run src/lib/canoe/rate.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Write the route**

`apps/web/src/app/api/canoe/rate/route.ts`:

```ts
import { apiError, apiSuccess } from '@/lib/api-response';
import { getNearRate } from '@/lib/canoe/rate';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const currency = (new URL(request.url).searchParams.get('currency') ?? '').toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) return apiError('currency must be a 3-letter ISO code', 400);
  try {
    return apiSuccess({ rate: await getNearRate(currency) });
  } catch (error) {
    return apiError(error instanceof Error ? error.message : 'Rate unavailable', 503);
  }
}
```

- [ ] **Step 6: Try it**

Run: `curl -s "http://localhost:3003/api/canoe/rate?currency=IDR"`
Expected: `{"ok":true,"data":{"rate":{"currency":"IDR","nearPrice":...,"source":"coingecko"...}}}`. If the site is gated by the shared password, open the URL in the signed-in browser instead.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/canoe/rate.ts apps/web/src/lib/canoe/rate.test.ts apps/web/src/app/api/canoe/rate
git commit -m "feat(canoe): add NEAR rate endpoint with labelled fallback

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Wallet provider

**Files:**
- Modify: `apps/web/package.json` (dependencies)
- Create: `apps/web/src/components/canoe/NearProvider.tsx`

**Interfaces:**
- Consumes: `CANOE_NETWORK`, `CANOE_RPC_URLS` (Task 4)
- Produces:
  - `<NearProvider>{children}</NearProvider>`
  - `useNearWallet(): { loading: boolean; signedAccountId: string; signIn(): Promise<void>; signOut(): Promise<void>; viewFunction<T>(p: { contractId: string; method: string; args?: Record<string, unknown> }): Promise<T>; callFunction(p: { contractId: string; method: string; args?: Record<string, unknown>; gas?: string; deposit?: string }): Promise<{ hash: string }> }`
- Note: there is deliberately **no** function-call-access-key plugin. Every `pay_quote` must open the wallet so the user approves it.

- [ ] **Step 1: Install the dependencies (exact versions)**

Run: `npm install --workspace=@flight-finder/web --save-exact near-api-js@7.3.1 @hot-labs/near-connect@0.11.4`
Expected: both appear in `apps/web/package.json` without `^`, and `package-lock.json` is updated.

- [ ] **Step 2: Write the provider**

`apps/web/src/components/canoe/NearProvider.tsx`:

```tsx
'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { FailoverRpcProvider, JsonRpcProvider } from 'near-api-js';
import { NearConnector, type EventMap } from '@hot-labs/near-connect';
import { CANOE_NETWORK, CANOE_RPC_URLS } from '@/lib/canoe/config';

type Wallet = Awaited<ReturnType<NearConnector['wallet']>>;
type ViewParams = { contractId: string; method: string; args?: Record<string, unknown> };
type CallParams = ViewParams & { gas?: string; deposit?: string };

interface NearContextValue {
  loading: boolean;
  signedAccountId: string;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  viewFunction: <T>(params: ViewParams) => Promise<T>;
  callFunction: (params: CallParams) => Promise<{ hash: string }>;
}

const NearContext = createContext<NearContextValue | undefined>(undefined);

function txHash(outcome: unknown): string {
  if (outcome && typeof outcome === 'object' && 'transaction_outcome' in outcome) {
    const tx = (outcome as { transaction_outcome?: { id?: unknown } }).transaction_outcome;
    if (tx && typeof tx.id === 'string') return tx.id;
  }
  return '';
}

export function NearProvider({ children }: PropsWithChildren) {
  const connector = useMemo(
    () => new NearConnector({ network: CANOE_NETWORK, providers: { mainnet: CANOE_RPC_URLS.mainnet, testnet: CANOE_RPC_URLS.testnet } }),
    [],
  );
  const rpc = useMemo(
    () => new FailoverRpcProvider(CANOE_RPC_URLS[CANOE_NETWORK].map((url) => new JsonRpcProvider({ url }))),
    [],
  );
  const [wallet, setWallet] = useState<Wallet | undefined>();
  const [signedAccountId, setSignedAccountId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const handleSignIn = (payload: EventMap['wallet:signIn']) => {
      if (cancelled) return;
      setWallet(payload.wallet);
      setSignedAccountId(payload.accounts[0]?.accountId ?? '');
    };
    const handleSignOut = () => {
      if (cancelled) return;
      setWallet(undefined);
      setSignedAccountId('');
    };
    connector.on('wallet:signIn', handleSignIn);
    connector.on('wallet:signOut', handleSignOut);
    connector
      .getConnectedWallet()
      .catch(() => null)
      .then((connected) => {
        if (cancelled) return;
        if (connected) {
          setWallet(connected.wallet);
          setSignedAccountId(connected.accounts[0]?.accountId ?? '');
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
      connector.off('wallet:signIn', handleSignIn);
      connector.off('wallet:signOut', handleSignOut);
    };
  }, [connector]);

  const signIn = useCallback(async () => {
    const connected = await connector.connect();
    setWallet(connected);
    const accounts = await connected.getAccounts();
    setSignedAccountId(accounts[0]?.accountId ?? '');
  }, [connector]);

  const signOut = useCallback(async () => {
    if (!wallet) return;
    await connector.disconnect(wallet);
    setWallet(undefined);
    setSignedAccountId('');
  }, [connector, wallet]);

  const viewFunction = useCallback(
    async <T,>({ contractId, method, args = {} }: ViewParams): Promise<T> =>
      (await rpc.callFunction({ contractId, method, args })) as T,
    [rpc],
  );

  const callFunction = useCallback(
    async ({ contractId, method, args = {}, gas = '50000000000000', deposit = '0' }: CallParams) => {
      if (!wallet) throw new Error('Wallet is not connected');
      const outcome: unknown = await wallet.signAndSendTransaction({
        receiverId: contractId,
        actions: [{ type: 'FunctionCall', params: { methodName: method, args, gas, deposit } }],
      });
      return { hash: txHash(outcome) };
    },
    [wallet],
  );

  const value = useMemo(
    () => ({ loading, signedAccountId, signIn, signOut, viewFunction, callFunction }),
    [loading, signedAccountId, signIn, signOut, viewFunction, callFunction],
  );
  return <NearContext.Provider value={value}>{children}</NearContext.Provider>;
}

export function useNearWallet(): NearContextValue {
  const context = useContext(NearContext);
  if (!context) throw new Error('useNearWallet must be used within NearProvider');
  return context;
}
```

- [ ] **Step 3: Typecheck and lint**

Run: `npm run typecheck --workspace=@flight-finder/web && npm run lint --workspace=@flight-finder/web`
Expected: no errors. If `rpc.callFunction` or `wallet.signAndSendTransaction` signatures differ in the installed versions, compare them with `node_modules/near-api-js/lib/**/*.d.ts` and `node_modules/@hot-labs/near-connect/**/*.d.ts` and adapt the call. Do not change the exported `useNearWallet` contract.

- [ ] **Step 4: Commit**

```bash
git add apps/web/package.json package-lock.json apps/web/src/components/canoe/NearProvider.tsx
git commit -m "feat(canoe): add NEAR wallet provider (near-connect)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: i18n strings and the `/trip` page

**Files:**
- Create: `apps/web/messages/en/canoe.json`, plus identical-key copies in `de/`, `es/`, `fr/` and `pt/`
- Modify: `apps/web/src/i18n/request.ts` (`AREAS`)
- Modify: `apps/web/src/test/setup-intl.ts` (import `canoe.json`)
- Modify: `apps/web/src/components/hotels/TravelNav.tsx`
- Create: `apps/web/src/components/canoe/TripBudget.module.css`
- Create: `apps/web/src/components/canoe/TripCreateForm.tsx`
- Create: `apps/web/src/components/canoe/OfferList.tsx`
- Create: `apps/web/src/components/canoe/PaymentHistory.tsx`
- Create: `apps/web/src/components/canoe/TripBudget.tsx`
- Create: `apps/web/src/app/trip/page.tsx`

**Interfaces:**
- Consumes: everything from Tasks 4–8: `useNearWallet`, `buildQuote`, `formatNear`, `createTripCall`, `payQuoteArgs`, `remaining`, `fromContractCategory`, `ContractTrip`, `ContractPayment`, `Offer`, `Rate`, `CATEGORIES`, `CANOE_CONTRACT`, `CANOE_MERCHANT`, `CANOE_DEMO_SCALE_BPS`, `explorerTxUrl`, `explorerAccountUrl`
- Produces: the `/trip` route and a "Trip Budget" link in `TravelNav`

- [ ] **Step 1: Add the message files.** `apps/web/messages/en/canoe.json`:

```json
{
  "Canoe": {
    "navTrip": "Trip Budget",
    "eyebrow": "CANOE on NEAR",
    "headline": "One trip, one budget, paid on-chain.",
    "intro": "Lock NEAR for a trip, split it into flight, hotel and car limits, and approve each payment from your own wallet. The contract refuses any payment over a limit.",
    "simulated": "Booking with the airline, hotel or rental company is simulated. The NEAR transfer to the merchant account is real on testnet.",
    "scale": "Testnet demo scale: quotes are {percent}% of the real price.",
    "connect": "Connect NEAR wallet",
    "disconnect": "Disconnect",
    "signedInAs": "Wallet: {account}",
    "createTitle": "Create a trip budget",
    "flight": "Flight",
    "hotel": "Hotel",
    "car": "Car",
    "limitNear": "{category} limit (NEAR)",
    "validDays": "Valid for (days)",
    "createButton": "Lock {total} NEAR",
    "tripTitle": "Trip #{id}",
    "limit": "Limit",
    "spent": "Spent",
    "remaining": "Remaining",
    "closed": "Closed",
    "expires": "Expires {date}",
    "withdraw": "Withdraw remaining NEAR",
    "offersTitle": "Tracked offers",
    "noOffers": "No tracked offers with a price yet. Track a flight, hotel or car first.",
    "sample": "sample",
    "rateLine": "1 NEAR = {price} {currency} ({source})",
    "payButton": "Approve & pay {amount} NEAR",
    "overLimit": "Over the remaining {category} budget",
    "noTrip": "Create a trip budget first",
    "paymentsTitle": "Payments",
    "noPayments": "No payments yet.",
    "viewTx": "View transaction",
    "viewContract": "View contract activity",
    "loading": "Loading…",
    "working": "Waiting for wallet…",
    "error": "Error: {message}",
    "connectFirst": "Connect a wallet to create a budget and pay."
  }
}
```

Copy this file unchanged to `apps/web/messages/de/canoe.json`, `es/canoe.json`, `fr/canoe.json` and `pt/canoe.json`. English text is fine for the hackathon; only the key sets must match.

Run: `for l in de es fr pt; do cp apps/web/messages/en/canoe.json apps/web/messages/$l/canoe.json; done`

- [ ] **Step 2: Register the area.**

In `apps/web/src/i18n/request.ts`, change:

```ts
const AREAS = ['common', 'components', 'pages', 'settings', 'admin', 'hotels', 'cars'] as const;
```

to:

```ts
const AREAS = ['common', 'components', 'pages', 'settings', 'admin', 'hotels', 'cars', 'canoe'] as const;
```

In `apps/web/src/test/setup-intl.ts`, add an import after the `cars` import:

```ts
import canoe from '../../messages/en/canoe.json';
```

and change the messages line to:

```ts
const messages = { ...common, ...components, ...pages, ...settings, ...admin, ...hotels, ...cars, ...canoe };
```

Run: `npx vitest run src/i18n/messages-parity.test.ts` (from `apps/web`)
Expected: PASS.

- [ ] **Step 3: Add the nav link.** Replace the body of `apps/web/src/components/hotels/TravelNav.tsx` with:

```tsx
'use client';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import styles from './Hotels.module.css';
export function TravelNav({ active }: { active?: 'flights' | 'hotels' | 'cars' | 'trip' }) {
  const t = useTranslations('Hotels');
  const cars = useTranslations('Cars');
  const canoe = useTranslations('Canoe');
  return <nav className={styles.nav} aria-label={t('travel')}><Link href="/" aria-current={active === 'flights' ? 'page' : undefined}>{t('flights')}</Link><Link href="/hotels" aria-current={active === 'hotels' ? 'page' : undefined}>{t('hotels')}</Link><Link href="/cars" aria-current={active === 'cars' ? 'page' : undefined}>{cars('carsNav')}</Link><Link href="/trip" aria-current={active === 'trip' ? 'page' : undefined}>{canoe('navTrip')}</Link></nav>;
}
```

Run: `npx vitest run src/components/hotels src/components/cars`
Expected: PASS. The existing link assertions still hold.

- [ ] **Step 4: Styles.** `apps/web/src/components/canoe/TripBudget.module.css`:

```css
.root { display: grid; gap: 1.5rem; }
.banner { border-left: 3px solid var(--accent); background: var(--surface); padding: .8rem 1rem; font-size: .9rem; line-height: 1.5; }
.walletBar { display: flex; flex-wrap: wrap; gap: 1rem; align-items: center; justify-content: space-between; border: 1px solid var(--border); border-radius: var(--radius-md); padding: .8rem 1rem; }
.mono { font-family: var(--font-mono); overflow-wrap: anywhere; }
.card { border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--surface); padding: 1.25rem; display: grid; gap: 1rem; }
.card h2 { font-family: var(--font-display); margin: 0; font-size: 1.4rem; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: .75rem; }
.stat { border: 1px solid var(--border); border-radius: var(--radius-md); padding: .75rem; display: grid; gap: .25rem; }
.stat strong { font-family: var(--font-display); }
.form { display: grid; gap: .75rem; }
.field { display: grid; gap: .3rem; font-size: .85rem; color: var(--text-secondary); }
.field input { font: inherit; color: var(--text); background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-md); padding: .55rem .7rem; }
.button { font: inherit; cursor: pointer; border: 1px solid var(--accent); background: var(--accent); color: var(--bg); border-radius: var(--radius-md); padding: .55rem 1rem; }
.button:disabled { opacity: .5; cursor: not-allowed; }
.ghost { font: inherit; cursor: pointer; border: 1px solid var(--border); background: transparent; color: var(--text); border-radius: var(--radius-md); padding: .45rem .9rem; }
.list { list-style: none; margin: 0; padding: 0; display: grid; gap: .6rem; }
.row { display: flex; flex-wrap: wrap; gap: .75rem; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border); padding: .6rem 0; }
.rowMain { display: grid; gap: .2rem; min-width: 0; }
.badge { font: .7rem var(--font-mono); text-transform: uppercase; letter-spacing: .1em; border: 1px solid var(--border); border-radius: 999px; padding: .1rem .5rem; }
.muted { color: var(--text-secondary); font-size: .85rem; }
.error { border-left: 3px solid var(--danger, #c1272d); padding: .8rem 1rem; background: var(--surface); overflow-wrap: anywhere; }
```

- [ ] **Step 5: Create-budget form.** `apps/web/src/components/canoe/TripCreateForm.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { formatNear, nearToYocto } from '@/lib/canoe/quote';
import { CATEGORIES, type Category } from '@/lib/canoe/types';
import styles from './TripBudget.module.css';

export function TripCreateForm({ disabled, onCreate }: { disabled: boolean; onCreate: (limits: Record<Category, string>, days: number) => Promise<void> }) {
  const t = useTranslations('Canoe');
  const [limits, setLimits] = useState<Record<Category, string>>({ flight: '1', hotel: '1', car: '0.5' });
  const [days, setDays] = useState('30');

  let total = '0';
  try {
    total = formatNear(CATEGORIES.reduce((sum, c) => sum + nearToYocto(limits[c] || '0'), 0n));
  } catch {
    total = '?';
  }

  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        void onCreate(limits, Math.max(1, Number.parseInt(days, 10) || 1));
      }}
    >
      <div className={styles.grid}>
        {CATEGORIES.map((category) => (
          <label key={category} className={styles.field}>
            {t('limitNear', { category: t(category) })}
            <input inputMode="decimal" value={limits[category]} onChange={(e) => setLimits({ ...limits, [category]: e.target.value })} />
          </label>
        ))}
        <label className={styles.field}>
          {t('validDays')}
          <input inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} />
        </label>
      </div>
      <button className={styles.button} type="submit" disabled={disabled || total === '?' || total === '0'}>
        {t('createButton', { total })}
      </button>
    </form>
  );
}
```

- [ ] **Step 6: Offer list.** `apps/web/src/components/canoe/OfferList.tsx`:

```tsx
'use client';
import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { remaining, type ContractTrip } from '@/lib/canoe/contract';
import { applyScale, fiatToYocto, formatNear } from '@/lib/canoe/quote';
import { CANOE_DEMO_SCALE_BPS } from '@/lib/canoe/config';
import type { Offer, Rate } from '@/lib/canoe/types';
import styles from './TripBudget.module.css';

type RateResponse = { ok: true; data: { rate: Rate } } | { ok: false; error: string };

export function OfferList({ offers, trip, busy, onPay }: { offers: Offer[]; trip: ContractTrip | null; busy: boolean; onPay: (offer: Offer, rate: Rate) => Promise<void> }) {
  const t = useTranslations('Canoe');
  const currencies = useMemo(() => [...new Set(offers.map((o) => o.currency))].sort(), [offers]);
  const [rates, setRates] = useState<Record<string, Rate>>({});

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      currencies.map(async (currency) => {
        const body = (await (await fetch(`/api/canoe/rate?currency=${currency}`)).json()) as RateResponse;
        return body.ok ? body.data.rate : null;
      }),
    ).then((list) => {
      if (cancelled) return;
      setRates(Object.fromEntries(list.filter((r): r is Rate => r !== null).map((r) => [r.currency, r])));
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [currencies]);

  if (!offers.length) return <p className={styles.muted}>{t('noOffers')}</p>;

  return (
    <ul className={styles.list}>
      {offers.map((offer) => {
        const rate = rates[offer.currency];
        const amount = rate ? applyScale(fiatToYocto(offer.price, rate.nearPrice), CANOE_DEMO_SCALE_BPS) : null;
        const left = trip ? remaining(trip, offer.category) : 0n;
        const fits = amount !== null && trip !== null && trip.open && amount <= left;
        return (
          <li key={`${offer.category}:${offer.id}`} className={styles.row}>
            <div className={styles.rowMain}>
              <strong>{offer.label}</strong>
              <span className={styles.muted}>
                {t(offer.category)} · {new Intl.NumberFormat('en', { style: 'currency', currency: offer.currency }).format(offer.price)}
                {offer.sample ? <> · <span className={styles.badge}>{t('sample')}</span></> : null}
              </span>
              {rate ? <span className={styles.muted}>{t('rateLine', { price: rate.nearPrice, currency: rate.currency, source: rate.source })}</span> : null}
              {!trip ? <span className={styles.muted}>{t('noTrip')}</span> : amount !== null && !fits ? <span className={styles.muted}>{t('overLimit', { category: t(offer.category) })}</span> : null}
            </div>
            <button className={styles.button} type="button" disabled={busy || !rate || amount === null || amount <= 0n} onClick={() => rate && void onPay(offer, rate)}>
              {t('payButton', { amount: amount === null ? '…' : formatNear(amount) })}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
```

The pay button stays enabled when the amount is over the limit. This is on purpose: the demo shows the contract rejecting the payment on-chain (spec, scenario step 8).

- [ ] **Step 7: Payment history.** `apps/web/src/components/canoe/PaymentHistory.tsx`:

```tsx
'use client';
import { useTranslations } from 'next-intl';
import { fromContractCategory, type ContractPayment } from '@/lib/canoe/contract';
import { CANOE_CONTRACT, explorerAccountUrl, explorerTxUrl } from '@/lib/canoe/config';
import { formatNear } from '@/lib/canoe/quote';
import styles from './TripBudget.module.css';

export function PaymentHistory({ payments, txByHash }: { payments: ContractPayment[]; txByHash: Record<string, string> }) {
  const t = useTranslations('Canoe');
  if (!payments.length) return <p className={styles.muted}>{t('noPayments')}</p>;
  return (
    <ul className={styles.list}>
      {payments.map((payment) => {
        const tx = txByHash[payment.quote_hash];
        return (
          <li key={payment.quote_hash} className={styles.row}>
            <div className={styles.rowMain}>
              <strong>{t(fromContractCategory(payment.category))} · {formatNear(payment.amount)} NEAR → <span className={styles.mono}>{payment.merchant}</span></strong>
              <span className={`${styles.muted} ${styles.mono}`}>{payment.quote_ref} · {new Date(payment.paid_at_ms).toLocaleString()} · {payment.quote_hash.slice(0, 12)}…</span>
            </div>
            <a className={styles.ghost} href={tx ? explorerTxUrl(tx) : explorerAccountUrl(CANOE_CONTRACT)} target="_blank" rel="noreferrer">
              {tx ? t('viewTx') : t('viewContract')}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
```

- [ ] **Step 8: Orchestrator.** `apps/web/src/components/canoe/TripBudget.tsx`:

```tsx
'use client';
import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { NearProvider, useNearWallet } from './NearProvider';
import { TripCreateForm } from './TripCreateForm';
import { OfferList } from './OfferList';
import { PaymentHistory } from './PaymentHistory';
import { CANOE_CONTRACT, CANOE_DEMO_SCALE_BPS, CANOE_MERCHANT } from '@/lib/canoe/config';
import { createTripCall, payQuoteArgs, remaining, type ContractPayment, type ContractTrip } from '@/lib/canoe/contract';
import { buildQuote, formatNear } from '@/lib/canoe/quote';
import { CATEGORIES, type Category, type Offer, type Rate } from '@/lib/canoe/types';
import styles from './TripBudget.module.css';

type OffersResponse = { ok: true; data: { offers: Offer[] } } | { ok: false; error: string };
const DAY_MS = 86_400_000;
const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

export function TripBudget() {
  return (
    <NearProvider>
      <TripBudgetInner />
    </NearProvider>
  );
}

function TripBudgetInner() {
  const t = useTranslations('Canoe');
  const { loading, signedAccountId, signIn, signOut, viewFunction, callFunction } = useNearWallet();
  const [trip, setTrip] = useState<ContractTrip | null>(null);
  const [payments, setPayments] = useState<ContractPayment[]>([]);
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [txByHash, setTxByHash] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chainVersion, setChainVersion] = useState(0);

  const loadChain = useCallback(async (account: string) => {
    if (!account) return { trip: null, payments: [] as ContractPayment[] };
    const trips = await viewFunction<ContractTrip[]>({ contractId: CANOE_CONTRACT, method: 'get_trips_by_owner', args: { owner: account } });
    const current = [...trips].reverse().find((x) => x.open) ?? trips.at(-1) ?? null;
    const list = current
      ? await viewFunction<ContractPayment[]>({ contractId: CANOE_CONTRACT, method: 'get_payments', args: { trip_id: current.id } })
      : [];
    return { trip: current, payments: list };
  }, [viewFunction]);

  useEffect(() => {
    let cancelled = false;
    loadChain(signedAccountId)
      .then((state) => { if (!cancelled) { setTrip(state.trip); setPayments(state.payments); } })
      .catch((e: unknown) => { if (!cancelled) setError(messageOf(e)); });
    return () => { cancelled = true; };
  }, [loadChain, signedAccountId, chainVersion]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/canoe/offers')
      .then((r) => r.json() as Promise<OffersResponse>)
      .then((body) => { if (!cancelled) { if (body.ok) setOffers(body.data.offers); else setError(body.error); } })
      .catch((e: unknown) => { if (!cancelled) setError(messageOf(e)); });
    return () => { cancelled = true; };
  }, []);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
      setChainVersion((v) => v + 1);
    }
  };

  const createTrip = (limits: Record<Category, string>, days: number) =>
    run(async () => {
      const call = createTripCall(limits, Date.now() + days * DAY_MS);
      await callFunction({ contractId: CANOE_CONTRACT, method: 'create_trip', args: call.args, deposit: call.deposit });
    });

  const pay = (offer: Offer, rate: Rate) =>
    run(async () => {
      if (!trip) throw new Error(t('noTrip'));
      const quote = await buildQuote(offer, rate, Date.now());
      const { hash } = await callFunction({ contractId: CANOE_CONTRACT, method: 'pay_quote', args: payQuoteArgs(trip.id, quote, CANOE_MERCHANT) });
      if (hash) setTxByHash((prev) => ({ ...prev, [quote.quoteHash]: hash }));
    });

  const withdraw = () =>
    run(async () => {
      if (!trip) return;
      await callFunction({ contractId: CANOE_CONTRACT, method: 'withdraw_remaining', args: { trip_id: trip.id } });
    });

  return (
    <div className={styles.root}>
      <p className={styles.banner}>{t('simulated')} {t('scale', { percent: CANOE_DEMO_SCALE_BPS / 100 })}</p>

      <div className={styles.walletBar}>
        {signedAccountId ? <span className={styles.mono}>{t('signedInAs', { account: signedAccountId })}</span> : <span className={styles.muted}>{t('connectFirst')}</span>}
        {signedAccountId
          ? <button className={styles.ghost} type="button" onClick={() => void signOut()}>{t('disconnect')}</button>
          : <button className={styles.button} type="button" disabled={loading} onClick={() => void signIn().catch((e: unknown) => setError(messageOf(e)))}>{loading ? t('loading') : t('connect')}</button>}
      </div>

      {error ? <p className={styles.error} role="alert">{t('error', { message: error })}</p> : null}
      {busy ? <p className={styles.muted} role="status">{t('working')}</p> : null}

      {signedAccountId && (!trip || !trip.open) ? (
        <section className={styles.card}>
          <h2>{t('createTitle')}</h2>
          <TripCreateForm disabled={busy} onCreate={createTrip} />
        </section>
      ) : null}

      {trip ? (
        <section className={styles.card}>
          <h2>{t('tripTitle', { id: trip.id })} {trip.open ? null : <span className={styles.badge}>{t('closed')}</span>}</h2>
          <span className={styles.muted}>{t('expires', { date: new Date(trip.expires_at_ms).toLocaleString() })}</span>
          <div className={styles.grid}>
            {CATEGORIES.map((category) => (
              <div key={category} className={styles.stat}>
                <strong>{t(category)}</strong>
                <span className={styles.muted}>{t('limit')}: {formatNear(trip.limits[category])} NEAR</span>
                <span className={styles.muted}>{t('spent')}: {formatNear(trip.spent[category])} NEAR</span>
                <span>{t('remaining')}: {formatNear(remaining(trip, category))} NEAR</span>
              </div>
            ))}
          </div>
          {trip.open ? <button className={styles.ghost} type="button" disabled={busy} onClick={() => void withdraw()}>{t('withdraw')}</button> : null}
        </section>
      ) : null}

      <section className={styles.card}>
        <h2>{t('offersTitle')}</h2>
        {offers === null ? <p className={styles.muted}>{t('loading')}</p> : <OfferList offers={offers} trip={trip} busy={busy || !signedAccountId} onPay={pay} />}
      </section>

      <section className={styles.card}>
        <h2>{t('paymentsTitle')}</h2>
        <PaymentHistory payments={payments} txByHash={txByHash} />
      </section>
    </div>
  );
}
```

- [ ] **Step 9: Page.** `apps/web/src/app/trip/page.tsx`:

```tsx
import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { isMultiUserEnabled } from '@/lib/multi-user';
import { getCurrentProfile } from '@/lib/user-auth';
import { TravelNav } from '@/components/hotels/TravelNav';
import { ThemeToggle } from '@/components/ThemeToggle';
import { TripBudget } from '@/components/canoe/TripBudget';
import styles from '@/components/hotels/Hotels.module.css';

export const dynamic = 'force-dynamic';

export default async function TripPage() {
  if (process.env.SELF_HOSTED !== 'true') notFound();
  if ((await isMultiUserEnabled()) && !(await getCurrentProfile())) redirect('/login?next=/trip');
  const t = await getTranslations('Canoe');
  return (
    <main className={styles.root}>
      <ThemeToggle />
      <TravelNav active="trip" />
      <header className={styles.hero}>
        <span className={styles.eyebrow}>{t('eyebrow')}</span>
        <h1>{t('headline')}</h1>
        <p className={styles.muted}>{t('intro')}</p>
      </header>
      <TripBudget />
    </main>
  );
}
```

- [ ] **Step 10: Typecheck, lint, test**

Run: `npm run typecheck --workspace=@flight-finder/web && npm run lint --workspace=@flight-finder/web && npm run test --workspace=@flight-finder/web`
Expected: all pass. Fix any lint findings (for example the React hooks rules) without changing the component interfaces.

- [ ] **Step 11: Manual browser check.** Export `CANOE_SAMPLE_OFFERS=true`, run `npm run dev`, and open `http://localhost:3003/trip`.
Expected:
- The nav shows "Trip Budget" as active.
- The banner shows both the simulated-booking text and the 1% scale.
- The three sample offers each show a rate line and an "Approve & pay … NEAR" button.
- "Connect NEAR wallet" opens the near-connect wallet picker.

- [ ] **Step 12: Commit**

```bash
git add apps/web/messages apps/web/src/i18n/request.ts apps/web/src/test/setup-intl.ts apps/web/src/components/hotels/TravelNav.tsx apps/web/src/components/canoe apps/web/src/app/trip
git commit -m "feat(canoe): add Trip Budget page with wallet approval and on-chain payments

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: End-to-end on testnet **[USER CONFIRM]**

**Files:**
- Modify: `docs/canoe/testnet-log.md`

**Interfaces:**
- Consumes: the deployed contract (Task 3) and the `/trip` page (Task 9)
- Produces: recorded tx hashes for the README

- [ ] **Step 1: Connect the wallet.** On `/trip`, connect `canoe-user1.testnet`. The user imports the account into a supported wallet (for example Meteor or HOT) themselves.
- [ ] **Step 2: Create a budget.** Use flight 1, hotel 1, car 0.5 and 30 days → sign → the Trip card shows 2.5 NEAR in limits and 0 spent. **[USER CONFIRM]**
- [ ] **Step 3: Pay the flight.** Pay the sample flight offer, about 0.375 NEAR at 40,000 IDR per NEAR with the 1% scale → sign → Payments lists the flight with "View transaction". The explorer shows a transfer from `budget.canoe-dev.testnet` to `canoe-dev.testnet`. **[USER CONFIRM]**
- [ ] **Step 4: Show a rejection.** Create a second budget on another account (or set the hotel limit to 0.01). Paying the hotel offer must show the contract error `Over category limit: hotel`, and spent stays the same. **[USER CONFIRM]**
- [ ] **Step 5: Withdraw.** Withdraw the remaining NEAR → the trip shows "Closed" and the refund appears in the wallet. **[USER CONFIRM]**
- [ ] **Step 6: Log and commit.** Write each tx hash, with a one-line description, into `docs/canoe/testnet-log.md`, then:

```bash
git add docs/canoe/testnet-log.md
git commit -m "docs: record CANOE end-to-end testnet transactions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: README for judges, license, tag

**Files:**
- Modify: `README.md` (insert a CANOE section at the very top, above the upstream `<div align="center">`)
- Modify: `LICENSE` (append a copyright line)

**Interfaces:**
- Consumes: tx hashes from `docs/canoe/testnet-log.md`, and the contract and page names from earlier tasks
- Produces: the submission-ready repository state, tagged `hackathon-submission`

- [ ] **Step 1: Write the README section.** Insert at line 1 of `README.md`. Fill `<TX_*>` from `docs/canoe/testnet-log.md` and `<OWNER>/<REPO>` from the user's GitHub repository. Ask the user for both. Do not invent them.

````markdown
# CANOE — trip budgets with on-chain payment approval (NEAR HACKATHON 2026)

CANOE is built at NEAR HACKATHON (tracks: `realworld`, `open`). It is a fork of
[affromero/flight-finder](https://github.com/affromero/flight-finder) (MIT), which tracks
flight, hotel and car rental prices separately. CANOE adds what flight-finder explicitly does
not have: **one combined trip budget**, held by a NEAR contract, that pays for tracked offers
only when the traveller approves each payment from their own wallet.

**Problem:** travel prices are watched in one tool and paid somewhere else. Nothing enforces
the trip budget. CANOE locks the budget per category (flight / hotel / car). Every payment is a
wallet-signed `pay_quote` that the contract checks against owner, expiry, duplicate quote and
remaining category limit before it transfers NEAR to the merchant.

**What is real and what is simulated:** the NEAR transfer to the merchant account is real on
testnet. Booking with the airline, hotel or rental company is simulated. Quotes are scaled to 1%
of the real price (shown in the UI and part of the quote hash) so they fit testnet balances.

## Try it (do X → see Y)

Requirements: Docker, Node 22, a NEAR testnet wallet (for example Meteor or HOT) with a few testnet NEAR.

1. `git clone https://github.com/<OWNER>/<REPO> && cd <REPO>` → you see the flight-finder monorepo plus `contracts/canoe-budget`.
2. `cp .env.example .env`, set `POSTGRES_PASSWORD`, `ADMIN_SESSION_SECRET`, `CRON_SECRET` (any random values) and add `CANOE_SAMPLE_OFFERS=true`. Run `docker compose up -d --build` → `curl -s localhost:3003/api/health` returns `"ok":true`.
3. Open `http://localhost:3003`, finish setup (admin password; optionally pick an AI provider/model and paste your own API key for flight search) → you land on the flight search page.
4. Click **Trip Budget** in the top navigation → you see the banner "Booking … is simulated. The NEAR transfer … is real on testnet" and three offers labelled `sample`.
5. Click **Connect NEAR wallet** and pick your testnet wallet → the bar shows `Wallet: <your-account>.testnet`.
6. Keep the default limits (flight 1, hotel 1, car 0.5) and click **Lock 2.5 NEAR**, then approve in the wallet → a "Trip #N" card shows each category's limit, spent 0 and remaining.
7. Click **Approve & pay** on the flight offer and approve in the wallet → Payments lists a flight payment to `canoe-dev.testnet`, and **View transaction** opens the explorer with the transfer.
8. Set a tiny hotel limit on a new trip and pay the hotel offer → the page shows `Over category limit: hotel` and nothing is spent.
9. Click **Withdraw remaining NEAR** → the trip shows **Closed** and the unspent NEAR returns to your wallet.

Contract only (no UI): `bash contracts/canoe-budget/scripts/test.sh` → `test result: ok. 16 passed`.

## On-chain

- Contract: `budget.canoe-dev.testnet` ([explorer](https://testnet.nearblocks.io/address/budget.canoe-dev.testnet)), source `contracts/canoe-budget/src/lib.rs`
- Methods: `create_trip` (payable), `pay_quote`, `withdraw_remaining`, views `get_trip`, `get_trips_by_owner`, `get_payments`. Events: NEP-297 `standard: "canoe"`.
- Recorded testnet transactions: create trip `<TX_CREATE>`, payment `<TX_PAY>`, rejected over-limit `<TX_REJECT>`, withdraw `<TX_WITHDRAW>` (details in `docs/canoe/testnet-log.md`).

## What was built during the hackathon

Baseline: tag `pre-hackathon` (upstream flight-finder `266d798`). Submission: tag `hackathon-submission`.
Full diff: `https://github.com/<OWNER>/<REPO>/compare/pre-hackathon...hackathon-submission`

- `contracts/canoe-budget/`: Rust contract with 16 unit tests
- `apps/web/src/lib/canoe/`: quote and hash, contract args, offer normalization, NEAR rate (tested)
- `apps/web/src/app/api/canoe/{offers,rate}`: API routes
- `apps/web/src/components/canoe/`, `apps/web/src/app/trip/`: Trip Budget page and wallet integration
- `docs/superpowers/`: design spec and implementation plan

## Libraries and prior work

flight-finder (MIT, upstream baseline), near-sdk 5.29 (Rust), cargo-near (Docker image
`sourcescan/cargo-near`), near-api-js 7.3.1, @hot-labs/near-connect 0.11.4, CoinGecko simple
price API for the NEAR rate. AI providers are the upstream bring-your-own-key options (Anthropic,
OpenAI, Gemini, local models). CANOE adds no AI calls.

## Limits

Testnet only. A `pay_quote` to a merchant account that does not exist would record the payment
while the transfer refunds to the contract. The demo uses the existing `canoe-dev.testnet`. No
stablecoins, NEAR Intents or meta transactions yet.

---
````

- [ ] **Step 2: Add the license line.** Append to `LICENSE`:

```text

CANOE additions (contracts/canoe-budget, apps/web/src/lib/canoe, apps/web/src/components/canoe,
apps/web/src/app/api/canoe, apps/web/src/app/trip) Copyright (c) 2026 CANOE contributors, released under the same MIT License.
```

- [ ] **Step 3: Run the full checks**

Run: `npm run lint --workspace=@flight-finder/web && npm run typecheck --workspace=@flight-finder/web && npm run test --workspace=@flight-finder/web && bash contracts/canoe-budget/scripts/test.sh`
Expected: all pass.
Run: `git log -p pre-hackathon..HEAD | grep -nE "ed25519:[1-9A-HJ-NP-Za-km-z]{40,}|PRIVATE KEY|sk-ant-|sk-[A-Za-z0-9]{20,}" || echo "no secrets found"`
Expected: `no secrets found`

- [ ] **Step 4: Commit and tag**

```bash
git add README.md LICENSE
git commit -m "docs: add CANOE judge README section and license notice

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git tag hackathon-submission
```

- [ ] **Step 5: Publish [USER CONFIRM].** The user creates a public GitHub repo. After a yes in chat, run `git remote add origin <url> && git push -u origin canoe-near --tags`. The user then sets `canoe-near` as the default branch, records the demo video, posts on X (@NEARProtocol, #NEARHackathon, "built at NEAR HACKATHON"), and gives Claude the post link. Claude prints the submission JSON (fields from HACKATHON.md "What the human decides") and sends it only after an explicit yes, before **2026-11-14T23:59Z**.
