# ProGuard rules for InfoscreenKiosk

# Keep MQTT classes
-keep class org.eclipse.paho.** { *; }
-keep class info.mqtt.** { *; }

# Keep Gson serialization
-keepattributes Signature
-keepattributes *Annotation*
-keep class com.google.gson.** { *; }
-keep class dk.ufitech.infoscreenkiosk.data.model.** { *; }

# Keep Hilt
-keep class dagger.hilt.** { *; }
-keep class javax.inject.** { *; }

# Device Admin Receiver
-keep class dk.ufitech.infoscreenkiosk.receiver.DeviceAdminReceiver { *; }
