package dk.ufitech.infoscreenkiosk.data

import java.net.Inet4Address
import java.net.NetworkInterface

/**
 * Network utility functions.
 */
object NetworkUtils {

    /**
     * Get the local IP address of the device.
     */
    fun getLocalIpAddress(): String? {
        return try {
            NetworkInterface.getNetworkInterfaces()?.toList()
                ?.flatMap { it.inetAddresses.toList() }
                ?.firstOrNull { !it.isLoopbackAddress && it is Inet4Address }
                ?.hostAddress
        } catch (e: Exception) {
            null
        }
    }
}
