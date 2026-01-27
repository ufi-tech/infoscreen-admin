package dk.ufitech.infoscreenkiosk.data

import android.content.Context
import android.util.Log
import com.google.gson.Gson
import dagger.hilt.android.qualifiers.ApplicationContext
import dk.ufitech.infoscreenkiosk.data.model.*
import info.mqtt.android.service.MqttAndroidClient
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import org.eclipse.paho.client.mqttv3.*
import javax.inject.Inject
import javax.inject.Singleton

/**
 * MQTT Client Manager - handles all MQTT communication.
 * Compatible with the existing Pi MQTT topic structure.
 */
@Singleton
class MqttClientManager @Inject constructor(
    @ApplicationContext private val context: Context,
    private val secureStorage: SecureStorage,
    private val deviceIdentity: DeviceIdentity
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val gson = Gson()

    private var mqttClient: MqttAndroidClient? = null

    private val _connectionState = MutableStateFlow(ConnectionState.DISCONNECTED)
    val connectionState: StateFlow<ConnectionState> = _connectionState.asStateFlow()

    private val _incomingCommands = MutableSharedFlow<IncomingCommand>(
        replay = 0,
        extraBufferCapacity = 50
    )
    val incomingCommands: SharedFlow<IncomingCommand> = _incomingCommands.asSharedFlow()

    private val _approvalReceived = MutableSharedFlow<Boolean>(
        replay = 1,
        extraBufferCapacity = 1
    )
    val approvalReceived: SharedFlow<Boolean> = _approvalReceived.asSharedFlow()

    /**
     * Connect to MQTT broker.
     */
    fun connect(
        brokerUrl: String = secureStorage.mqttBrokerUrl,
        username: String = secureStorage.mqttUsername,
        password: String = secureStorage.mqttPassword
    ) {
        if (_connectionState.value == ConnectionState.CONNECTED) {
            Log.d(TAG, "Already connected")
            return
        }

        _connectionState.value = ConnectionState.CONNECTING

        val deviceId = deviceIdentity.getDeviceId()
        val clientId = "android-$deviceId"

        // Ensure broker URL has proper protocol
        val serverUri = when {
            brokerUrl.startsWith("tcp://") -> brokerUrl
            brokerUrl.startsWith("ssl://") -> brokerUrl
            brokerUrl.contains(":") -> "tcp://$brokerUrl"
            else -> "tcp://$brokerUrl:1883"
        }

        Log.d(TAG, "Connecting to $serverUri as $clientId")

        mqttClient = MqttAndroidClient(context, serverUri, clientId).apply {
            setCallback(createCallback())
        }

        val options = MqttConnectOptions().apply {
            isCleanSession = true
            isAutomaticReconnect = true
            connectionTimeout = 30
            keepAliveInterval = 60
            userName = username
            password = password.toCharArray()

            // Last Will - mark device offline on unexpected disconnect
            val statusTopic = if (secureStorage.isApproved) {
                "devices/$deviceId/status"
            } else {
                "devices/pending/$deviceId/status"
            }
            setWill(
                statusTopic,
                """{"status":"offline","ts":${System.currentTimeMillis()}}""".toByteArray(),
                1,
                true
            )
        }

        try {
            mqttClient?.connect(options, null, object : IMqttActionListener {
                override fun onSuccess(asyncActionToken: IMqttToken?) {
                    Log.d(TAG, "Connected successfully")
                    _connectionState.value = ConnectionState.CONNECTED
                    subscribeToTopics()
                    publishStatus()
                }

                override fun onFailure(asyncActionToken: IMqttToken?, exception: Throwable?) {
                    Log.e(TAG, "Connection failed: ${exception?.message}")
                    _connectionState.value = ConnectionState.ERROR
                }
            })
        } catch (e: Exception) {
            Log.e(TAG, "Connection error: ${e.message}")
            _connectionState.value = ConnectionState.ERROR
        }
    }

    /**
     * Disconnect from MQTT broker.
     */
    fun disconnect() {
        try {
            // Publish offline status before disconnecting
            val deviceId = deviceIdentity.getDeviceId()
            val topic = if (secureStorage.isApproved) {
                "devices/$deviceId/status"
            } else {
                "devices/pending/$deviceId/status"
            }
            mqttClient?.publish(
                topic,
                """{"status":"offline","ts":${System.currentTimeMillis()}}""".toByteArray(),
                1,
                true
            )

            mqttClient?.disconnect()
            _connectionState.value = ConnectionState.DISCONNECTED
        } catch (e: Exception) {
            Log.e(TAG, "Disconnect error: ${e.message}")
        }
    }

    /**
     * Publish device status.
     */
    fun publishStatus() {
        val deviceId = deviceIdentity.getDeviceId()

        val status = DeviceStatus(
            status = "online",
            approved = secureStorage.isApproved,
            ip = NetworkUtils.getLocalIpAddress() ?: "",
            mac = deviceIdentity.getMacAddress(),
            url = secureStorage.currentUrl,
            model = deviceIdentity.getDeviceModel(),
            androidVersion = deviceIdentity.getAndroidVersion()
        )

        val topic = if (secureStorage.isApproved) {
            "devices/$deviceId/status"
        } else {
            "devices/pending/$deviceId/status"
        }

        publish(topic, gson.toJson(status), qos = 1, retained = true)
    }

    /**
     * Publish telemetry data.
     */
    fun publishTelemetry(telemetry: TelemetryData) {
        if (!secureStorage.isApproved) return

        val deviceId = deviceIdentity.getDeviceId()
        publish("devices/$deviceId/telemetry", gson.toJson(telemetry), qos = 0)
    }

    /**
     * Publish event/log.
     */
    fun publishEvent(event: EventData) {
        if (!secureStorage.isApproved) return

        val deviceId = deviceIdentity.getDeviceId()
        publish("devices/$deviceId/events", gson.toJson(event), qos = 1)
    }

    /**
     * Publish screenshot response.
     */
    fun publishScreenshot(screenshot: ScreenshotResponse) {
        val deviceId = deviceIdentity.getDeviceId()
        publish("devices/$deviceId/screenshot", gson.toJson(screenshot), qos = 1)
    }

    /**
     * Publish WiFi scan response.
     */
    fun publishWifiScan(wifiScan: WifiScanResponse) {
        val deviceId = deviceIdentity.getDeviceId()
        publish("devices/$deviceId/wifi-scan", gson.toJson(wifiScan), qos = 1)
    }

    /**
     * Publish system info.
     */
    fun publishSystemInfo(info: SystemInfo) {
        val deviceId = deviceIdentity.getDeviceId()
        publish("devices/$deviceId/events", gson.toJson(info), qos = 1)
    }

    /**
     * Publish geolocation.
     */
    fun publishGeolocation(location: GeolocationResponse) {
        val deviceId = deviceIdentity.getDeviceId()
        publish("devices/$deviceId/geolocation", gson.toJson(location), qos = 1)
    }

    private fun publish(topic: String, payload: String, qos: Int = 1, retained: Boolean = false) {
        try {
            mqttClient?.publish(topic, payload.toByteArray(), qos, retained)
            Log.d(TAG, "Published to $topic")
        } catch (e: Exception) {
            Log.e(TAG, "Publish error: ${e.message}")
        }
    }

    private fun subscribeToTopics() {
        val deviceId = deviceIdentity.getDeviceId()

        val topics = mutableListOf(
            "devices/$deviceId/cmd/+" // All commands for approved devices
        )

        // Also subscribe to pending topics if not yet approved
        if (!secureStorage.isApproved) {
            topics.add("devices/pending/$deviceId/cmd/+")
        }

        topics.forEach { topic ->
            try {
                mqttClient?.subscribe(topic, 1) { _, message ->
                    handleMessage(topic, message)
                }
                Log.d(TAG, "Subscribed to $topic")
            } catch (e: Exception) {
                Log.e(TAG, "Subscribe error for $topic: ${e.message}")
            }
        }
    }

    private fun handleMessage(topic: String, message: MqttMessage) {
        val payload = String(message.payload)
        Log.d(TAG, "Received on $topic: $payload")

        // Extract command from topic: devices/{id}/cmd/{action}
        val parts = topic.split("/")
        val action = parts.lastOrNull() ?: return

        when (action) {
            "approve" -> {
                Log.d(TAG, "Approval received!")
                secureStorage.isApproved = true
                scope.launch {
                    _approvalReceived.emit(true)
                }
                // Re-publish status as approved device
                publishStatus()
                // Re-subscribe to approved device topics
                subscribeToTopics()
            }
            "set-url" -> {
                try {
                    val cmd = gson.fromJson(payload, CommandPayload::class.java)
                    cmd.url?.let { url ->
                        scope.launch {
                            _incomingCommands.emit(IncomingCommand.SetUrl(url))
                        }
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Error parsing set-url: ${e.message}")
                }
            }
            "reboot" -> {
                scope.launch {
                    _incomingCommands.emit(IncomingCommand.Reboot)
                }
            }
            "screenshot" -> {
                scope.launch {
                    _incomingCommands.emit(IncomingCommand.Screenshot)
                }
            }
            "wifi-scan" -> {
                scope.launch {
                    _incomingCommands.emit(IncomingCommand.WifiScan)
                }
            }
            "get-info" -> {
                scope.launch {
                    _incomingCommands.emit(IncomingCommand.GetInfo)
                }
            }
            "log-tail" -> {
                scope.launch {
                    _incomingCommands.emit(IncomingCommand.LogTail)
                }
            }
            else -> {
                Log.w(TAG, "Unknown command: $action")
            }
        }
    }

    private fun createCallback() = object : MqttCallbackExtended {
        override fun connectComplete(reconnect: Boolean, serverURI: String?) {
            Log.d(TAG, "Connect complete (reconnect=$reconnect)")
            _connectionState.value = ConnectionState.CONNECTED
            if (reconnect) {
                subscribeToTopics()
                publishStatus()
            }
        }

        override fun connectionLost(cause: Throwable?) {
            Log.w(TAG, "Connection lost: ${cause?.message}")
            _connectionState.value = ConnectionState.DISCONNECTED
        }

        override fun messageArrived(topic: String?, message: MqttMessage?) {
            // Handled by per-topic subscriptions
        }

        override fun deliveryComplete(token: IMqttDeliveryToken?) {
            // Not needed
        }
    }

    companion object {
        private const val TAG = "MqttClientManager"
    }
}

enum class ConnectionState {
    DISCONNECTED,
    CONNECTING,
    CONNECTED,
    ERROR
}

sealed class IncomingCommand {
    data class SetUrl(val url: String) : IncomingCommand()
    data object Reboot : IncomingCommand()
    data object Screenshot : IncomingCommand()
    data object WifiScan : IncomingCommand()
    data object GetInfo : IncomingCommand()
    data object LogTail : IncomingCommand()
}
