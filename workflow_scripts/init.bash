#!/bin/bash
source ../.env.static

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Run set execute permissions for all workflow_scripts

# initialize env file writing
cat ../.env.static > ../.env.pre

source "$SCRIPT_DIR/set_execute_perms.sh"

source "$SCRIPT_DIR/set_wsl_proxy_vars.sh"

# finilize the env file
cp ../.env.pre ../.env

bun run build