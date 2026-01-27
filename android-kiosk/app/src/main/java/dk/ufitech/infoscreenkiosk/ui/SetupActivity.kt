package dk.ufitech.infoscreenkiosk.ui

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import dagger.hilt.android.AndroidEntryPoint
import dk.ufitech.infoscreenkiosk.data.ConnectionState
import dk.ufitech.infoscreenkiosk.data.DeviceIdentity
import dk.ufitech.infoscreenkiosk.data.MqttClientManager
import dk.ufitech.infoscreenkiosk.data.SecureStorage
import dk.ufitech.infoscreenkiosk.ui.theme.InfoscreenKioskTheme
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Setup Activity - First-time MQTT configuration.
 */
@AndroidEntryPoint
class SetupActivity : ComponentActivity() {

    @Inject lateinit var secureStorage: SecureStorage
    @Inject lateinit var deviceIdentity: DeviceIdentity
    @Inject lateinit var mqttClientManager: MqttClientManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContent {
            InfoscreenKioskTheme {
                SetupScreen(
                    secureStorage = secureStorage,
                    deviceIdentity = deviceIdentity,
                    mqttClientManager = mqttClientManager,
                    onSetupComplete = {
                        // Navigate to pending or kiosk
                        val intent = if (secureStorage.isApproved) {
                            Intent(this, KioskActivity::class.java)
                        } else {
                            Intent(this, PendingActivity::class.java)
                        }
                        startActivity(intent)
                        finish()
                    }
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SetupScreen(
    secureStorage: SecureStorage,
    deviceIdentity: DeviceIdentity,
    mqttClientManager: MqttClientManager,
    onSetupComplete: () -> Unit
) {
    var brokerUrl by remember { mutableStateOf(secureStorage.mqttBrokerUrl.ifBlank { "192.168.40.94:1883" }) }
    var username by remember { mutableStateOf(secureStorage.mqttUsername) }
    var password by remember { mutableStateOf(secureStorage.mqttPassword) }
    var passwordVisible by remember { mutableStateOf(false) }

    var isConnecting by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    val connectionState by mqttClientManager.connectionState.collectAsState()
    val scope = rememberCoroutineScope()

    // Handle connection state changes
    LaunchedEffect(connectionState) {
        when (connectionState) {
            ConnectionState.CONNECTED -> {
                isConnecting = false
                errorMessage = null
                secureStorage.isConfigured = true
                onSetupComplete()
            }
            ConnectionState.ERROR -> {
                isConnecting = false
                errorMessage = "Kunne ikke forbinde til broker"
            }
            else -> {}
        }
    }

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
            // Title
            Text(
                text = "Infoscreen Kiosk",
                style = MaterialTheme.typography.headlineLarge,
                color = MaterialTheme.colorScheme.primary
            )

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = "MQTT Konfiguration",
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(modifier = Modifier.height(48.dp))

            // Device ID info
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surfaceVariant
                )
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "Enheds-ID",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        text = deviceIdentity.getDeviceId(),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Broker URL
            OutlinedTextField(
                value = brokerUrl,
                onValueChange = { brokerUrl = it },
                label = { Text("Broker URL") },
                placeholder = { Text("192.168.1.100:1883") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                enabled = !isConnecting
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Username
            OutlinedTextField(
                value = username,
                onValueChange = { username = it },
                label = { Text("Brugernavn") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                enabled = !isConnecting
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Password
            OutlinedTextField(
                value = password,
                onValueChange = { password = it },
                label = { Text("Adgangskode") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                enabled = !isConnecting,
                visualTransformation = if (passwordVisible) {
                    VisualTransformation.None
                } else {
                    PasswordVisualTransformation()
                },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                trailingIcon = {
                    IconButton(onClick = { passwordVisible = !passwordVisible }) {
                        Icon(
                            imageVector = if (passwordVisible) {
                                Icons.Filled.VisibilityOff
                            } else {
                                Icons.Filled.Visibility
                            },
                            contentDescription = if (passwordVisible) "Skjul" else "Vis"
                        )
                    }
                }
            )

            Spacer(modifier = Modifier.height(24.dp))

            // Error message
            errorMessage?.let { error ->
                Text(
                    text = error,
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodyMedium
                )
                Spacer(modifier = Modifier.height(16.dp))
            }

            // Connect button
            Button(
                onClick = {
                    if (brokerUrl.isBlank() || username.isBlank() || password.isBlank()) {
                        errorMessage = "Alle felter skal udfyldes"
                        return@Button
                    }

                    errorMessage = null
                    isConnecting = true

                    // Save credentials
                    secureStorage.mqttBrokerUrl = brokerUrl
                    secureStorage.mqttUsername = username
                    secureStorage.mqttPassword = password

                    // Try to connect
                    mqttClientManager.connect(brokerUrl, username, password)

                    // Timeout after 15 seconds
                    scope.launch {
                        delay(15000)
                        if (isConnecting) {
                            isConnecting = false
                            errorMessage = "Forbindelse timeout"
                        }
                    }
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp),
                enabled = !isConnecting
            ) {
                if (isConnecting) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(24.dp),
                        color = MaterialTheme.colorScheme.onPrimary
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Forbinder...")
                } else {
                    Text("Forbind")
                }
            }

            Spacer(modifier = Modifier.height(32.dp))

            // Device info
            Text(
                text = deviceIdentity.getDeviceModel(),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
                text = deviceIdentity.getAndroidVersion(),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}
