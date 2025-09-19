
# Set your proxy ports here
# already set in .env.static
: ${WSL_HTTP_PORT:=7890} #10811
: ${WSL_SOCKS_PORT:=7891} #10810

# Get Windows host IP from /etc/resolv.conf
WINDOWS_IP=$(ip route | grep default | awk '{print $3}')

# Proxy lines to add or check
HTTP_LINE="http://$WINDOWS_IP:$WSL_HTTP_PORT"
HTTPS_LINE="http://$WINDOWS_IP:$WSL_HTTP_PORT"
SOCKS_LINE="socks5://$WINDOWS_IP:$WSL_SOCKS_PORT"

echo "# @WSL proxy variables (build)" >> "$REPO_ROOT/.env.pre"
echo "WSL_PROXY_HTTP=$HTTP_LINE" >> "$REPO_ROOT/.env.pre"
echo "WSL_PROXY_HTTPS=$HTTPS_LINE" >> "$REPO_ROOT/.env.pre"
echo "WSL_PROXY_SOCKS=$SOCKS_LINE" >> "$REPO_ROOT/.env.pre"

# Print proxy settings for verification
echo "Proxy settings:"
echo "HTTP: $HTTP_LINE"
echo "HTTPS: $HTTPS_LINE"
echo "SOCKS: $SOCKS_LINE"
