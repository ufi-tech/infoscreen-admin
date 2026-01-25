#!/bin/bash
set -e

ACTION=${1:-}
NAME=${2:-default}
HOST=${3:-}
USER=${4:-}
REMOTE_PORT=${5:-}
LOCAL_PORT=${6:-22}
ARG7=${7:-}
ARG8=${8:-}

PIDFILE="/home/pi/.cache/ssh-tunnel-${NAME}.pid"
LOGFILE="/home/pi/.cache/ssh-tunnel-${NAME}.log"
mkdir -p /home/pi/.cache

PORT="2222"
KEY=""

if [ -n "$HOST" ] && [[ "$HOST" == *:* ]]; then
    HOST_PART="${HOST%:*}"
    PORT_PART="${HOST##*:}"
    if [[ "$PORT_PART" =~ ^[0-9]+$ ]]; then
        HOST="$HOST_PART"
        PORT="$PORT_PART"
    fi
fi

if [ -n "$ARG7" ]; then
    if [[ "$ARG7" =~ ^[0-9]+$ ]]; then
        PORT="$ARG7"
        KEY="$ARG8"
    else
        KEY="$ARG7"
        if [ -n "$ARG8" ]; then
            PORT="$ARG8"
        fi
    fi
fi

if [ "$ACTION" = "start" ]; then
    if [ -z "$HOST" ] || [ -z "$USER" ] || [ -z "$REMOTE_PORT" ]; then
        echo "missing host/user/remote_port" >&2
        exit 1
    fi
    if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
        echo "already running"
        exit 0
    fi

    if command -v autossh >/dev/null 2>&1; then
        CMD=(autossh -M 0 -N)
    else
        CMD=(ssh -N)
    fi

    CMD+=(
        -p "$PORT"
        -o ServerAliveInterval=30
        -o ServerAliveCountMax=3
        -o ExitOnForwardFailure=yes
        -o StrictHostKeyChecking=no
        -o UserKnownHostsFile=/dev/null
    )

    if [ -n "$KEY" ]; then
        CMD+=( -i "$KEY" )
    fi

    CMD+=( -R "0.0.0.0:${REMOTE_PORT}:localhost:${LOCAL_PORT}" "${USER}@${HOST}" )

    nohup "${CMD[@]}" > "$LOGFILE" 2>&1 &
    echo $! > "$PIDFILE"
    echo "started"
    exit 0
fi

if [ "$ACTION" = "stop" ]; then
    if [ -f "$PIDFILE" ]; then
        kill "$(cat "$PIDFILE")" 2>/dev/null || true
        rm -f "$PIDFILE"
        echo "stopped"
        exit 0
    fi
    echo "not running"
    exit 0
fi

echo "usage: ssh-tunnel.sh start|stop name host user remote_port [local_port] [key] [port]" >&2
exit 1
