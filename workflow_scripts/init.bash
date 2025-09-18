#!/usr/bin/env bash
set -euo pipefail

# --- 1.  locate this script’s directory -------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# --- 2.  resolve the repo root (one level above SCRIPT_DIR) ------------
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"      # absolute path to repo

# --- 3.  source static env ------------------------------------------------
ENV_STATIC="$REPO_ROOT/.env.static"
[[ -f $ENV_STATIC ]] || { echo "Missing $ENV_STATIC"; exit 1; }

# --- 4.  build the new .env file ----------------------------------------
ENV_PRE="$REPO_ROOT/.env.pre"
ENV_FINAL="$REPO_ROOT/.env"

cat "$ENV_STATIC" > "$ENV_PRE"

# --- 5.  add WSL proxy variables ----------------------------------------
# (the helper script is kept next to this one)
source "$SCRIPT_DIR/set_wsl_proxy_vars.sh"

# --- 6.  atomically publish the final file ------------------------------
mv "$ENV_PRE" "$ENV_FINAL"

echo "Initialized .env file from .env.static and set WSL proxy variables"