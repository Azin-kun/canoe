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

## End-to-end demo through the web UI (2026-11-12)

Local app at `http://localhost:3003/trip`, wallet `canoe-user1.testnet` connected through NEAR Connector's
"NEAR CLI" option: the page shows the exact `near contract call-function ...` command for every action,
the command is signed with near-cli-rs, and the transaction hash is pasted back into the dialog.
Quotes use the live CoinGecko rate (1 NEAR = 64,652 IDR at the time) at the 1% demo scale.

| Step | Transaction | Result |
|------|-------------|--------|
| Withdraw the CLI smoke-test trip #0 | [`4YVpAyP85gghKQiS15dRtpEEejpfRKRGTnWfbrfun31C`](https://testnet.nearblocks.io/txns/4YVpAyP85gghKQiS15dRtpEEejpfRKRGTnWfbrfun31C) | `trip_closed`, 0.2 NEAR refunded; UI shows **Trip #0 CLOSED** |
| Create trip #1: flight 1 / hotel 1 / car 0.1 NEAR, 30 days ("Lock 2.1 NEAR") | [`3F1R7kkgS2jiBLvZWV1j5wvvWUsHcuvUTfXZ9ZTGRpi2`](https://testnet.nearblocks.io/txns/3F1R7kkgS2jiBLvZWV1j5wvvWUsHcuvUTfXZ9ZTGRpi2) | `trip_created`, trip id 1, total 2.1 NEAR |
| Approve & pay sample flight CGK→DPS (IDR 1,500,000 → 0.232 NEAR) | [`8CUccXThwA54f2C7saySLSSDCYieeL5RDzfWki8h1Cqf`](https://testnet.nearblocks.io/txns/8CUccXThwA54f2C7saySLSSDCYieeL5RDzfWki8h1Cqf) | `payment` event, 0.232 NEAR transferred to `canoe-dev.testnet`; quote hash `fac348f3…5af82`, ref `flight:sample-flight-cgk-dps` |
| Approve & pay sample car (IDR 750,000 → 0.116 NEAR) against a 0.1 NEAR car limit | [`6HaHDn2vvZWhD4Pu2FkT3WsZ3Jt3kpr8QMq8RMMqUzem`](https://testnet.nearblocks.io/txns/6HaHDn2vvZWhD4Pu2FkT3WsZ3Jt3kpr8QMq8RMMqUzem) | **rejected on-chain**: `Smart contract panicked: Over category limit: car`; car spent stays 0 |
| Withdraw remaining NEAR from trip #1 | [`7RvhwDhGaymZcJGTHajz8eGwbWRx7RXhy5RCKktLBsdM`](https://testnet.nearblocks.io/txns/7RvhwDhGaymZcJGTHajz8eGwbWRx7RXhy5RCKktLBsdM) | `trip_closed`, 1.867988… NEAR refunded (2.1 − 0.232) |

Found during this run and fixed afterwards: the page did not show an error for the rejected payment (wallets
resolve with a failed outcome instead of throwing), and offers stayed payable after the trip was closed.
