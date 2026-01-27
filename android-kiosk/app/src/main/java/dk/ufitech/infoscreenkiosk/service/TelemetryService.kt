package dk.ufitech.infoscreenkiosk.service

import android.app.*
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.wifi.WifiManager
import android.os.*
import androidx.core.app.NotificationCompat
import dagger.hilt.android.AndroidEntryPoint
import dk.ufitech.infoscreenkiosk.InfoscreenApp
import dk.ufitech.infoscreenkiosk.R
import dk.ufitech.infoscreenkiosk.data.DeviceIdentity
import dk.ufitech.infoscreenkiosk.data.MqttClientManager
import dk.ufitech.infoscreenkiosk.data.NetworkUtils
import dk.ufitech.infoscreenkiosk.data.SecureStorage
import dk.ufitech.infoscreenkiosk.data.model.TelemetryData
import dk.ufitech.infoscreenkiosk.ui.KioskActivity
import kotlinx.coroutines.*
import javax.inject.Inject

/**
 * Foreground service that collects and publishes telemetry data every 30 seconds.
 * Runs as a foreground service to ensure it stays alive.
 */
@AndroidEntryPoint
class TelemetryService : Service() {

    @Inject lateinit var mqttClientManager: MqttClientManager
    @Inject lateinit var secureStorage: SecureStorage
    @Inject lateinit var deviceIdentity: DeviceIdentity

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var telemetryJob: Job? = null

    override fun onCreate() {
        super.onCreate()
        startForeground(InfoscreenApp.NOTIFICATION_ID, createNotification())
        startTelemetryCollection()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        return START_STICKY // Restart if killed
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        super.onDestroy()
        telemetryJob?.cancel()
        scope.cancel()
    }

    private fun startTelemetryCollection() {
        telemetryJob = scope.launch {
            while (isActive) {
                try {
                    collectAndPublishTelemetry()
                } catch (e: Exception) {
                    android.util.Log.e(TAG, "Telemetry error: ${e.message}")
                }
                delay(TELEMETRY_INTERVAL_MS)
            }
        }
    }

    private fun collectAndPublishTelemetry() {
        val telemetry = TelemetryData(
            ts = System.currentTimeMillis(),
            batteryPct = getBatteryLevel(),
            batteryCharging = isBatteryCharging(),
            batteryTemp = getBatteryTemperature(),
            memTotalKb = getTotalMemory(),
            memAvailableKb = getAvailableMemory(),
            diskTotalMb = getTotalStorage(),
            diskFreeMb = getFreeStorage(),
            uptimeSeconds = getUptimeSeconds(),
            wifiSsid = getWifiSsid(),
            wifiRssi = getWifiRssi(),
            screenOn = isScreenOn(),
            currentUrl = secureStorage.currentUrl,
            ip = NetworkUtils.getLocalIpAddress()
        )

        mqttClientManager.publishTelemetry(telemetry)
    }

    private fun getBatteryLevel(): Int? {
        val batteryIntent = registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        return batteryIntent?.let { intent ->
            val level = intent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
            val scale = intent.getIntExtra(BatteryManager.EXTRA_SCALE, -1)
            if (level >= 0 && scale > 0) (level * 100 / scale) else null
        }
    }

    private fun isBatteryCharging(): Boolean {
        val batteryIntent = registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        return batteryIntent?.let { intent ->
            val status = intent.getIntExtra(BatteryManager.EXTRA_STATUS, -1)
            status == BatteryManager.BATTERY_STATUS_CHARGING ||
                    status == BatteryManager.BATTERY_STATUS_FULL
        } ?: false
    }

    private fun getBatteryTemperature(): Float? {
        val batteryIntent = registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        return batteryIntent?.let { intent ->
            val temp = intent.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, -1)
            if (temp > 0) temp / 10f else null
        }
    }

    private fun getTotalMemory(): Long {
        val memInfo = ActivityManager.MemoryInfo()
        val activityManager = getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        activityManager.getMemoryInfo(memInfo)
        return memInfo.totalMem / 1024 // KB
    }

    private fun getAvailableMemory(): Long {
        val memInfo = ActivityManager.MemoryInfo()
        val activityManager = getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        activityManager.getMemoryInfo(memInfo)
        return memInfo.availMem / 1024 // KB
    }

    private fun getTotalStorage(): Long {
        val stat = StatFs(Environment.getDataDirectory().path)
        return stat.totalBytes / (1024 * 1024) // MB
    }

    private fun getFreeStorage(): Long {
        val stat = StatFs(Environment.getDataDirectory().path)
        return stat.availableBytes / (1024 * 1024) // MB
    }

    private fun getUptimeSeconds(): Long {
        return SystemClock.elapsedRealtime() / 1000
    }

    @Suppress("DEPRECATION")
    private fun getWifiSsid(): String? {
        return try {
            val wifiManager = applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
            wifiManager.connectionInfo?.ssid?.removeSurrounding("\"")?.takeIf {
                it != "<unknown ssid>"
            }
        } catch (e: Exception) {
            null
        }
    }

    private fun getWifiRssi(): Int? {
        return try {
            val wifiManager = applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
            wifiManager.connectionInfo?.rssi?.takeIf { it != 0 }
        } catch (e: Exception) {
            null
        }
    }

    private fun isScreenOn(): Boolean {
        val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
        return powerManager.isInteractive
    }

    private fun createNotification(): Notification {
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            Intent(this, KioskActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, InfoscreenApp.NOTIFICATION_CHANNEL_ID)
            .setContentTitle(getString(R.string.notification_title))
            .setContentText(getString(R.string.notification_text))
            .setSmallIcon(android.R.drawable.ic_menu_info_details)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    companion object {
        private const val TAG = "TelemetryService"
        private const val TELEMETRY_INTERVAL_MS = 30_000L // 30 seconds
    }
}
