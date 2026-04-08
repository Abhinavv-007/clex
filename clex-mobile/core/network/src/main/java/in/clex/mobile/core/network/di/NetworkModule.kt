package in.clex.mobile.core.network.di

import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import in.clex.mobile.core.network.chain.ChainClient
import in.clex.mobile.core.network.signaling.SignalingClient
import okhttp3.OkHttpClient
import java.util.concurrent.TimeUnit
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    @Provides
    @Singleton
    fun provideOkHttpClient(): OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

    @Provides
    @Singleton
    fun provideChainClient(): ChainClient {
        // URL is injected from BuildConfig at the app level
        // ChainClient is scoped to the signaling base URL
        return ChainClient(baseUrl = "https://clex.in")
    }
}
