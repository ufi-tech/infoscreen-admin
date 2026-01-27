package dk.ufitech.infoscreenkiosk.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import dk.ufitech.infoscreenkiosk.ui.KioskActivity

/**
 * Boot Receiver - Auto-starts kiosk activity on device boot.
 */
class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED ||
            intent.action == "android.intent.action.QUICKBOOT_POWERON") {

            Log.d(TAG, "Boot completed - starting kiosk")

            val kioskIntent = Intent(context, KioskActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(kioskIntent)
        }
    }

    companion object {
        private const val TAG = "BootReceiver"
    }
}
