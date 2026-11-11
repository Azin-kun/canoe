#!/usr/bin/env bash
# Runs the contract unit tests inside the cargo-near image (no local Rust needed).
set -euo pipefail
cd "$(dirname "$0")/.."
HOST_DIR="$(pwd -W 2>/dev/null || pwd)"
MSYS_NO_PATHCONV=1 docker run --rm -v "${HOST_DIR}:/host" -w /host \
  sourcescan/cargo-near:0.22.0-rust-1.97.1 cargo test -- --nocapture
