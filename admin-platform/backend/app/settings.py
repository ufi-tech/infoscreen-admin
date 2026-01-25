import os

MQTT_BROKER_HOST = os.getenv("MQTT_BROKER_HOST", "host.docker.internal")
MQTT_BROKER_PORT = int(os.getenv("MQTT_BROKER_PORT", "1883"))
MQTT_USERNAME = os.getenv("MQTT_USERNAME", "")
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD", "")
MQTT_CLIENT_ID = os.getenv("MQTT_CLIENT_ID", "admin-platform")

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:////data/app.db")

API_TOKEN = os.getenv("API_TOKEN", "")
