import os

MQTT_BROKER_HOST = os.getenv("MQTT_BROKER_HOST", "host.docker.internal")
MQTT_BROKER_PORT = int(os.getenv("MQTT_BROKER_PORT", "1883"))
MQTT_USERNAME = os.getenv("MQTT_USERNAME", "")
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD", "")
MQTT_CLIENT_ID = os.getenv("MQTT_CLIENT_ID", "admin-platform")

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:////data/app.db")

API_TOKEN = os.getenv("API_TOKEN", "")

LEGACY_DB_HOST = os.getenv("LEGACY_DB_HOST", "")
LEGACY_DB_PORT = int(os.getenv("LEGACY_DB_PORT", "3306"))
LEGACY_DB_NAME = os.getenv("LEGACY_DB_NAME", "")
LEGACY_DB_USER = os.getenv("LEGACY_DB_USER", "")
LEGACY_DB_PASSWORD = os.getenv("LEGACY_DB_PASSWORD", "")

TUNNEL_PORT_MIN = int(os.getenv("TUNNEL_PORT_MIN", "22000"))
TUNNEL_PORT_MAX = int(os.getenv("TUNNEL_PORT_MAX", "22100"))
TUNNEL_DEFAULT_PORT = int(os.getenv("TUNNEL_DEFAULT_PORT", "2222"))
TUNNEL_DEFAULT_HOST = os.getenv("TUNNEL_DEFAULT_HOST", "")
TUNNEL_DEFAULT_USER = os.getenv("TUNNEL_DEFAULT_USER", "")
TUNNEL_DEFAULT_KEY_PATH = os.getenv("TUNNEL_DEFAULT_KEY_PATH", "")
