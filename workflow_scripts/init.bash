#!/usr/bin/env bash
set -euo pipefail

# --- 1.  locate this script’s directory -------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# --- 2.  resolve the repo root (one level above SCRIPT_DIR) ------------
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"      # absolute path to repo

# --- 3.  source static env ------------------------------------------------
ENV_STATIC="$REPO_ROOT/.env.static"
[[ -f $ENV_STATIC ]] || { echo "Missing $ENV_STATIC"; exit 1; }
source "$ENV_STATIC"
# --- 4.  build the new .env file ----------------------------------------
ENV_PRE="$REPO_ROOT/.env.pre"
ENV_FINAL="$REPO_ROOT/.env"

echo "\n# @setting root (build)" >> "$ENV_PRE"
echo "ROOT_FS_ABS=$REPO_ROOT/" >> "$ENV_PRE"
cat "$ENV_STATIC" > "$ENV_PRE"

if [[ "${WSL_PROXY:-}" == "TRUE" ]]; then
  echo "WSL proxy is enabled."
  source "$SCRIPT_DIR/set_wsl_proxy_vars.sh"
fi


# --- 6.  atomically publish the final file ------------------------------
mv "$ENV_PRE" "$ENV_FINAL"

echo "Init.bash succeed."