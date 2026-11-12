# CANOE testnet log

Network: NEAR testnet. Explorer: https://testnet.nearblocks.io

## Deployment (2026-11-12)

| Step | Account | Transaction |
|------|---------|-------------|
| Create contract account `budget.canoe-dev.testnet` (3 NEAR from `canoe-dev.testnet`) | canoe-dev.testnet | [`5AjhxPCfXkagXZnEoJ28fMi8LChN4oLFo17tj3uMUMC3`](https://testnet.nearblocks.io/txns/5AjhxPCfXkagXZnEoJ28fMi8LChN4oLFo17tj3uMUMC3) |
| Deploy `canoe_budget.wasm` (no init call; state starts from `impl Default for Contract`) | budget.canoe-dev.testnet | [`Ej3JPbssE3iPcppEJR7agzhGbqdrpPZEGL7v8qfffWKL`](https://testnet.nearblocks.io/txns/Ej3JPbssE3iPcppEJR7agzhGbqdrpPZEGL7v8qfffWKL) |

Deployed wasm: `contracts/canoe-budget/target/near/canoe_budget.wasm`, 161804 bytes,
sha256 `1beab5059ab2f0285006eee4e398f35dbfff7db62ccac737f0be6e769412a426`
(built with `sourcescan/cargo-near:0.22.0-rust-1.97.1` via `contracts/canoe-budget/scripts/build.sh`).

## Smoke test (CLI, 2026-11-12)

| Step | Signer | Transaction | Result |
|------|--------|-------------|--------|
| `create_trip` flight 0.1 / hotel 0.1 / car 0, deposit 0.2 NEAR, expiry +7 days | canoe-user1.testnet | [`2y34tVfGkp3LhKnNUV3MRk4ELKH9Qq9x8vzsD18mekne`](https://testnet.nearblocks.io/txns/2y34tVfGkp3LhKnNUV3MRk4ELKH9Qq9x8vzsD18mekne) | returned trip id `0`; event `{"standard":"canoe","event":"trip_created","data":[{"trip_id":0,"owner":"canoe-user1.testnet","total":"200000000000000000000000"}]}` |
| `get_trips_by_owner {"owner":"canoe-user1.testnet"}` (view) | — | — | one trip, id 0, `open: true`, spent all `0` |

## End-to-end demo through the web UI

To be filled in during Task 10: create trip, pay quote, rejected over-limit payment, withdraw.
