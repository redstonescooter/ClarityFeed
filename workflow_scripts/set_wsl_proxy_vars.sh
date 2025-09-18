#!/usr/bin/env bash
set -euo pipefail

# --- 1.  locate this script’s directory -------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# --- 2.  resolve the repo root (one level above SCRIPT_DIR) ------------
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"      # absolute path to repo


# Set your proxy ports here
httpPORT=10811
socksPORT=10810

# Get Windows host IP from /etc/resolv.conf
WINDOWS_IP=$(ip route | grep default | awk '{print $3}')

# Proxy lines to add or check
HTTP_LINE="http://$WINDOWS_IP:$httpPORT"
HTTPS_LINE="http://$WINDOWS_IP:$httpPORT"
SOCKS_LINE="socks5://$WINDOWS_IP:$socksPORT"


echo "WSL_PROXY_HTTP=$HTTP_LINE" >> "$REPO_ROOT/.env.pre"
echo "WSL_PROXY_HTTPS=$HTTPS_LINE" >> "$REPO_ROOT/.env.pre"
echo "WSL_PROXY_SOCKS=$SOCKS_LINE" >> "$REPO_ROOT/.env.pre"

# Print proxy settings for verification
echo "Proxy settings:"
echo "HTTP: $HTTP_LINE"
echo "HTTPS: $HTTPS_LINE"
echo "SOCKS: $SOCKS_LINE"
