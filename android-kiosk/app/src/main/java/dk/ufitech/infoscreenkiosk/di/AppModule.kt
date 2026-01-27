package dk.ufitech.infoscreenkiosk.di

import android.content.Context
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import dk.ufitech.infoscreenkiosk.data.DeviceIdentity
import dk.ufitech.infoscreenkiosk.data.MqttClientManager
import dk.ufitech.infoscreenkiosk.data.SecureStorage
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    @Provides
    @Singleton
    fun provideSecureStorage(
        @ApplicationContext context: Context
    ): SecureStorage {
        return SecureStorage(context)
    }

    @Provides
    @Singleton
    fun provideDeviceIdentity(
        @ApplicationContext context: Context
    ): DeviceIdentity {
        return DeviceIdentity(context)
    }

    @Provides
    @Singleton
    fun provideMqttClientManager(
        @ApplicationContext context: Context,
        secureStorage: SecureStorage,
        deviceIdentity: DeviceIdentity
    ): MqttClientManager {
        return MqttClientManager(context, secureStorage, deviceIdentity)
    }
}
