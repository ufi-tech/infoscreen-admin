package dk.ufitech.infoscreenkiosk.receiver

import android.app.admin.DeviceAdminReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import android.widget.Toast

/**
 * Device Admin Receiver for kiosk lock functionality.
 *
 * To set as device owner (requires factory reset or ADB):
 * adb shell dpm set-device-owner dk.ufitech.infoscreenkiosk/.receiver.DeviceAdminReceiver
 */
class DeviceAdminReceiver : DeviceAdminReceiver() {

    override fun onEnabled(context: Context, intent: Intent) {
        super.onEnabled(context, intent)
        Log.d(TAG, "Device admin enabled")
    }

    override fun onDisabled(context: Context, intent: Intent) {
        super.onDisabled(context, intent)
        Log.d(TAG, "Device admin disabled")
    }

    override fun onProfileProvisioningComplete(context: Context, intent: Intent) {
        super.onProfileProvisioningComplete(context, intent)
        Log.d(TAG, "Profile provisioning complete")
    }

    companion object {
        private const val TAG = "DeviceAdminReceiver"
    }
}
