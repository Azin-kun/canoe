#!/usr/bin/env bash
# Builds target/near/canoe_budget.wasm inside the cargo-near image.
set -euo pipefail
cd "$(dirname "$0")/.."
HOST_DIR="$(pwd -W 2>/dev/null || pwd)"
MSYS_NO_PATHCONV=1 docker run --rm -v "${HOST_DIR}:/host" -w /host \
  sourcescan/cargo-near:0.22.0-rust-1.97.1 cargo near build non-reproducible-wasm
ls -la target/near/canoe_budget.wasm
