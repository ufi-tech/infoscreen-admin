#!/bin/bash
set -e

ACTION=${1:-start}

if [ "$ACTION" = "start" ]; then
    sudo systemctl start shellinabox
    echo "started"
    exit 0
fi

if [ "$ACTION" = "stop" ]; then
    sudo systemctl stop shellinabox
    echo "stopped"
    exit 0
fi

echo "usage: web-ssh.sh start|stop" >&2
exit 1
