package dk.ufitech.infoscreenkiosk.ui

import android.annotation.SuppressLint
import android.app.Activity
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Bitmap
import android.graphics.Canvas
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.wifi.WifiManager
import android.os.BatteryManager
import android.os.Build
import android.os.Bundle
import android.os.SystemClock
import android.util.Base64
import android.util.Log
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.webkit.*
import android.widget.FrameLayout
import androidx.activity.ComponentActivity
import androidx.lifecycle.lifecycleScope
import dagger.hilt.android.AndroidEntryPoint
import dk.ufitech.infoscreenkiosk.BuildConfig
import dk.ufitech.infoscreenkiosk.data.*
import dk.ufitech.infoscreenkiosk.data.model.*
import dk.ufitech.infoscreenkiosk.receiver.DeviceAdminReceiver
import dk.ufitech.infoscreenkiosk.service.TelemetryService
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import java.io.ByteArrayOutputStream
import javax.inject.Inject

/**
 * Main Kiosk Activity - displays WebView in fullscreen kiosk mode.
 */
@AndroidEntryPoint
class KioskActivity : ComponentActivity() {

    @Inject lateinit var secureStorage: SecureStorage
    @Inject lateinit var deviceIdentity: DeviceIdentity
    @Inject lateinit var mqttClientManager: MqttClientManager

    private lateinit var webView: WebView
    private lateinit var connectivityManager: ConnectivityManager

    private var networkCallback: ConnectivityManager.NetworkCallback? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Check if setup is complete
        if (!secureStorage.isConfigured || !secureStorage.hasValidConfig()) {
            startActivity(Intent(this, SetupActivity::class.java))
            finish()
            return
        }

        // Check if awaiting approval
        if (!secureStorage.isApproved) {
            startActivity(Intent(this, PendingActivity::class.java))
            finish()
            return
        }

        setupFullscreen()
        setupWebView()
        setupNetworkCallback()
        startTelemetryService()
        connectMqtt()
        observeCommands()

        // Load current URL
        loadUrl(secureStorage.currentUrl)
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        webView = WebView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )

            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                mediaPlaybackRequiresUserGesture = false
                loadWithOverviewMode = true
                useWideViewPort = true
                cacheMode = WebSettings.LOAD_DEFAULT
                mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW

                // Performance
                setRenderPriority(WebSettings.RenderPriority.HIGH)

                // Disable zoom
                setSupportZoom(false)
                builtInZoomControls = false
                displayZoomControls = false
            }

            webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    Log.d(TAG, "Page loaded: $url")
                }

                override fun onReceivedError(
                    view: WebView?,
                    request: WebResourceRequest?,
                    error: WebResourceError?
                ) {
                    if (request?.isForMainFrame == true) {
                        Log.e(TAG, "WebView error: ${error?.description}")
                        // Load offline fallback
                        loadOfflinePage()
                    }
                }
            }

            webChromeClient = WebChromeClient()
        }

        setContentView(webView)
    }

    private fun setupFullscreen() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.insetsController?.let {
                it.hide(WindowInsets.Type.statusBars() or WindowInsets.Type.navigationBars())
                it.systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }
        } else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = (
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or
                View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
                View.SYSTEM_UI_FLAG_FULLSCREEN or
                View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
                View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            )
        }

        // Try to enable lock task mode if we're device owner
        tryEnableLockTaskMode()
    }

    private fun tryEnableLockTaskMode() {
        val dpm = getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        val adminComponent = ComponentName(this, DeviceAdminReceiver::class.java)

        if (dpm.isDeviceOwnerApp(packageName)) {
            // We're device owner - enable full kiosk lock
            dpm.setLockTaskPackages(adminComponent, arrayOf(packageName))
            startLockTask()
            Log.d(TAG, "Lock task mode enabled")
        } else {
            Log.d(TAG, "Not device owner - running in immersive mode only")
        }
    }

    private fun setupNetworkCallback() {
        connectivityManager = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

        networkCallback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                Log.d(TAG, "Network available")
                // Reload page if we were showing offline
                runOnUiThread {
                    if (webView.url?.contains("offline") == true) {
                        loadUrl(secureStorage.currentUrl)
                    }
                }
            }

            override fun onLost(network: Network) {
                Log.d(TAG, "Network lost")
                runOnUiThread {
                    loadOfflinePage()
                }
            }
        }

        val request = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build()

        connectivityManager.registerNetworkCallback(request, networkCallback!!)
    }

    private fun startTelemetryService() {
        val serviceIntent = Intent(this, TelemetryService::class.java)
        startForegroundService(serviceIntent)
    }

    private fun connectMqtt() {
        mqttClientManager.connect()
    }

    private fun observeCommands() {
        lifecycleScope.launch {
            mqttClientManager.incomingCommands.collectLatest { command ->
                handleCommand(command)
            }
        }
    }

    private fun handleCommand(command: IncomingCommand) {
        Log.d(TAG, "Received command: $command")

        when (command) {
            is IncomingCommand.SetUrl -> {
                secureStorage.currentUrl = command.url
                loadUrl(command.url)
                mqttClientManager.publishEvent(
                    EventData(
                        type = "url-changed",
                        message = "URL changed to ${command.url}"
                    )
                )
            }

            is IncomingCommand.Reboot -> {
                mqttClientManager.publishEvent(
                    EventData(type = "reboot", message = "Reboot requested")
                )
                // Try to reboot (requires device owner or root)
                try {
                    val dpm = getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
                    val adminComponent = ComponentName(this, DeviceAdminReceiver::class.java)
                    if (dpm.isDeviceOwnerApp(packageName)) {
                        dpm.reboot(adminComponent)
                    } else {
                        mqttClientManager.publishEvent(
                            EventData(
                                type = "error",
                                message = "Reboot failed - not device owner"
                            )
                        )
                    }
                } catch (e: Exception) {
                    mqttClientManager.publishEvent(
                        EventData(
                            type = "error",
                            message = "Reboot failed: ${e.message}"
                        )
                    )
                }
            }

            is IncomingCommand.Screenshot -> {
                takeScreenshot()
            }

            is IncomingCommand.WifiScan -> {
                performWifiScan()
            }

            is IncomingCommand.GetInfo -> {
                publishSystemInfo()
            }

            is IncomingCommand.LogTail -> {
                // Android doesn't have system logs accessible like Pi
                mqttClientManager.publishEvent(
                    EventData(
                        type = "log-tail",
                        message = "Log tail not available on Android",
                        data = mapOf("platform" to "android")
                    )
                )
            }
        }
    }

    private fun loadUrl(url: String) {
        Log.d(TAG, "Loading URL: $url")
        runOnUiThread {
            webView.loadUrl(url)
        }
    }

    private fun loadOfflinePage() {
        runOnUiThread {
            webView.loadUrl("file:///android_res/raw/offline.html")
        }
    }

    private fun takeScreenshot() {
        lifecycleScope.launch {
            try {
                // Small delay to ensure WebView is rendered
                delay(500)

                runOnUiThread {
                    val bitmap = Bitmap.createBitmap(
                        webView.width,
                        webView.height,
                        Bitmap.Config.ARGB_8888
                    )
                    val canvas = Canvas(bitmap)
                    webView.draw(canvas)

                    // Convert to base64
                    val outputStream = ByteArrayOutputStream()
                    bitmap.compress(Bitmap.CompressFormat.JPEG, 80, outputStream)
                    val bytes = outputStream.toByteArray()
                    val base64 = Base64.encodeToString(bytes, Base64.NO_WRAP)

                    mqttClientManager.publishScreenshot(
                        ScreenshotResponse(
                            base64 = base64,
                            bytes = bytes.size,
                            width = bitmap.width,
                            height = bitmap.height
                        )
                    )

                    Log.d(TAG, "Screenshot taken: ${bytes.size} bytes")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Screenshot failed: ${e.message}")
                mqttClientManager.publishEvent(
                    EventData(
                        type = "error",
                        message = "Screenshot failed: ${e.message}"
                    )
                )
            }
        }
    }

    @SuppressLint("MissingPermission")
    private fun performWifiScan() {
        try {
            val wifiManager = applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
            val scanResults = wifiManager.scanResults

            val networks = scanResults.map { result ->
                WifiNetwork(
                    ssid = result.SSID,
                    bssid = result.BSSID,
                    signal = result.level,
                    frequency = result.frequency,
                    security = getSecurityType(result)
                )
            }.distinctBy { it.ssid }
                .sortedByDescending { it.signal }

            mqttClientManager.publishWifiScan(
                WifiScanResponse(networks = networks)
            )

            Log.d(TAG, "WiFi scan complete: ${networks.size} networks")
        } catch (e: Exception) {
            Log.e(TAG, "WiFi scan failed: ${e.message}")
            mqttClientManager.publishEvent(
                EventData(
                    type = "error",
                    message = "WiFi scan failed: ${e.message}"
                )
            )
        }
    }

    private fun getSecurityType(scanResult: android.net.wifi.ScanResult): String {
        return when {
            scanResult.capabilities.contains("WPA3") -> "WPA3"
            scanResult.capabilities.contains("WPA2") -> "WPA2"
            scanResult.capabilities.contains("WPA") -> "WPA"
            scanResult.capabilities.contains("WEP") -> "WEP"
            else -> "OPEN"
        }
    }

    private fun publishSystemInfo() {
        val batteryIntent = registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        val batteryPct = batteryIntent?.let { intent ->
            val level = intent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
            val scale = intent.getIntExtra(BatteryManager.EXTRA_SCALE, -1)
            if (level >= 0 && scale > 0) (level * 100 / scale) else null
        }

        val info = SystemInfo(
            deviceId = deviceIdentity.getDeviceId(),
            hostname = deviceIdentity.getHostname(),
            model = deviceIdentity.getDeviceModel(),
            androidVersion = deviceIdentity.getAndroidVersion(),
            appVersion = BuildConfig.VERSION_NAME,
            ip = NetworkUtils.getLocalIpAddress() ?: "unknown",
            mac = deviceIdentity.getMacAddress(),
            uptimeSeconds = SystemClock.elapsedRealtime() / 1000,
            batteryPct = batteryPct,
            currentUrl = secureStorage.currentUrl
        )

        mqttClientManager.publishSystemInfo(info)
        Log.d(TAG, "System info published")
    }

    override fun onResume() {
        super.onResume()
        setupFullscreen()
    }

    override fun onBackPressed() {
        // Disable back button in kiosk mode
        // super.onBackPressed()
    }

    override fun onDestroy() {
        super.onDestroy()
        networkCallback?.let {
            connectivityManager.unregisterNetworkCallback(it)
        }
        webView.destroy()
    }

    companion object {
        private const val TAG = "KioskActivity"
    }
}
