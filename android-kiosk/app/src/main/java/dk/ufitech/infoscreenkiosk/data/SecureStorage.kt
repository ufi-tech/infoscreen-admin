package dk.ufitech.infoscreenkiosk.data

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Secure storage for sensitive data like MQTT credentials.
 * Uses Android's EncryptedSharedPreferences with AES-256 encryption.
 */
@Singleton
class SecureStorage @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val prefs: SharedPreferences = EncryptedSharedPreferences.create(
        context,
        PREFS_NAME,
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    // MQTT Configuration
    var mqttBrokerUrl: String
        get() = prefs.getString(KEY_MQTT_BROKER_URL, "") ?: ""
        set(value) = prefs.edit().putString(KEY_MQTT_BROKER_URL, value).apply()

    var mqttUsername: String
        get() = prefs.getString(KEY_MQTT_USERNAME, "") ?: ""
        set(value) = prefs.edit().putString(KEY_MQTT_USERNAME, value).apply()

    var mqttPassword: String
        get() = prefs.getString(KEY_MQTT_PASSWORD, "") ?: ""
        set(value) = prefs.edit().putString(KEY_MQTT_PASSWORD, value).apply()

    // Device State
    var isConfigured: Boolean
        get() = prefs.getBoolean(KEY_IS_CONFIGURED, false)
        set(value) = prefs.edit().putBoolean(KEY_IS_CONFIGURED, value).apply()

    var isApproved: Boolean
        get() = prefs.getBoolean(KEY_IS_APPROVED, false)
        set(value) = prefs.edit().putBoolean(KEY_IS_APPROVED, value).apply()

    var currentUrl: String
        get() = prefs.getString(KEY_CURRENT_URL, DEFAULT_URL) ?: DEFAULT_URL
        set(value) = prefs.edit().putString(KEY_CURRENT_URL, value).apply()

    fun hasValidConfig(): Boolean {
        return mqttBrokerUrl.isNotBlank() &&
                mqttUsername.isNotBlank() &&
                mqttPassword.isNotBlank()
    }

    fun clearAll() {
        prefs.edit().clear().apply()
    }

    companion object {
        private const val PREFS_NAME = "infoscreen_secure_prefs"

        private const val KEY_MQTT_BROKER_URL = "mqtt_broker_url"
        private const val KEY_MQTT_USERNAME = "mqtt_username"
        private const val KEY_MQTT_PASSWORD = "mqtt_password"
        private const val KEY_IS_CONFIGURED = "is_configured"
        private const val KEY_IS_APPROVED = "is_approved"
        private const val KEY_CURRENT_URL = "current_url"

        private const val DEFAULT_URL = "file:///android_res/raw/offline.html"
    }
}
