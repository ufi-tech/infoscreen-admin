package dk.ufitech.infoscreenkiosk.data

import android.annotation.SuppressLint
import android.content.Context
import android.net.wifi.WifiManager
import android.os.Build
import android.provider.Settings
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.File
import java.net.NetworkInterface
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Manages device identity (UUID and MAC address).
 * Device ID is generated once and persisted for the lifetime of the app installation.
 */
@Singleton
class DeviceIdentity @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private var cachedDeviceId: String? = null
    private var cachedMacAddress: String? = null

    /**
     * Get the unique device ID.
     * Generated from Android ID + app-specific UUID for uniqueness.
     */
    fun getDeviceId(): String {
        cachedDeviceId?.let { return it }

        val deviceIdFile = File(context.filesDir, DEVICE_ID_FILE)

        // Read existing device ID if available
        if (deviceIdFile.exists()) {
            val storedId = deviceIdFile.readText().trim()
            if (storedId.isNotBlank()) {
                cachedDeviceId = storedId
                return storedId
            }
        }

        // Generate new device ID
        val androidId = getAndroidId()
        val newDeviceId = UUID.nameUUIDFromBytes(
            "$androidId-${System.currentTimeMillis()}".toByteArray()
        ).toString()

        // Persist device ID
        deviceIdFile.writeText(newDeviceId)
        cachedDeviceId = newDeviceId

        return newDeviceId
    }

    /**
     * Get the device's MAC address.
     * Returns a placeholder if MAC cannot be determined.
     */
    fun getMacAddress(): String {
        cachedMacAddress?.let { return it }

        val mac = try {
            getMacFromNetworkInterface() ?: getMacFromWifiManager() ?: UNKNOWN_MAC
        } catch (e: Exception) {
            UNKNOWN_MAC
        }

        cachedMacAddress = mac
        return mac
    }

    /**
     * Get device hostname for display purposes.
     */
    fun getHostname(): String {
        return "kiosk-${getDeviceId().take(8)}"
    }

    /**
     * Get device model info.
     */
    fun getDeviceModel(): String {
        return "${Build.MANUFACTURER} ${Build.MODEL}"
    }

    /**
     * Get Android version.
     */
    fun getAndroidVersion(): String {
        return "Android ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})"
    }

    @SuppressLint("HardwareIds")
    private fun getAndroidId(): String {
        return Settings.Secure.getString(
            context.contentResolver,
            Settings.Secure.ANDROID_ID
        ) ?: UUID.randomUUID().toString()
    }

    private fun getMacFromNetworkInterface(): String? {
        return try {
            NetworkInterface.getNetworkInterfaces()?.toList()
                ?.firstOrNull { it.name.equals("wlan0", ignoreCase = true) }
                ?.hardwareAddress
                ?.joinToString(":") { String.format("%02x", it) }
        } catch (e: Exception) {
            null
        }
    }

    @Suppress("DEPRECATION")
    private fun getMacFromWifiManager(): String? {
        return try {
            val wifiManager = context.applicationContext
                .getSystemService(Context.WIFI_SERVICE) as? WifiManager
            wifiManager?.connectionInfo?.macAddress?.takeIf {
                it != "02:00:00:00:00:00" // Android returns this placeholder
            }
        } catch (e: Exception) {
            null
        }
    }

    companion object {
        private const val DEVICE_ID_FILE = "device_id"
        private const val UNKNOWN_MAC = "00:00:00:00:00:00"
    }
}
