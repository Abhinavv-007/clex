package in.clex.mobile.core.storage.theme

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class ThemeViewModel @Inject constructor(
    private val repository: ThemeRepository,
) : ViewModel() {

    val isDark: StateFlow<Boolean> = repository.isDark
        .stateIn(
            scope         = viewModelScope,
            started       = SharingStarted.WhileSubscribed(5_000),
            initialValue  = true,   // dark default
        )

    fun toggle() {
        viewModelScope.launch {
            repository.setDark(!isDark.value)
        }
    }

    fun setDark(dark: Boolean) {
        viewModelScope.launch { repository.setDark(dark) }
    }
}
