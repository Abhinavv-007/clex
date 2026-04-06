import { writable } from 'svelte/store'
import { browser } from '$app/environment'

type Theme = 'dark' | 'light'

function getInitial(): Theme {
  if (!browser) return 'dark'
  const stored = localStorage.getItem('clex-theme') as Theme | null
  if (stored === 'dark' || stored === 'light') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'dark' // default dark
}

function applyTheme(theme: Theme) {
  if (!browser) return
  document.documentElement.classList.toggle('dark', theme === 'dark')
  localStorage.setItem('clex-theme', theme)
}

function createThemeStore() {
  const initial = getInitial()
  applyTheme(initial)
  const { subscribe, update, set } = writable<Theme>(initial)

  return {
    subscribe,
    toggle() {
      update(t => {
        const next = t === 'dark' ? 'light' : 'dark'
        applyTheme(next)
        return next
      })
    },
    set(theme: Theme) {
      applyTheme(theme)
      set(theme)
    },
  }
}

export const theme = createThemeStore()
