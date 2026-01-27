package dk.ufitech.infoscreenkiosk.data.model

import com.google.gson.annotations.SerializedName

/**
 * Device status published to MQTT.
 * Topic: devices/{id}/status or devices/pending/{id}/status
 */
data class DeviceStatus(
    val status: String = "online",
    val approved: Boolean = false,
    val ip: String = "",
    val mac: String = "",
    val url: String = "",
    val model: String = "",
    @SerializedName("android_version")
    val androidVersion: String = "",
    val ts: Long = System.currentTimeMillis()
)

/**
 * Telemetry data published periodically.
 * Topic: devices/{id}/telemetry
 */
data class TelemetryData(
    val ts: Long = System.currentTimeMillis(),
    @SerializedName("battery_pct")
    val batteryPct: Int? = null,
    @SerializedName("battery_charging")
    val batteryCharging: Boolean = false,
    @SerializedName("battery_temp")
    val batteryTemp: Float? = null,
    @SerializedName("mem_total_kb")
    val memTotalKb: Long = 0,
    @SerializedName("mem_available_kb")
    val memAvailableKb: Long = 0,
    @SerializedName("disk_total_mb")
    val diskTotalMb: Long = 0,
    @SerializedName("disk_free_mb")
    val diskFreeMb: Long = 0,
    @SerializedName("uptime_seconds")
    val uptimeSeconds: Long = 0,
    @SerializedName("wifi_ssid")
    val wifiSsid: String? = null,
    @SerializedName("wifi_rssi")
    val wifiRssi: Int? = null,
    @SerializedName("screen_on")
    val screenOn: Boolean = true,
    @SerializedName("current_url")
    val currentUrl: String? = null,
    val ip: String? = null
)

/**
 * Event/log entry published to MQTT.
 * Topic: devices/{id}/events
 */
data class EventData(
    val ts: Long = System.currentTimeMillis(),
    val type: String,
    val message: String,
    val data: Map<String, Any>? = null
)

/**
 * Screenshot response.
 * Topic: devices/{id}/screenshot
 */
data class ScreenshotResponse(
    val ts: Long = System.currentTimeMillis(),
    val type: String = "screenshot",
    val base64: String,
    val bytes: Int,
    val width: Int,
    val height: Int
)

/**
 * WiFi scan response.
 * Topic: devices/{id}/wifi-scan
 */
data class WifiScanResponse(
    val ts: Long = System.currentTimeMillis(),
    val type: String = "wifi-scan",
    val networks: List<WifiNetwork>
)

data class WifiNetwork(
    val ssid: String,
    val bssid: String,
    val signal: Int, // RSSI in dBm
    val frequency: Int, // MHz
    val security: String
)

/**
 * System info response.
 * Topic: devices/{id}/events (type: "info")
 */
data class SystemInfo(
    val ts: Long = System.currentTimeMillis(),
    val type: String = "info",
    @SerializedName("device_id")
    val deviceId: String,
    val hostname: String,
    val model: String,
    @SerializedName("android_version")
    val androidVersion: String,
    @SerializedName("app_version")
    val appVersion: String,
    val ip: String,
    val mac: String,
    @SerializedName("uptime_seconds")
    val uptimeSeconds: Long,
    @SerializedName("battery_pct")
    val batteryPct: Int?,
    @SerializedName("current_url")
    val currentUrl: String
)

/**
 * Command received from MQTT.
 * Topic: devices/{id}/cmd/{action}
 */
data class CommandPayload(
    val url: String? = null,       // for set-url
    val mode: String? = null       // for screenshot (base64/file)
)

/**
 * Geolocation response.
 * Topic: devices/{id}/geolocation
 */
data class GeolocationResponse(
    val ts: Long = System.currentTimeMillis(),
    val lat: Double?,
    val lon: Double?,
    val accuracy: Float?,
    val provider: String?
)
