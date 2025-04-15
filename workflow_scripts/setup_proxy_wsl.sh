#!/bin/bash

# Set your proxy ports here
httpPORT=10811
socksPORT=10810

# Get Windows host IP from /etc/resolv.conf
WINDOWS_IP=$(ip route | grep default | awk '{print $3}')

# Proxy lines to add or check
HTTP_LINE="export http_proxy=\"http://$WINDOWS_IP:$httpPORT\""
HTTPS_LINE="export https_proxy=\"http://$WINDOWS_IP:$httpPORT\""
SOCKS_LINE="export all_proxy=\"socks5://$WINDOWS_IP:$socksPORT\""
