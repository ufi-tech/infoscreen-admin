package dk.ufitech.infoscreenkiosk.ui

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.animation.core.*
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.unit.dp
import androidx.lifecycle.lifecycleScope
import dagger.hilt.android.AndroidEntryPoint
import dk.ufitech.infoscreenkiosk.data.ConnectionState
import dk.ufitech.infoscreenkiosk.data.DeviceIdentity
import dk.ufitech.infoscreenkiosk.data.MqttClientManager
import dk.ufitech.infoscreenkiosk.data.SecureStorage
import dk.ufitech.infoscreenkiosk.ui.theme.InfoscreenKioskTheme
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Pending Activity - Shown while waiting for admin approval.
 */
@AndroidEntryPoint
class PendingActivity : ComponentActivity() {

    @Inject lateinit var secureStorage: SecureStorage
    @Inject lateinit var deviceIdentity: DeviceIdentity
    @Inject lateinit var mqttClientManager: MqttClientManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // If already approved, go to kiosk
        if (secureStorage.isApproved) {
            startKiosk()
            return
        }

        // Connect MQTT and wait for approval
        mqttClientManager.connect()

        // Listen for approval
        lifecycleScope.launch {
            mqttClientManager.approvalReceived.collectLatest { approved ->
                if (approved) {
                    startKiosk()
                }
            }
        }

        setContent {
            InfoscreenKioskTheme {
                PendingScreen(
                    deviceIdentity = deviceIdentity,
                    connectionState = mqttClientManager.connectionState.collectAsState().value,
                    onRetrySetup = {
                        secureStorage.clearAll()
                        startActivity(Intent(this, SetupActivity::class.java))
                        finish()
                    }
                )
            }
        }
    }

    private fun startKiosk() {
        startActivity(Intent(this, KioskActivity::class.java))
        finish()
    }
}

@Composable
fun PendingScreen(
    deviceIdentity: DeviceIdentity,
    connectionState: ConnectionState,
    onRetrySetup: () -> Unit
) {
    // Spinning animation
    val infiniteTransition = rememberInfiniteTransition(label = "spin")
    val rotation by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(
            animation = tween(2000, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "rotation"
    )

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            // Spinning indicator
            CircularProgressIndicator(
                modifier = Modifier
                    .size(80.dp)
                    .rotate(rotation),
                strokeWidth = 6.dp,
                color = MaterialTheme.colorScheme.primary
            )

            Spacer(modifier = Modifier.height(48.dp))

            // Title
            Text(
                text = "Afventer Godkendelse",
                style = MaterialTheme.typography.headlineMedium,
                color = MaterialTheme.colorScheme.onBackground
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Description
            Text(
                text = "Denne enhed afventer godkendelse fra administratoren.",
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(modifier = Modifier.height(48.dp))

            // Device ID card
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surfaceVariant
                )
            ) {
                Column(
                    modifier = Modifier.padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = "Enheds-ID",
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = deviceIdentity.getDeviceId(),
                        style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.primary
                    )
                    Spacer(modifier = Modifier.height(16.dp))

                    // Connection status
                    Row(
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        val (statusText, statusColor) = when (connectionState) {
                            ConnectionState.CONNECTED -> "Forbundet til broker" to MaterialTheme.colorScheme.primary
                            ConnectionState.CONNECTING -> "Forbinder..." to MaterialTheme.colorScheme.secondary
                            ConnectionState.DISCONNECTED -> "Ikke forbundet" to MaterialTheme.colorScheme.error
                            ConnectionState.ERROR -> "Forbindelsesfejl" to MaterialTheme.colorScheme.error
                        }

                        Surface(
                            modifier = Modifier.size(12.dp),
                            shape = MaterialTheme.shapes.small,
                            color = statusColor
                        ) {}

                        Spacer(modifier = Modifier.width(8.dp))

                        Text(
                            text = statusText,
                            style = MaterialTheme.typography.bodyMedium,
                            color = statusColor
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(48.dp))

            // Instructions
            Text(
                text = "Godkend enheden i admin-panelet for at fortsætte.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(modifier = Modifier.height(48.dp))

            // Retry setup button
            OutlinedButton(
                onClick = onRetrySetup
            ) {
                Text("Ret MQTT indstillinger")
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Device info
            Text(
                text = deviceIdentity.getDeviceModel(),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}
