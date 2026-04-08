package in.clex.mobile.core.transfer.di

import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import in.clex.mobile.core.transfer.TransferStateMachine
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object TransferModule {

    @Provides
    @Singleton
    fun provideTransferStateMachine(): TransferStateMachine = TransferStateMachine()
}
