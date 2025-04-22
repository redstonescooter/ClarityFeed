#!/bin/bash

# Set your proxy ports here
httpPORT=10811
socksPORT=10810

# Get Windows host IP from /etc/resolv.conf
WINDOWS_IP=$(ip route | grep default | awk '{print $3}')

# Proxy lines to add or check
HTTP_LINE="http://$WINDOWS_IP:$httpPORT"
HTTPS_LINE="http://$WINDOWS_IP:$httpPORT"
SOCKS_LINE="socks5://$WINDOWS_IP:$socksPORT"


echo "WSL_PROXY_HTTP=$HTTP_LINE" >> "../.env.pre"
echo "WSL_PROXY_HTTPS=$HTTPS_LINE" >> "../.env.pre"
echo "WSL_PROXY_SOCKS=$SOCKS_LINE" >> "../.env.pre"

# Print proxy settings for verification
echo "Proxy settings:"
echo "HTTP: $HTTP_LINE"
echo "HTTPS: $HTTPS_LINE"
echo "SOCKS: $SOCKS_LINE"
