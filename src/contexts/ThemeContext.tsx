import React, { createContext, useContext, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const THEME_STORAGE_KEY = 'theme'

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export const getInitialTheme = (): Theme => {
  if (typeof window === 'undefined') return 'dark'

  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') {
      return stored
    }

    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'light'
    }
  } catch {
    // LocalStorage or matchMedia not accessible
  }

  // O app DAVI PROJETOS é prioritariamente voltado a operações de içamento com estética escura de campo
  return 'dark'
}

export const applyThemeToDocument = (theme: Theme) => {
  const root = document.documentElement

  // Adiciona classe para transição suave de cores
  root.classList.add('theme-transitioning')

  if (theme === 'dark') {
    root.classList.add('dark')
    root.style.colorScheme = 'dark'
  } else {
    root.classList.remove('dark')
    root.style.colorScheme = 'light'
  }

  // Remove a classe de transição após o término
  window.setTimeout(() => {
    root.classList.remove('theme-transitioning')
  }, 350)
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => getInitialTheme())

  useEffect(() => {
    // Sincroniza estado inicial com elemento <html>
    applyThemeToDocument(theme)
  }, [])

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme)
    } catch (e) {
      console.warn('Falha ao salvar tema no localStorage:', e)
    }
    applyThemeToDocument(newTheme)
  }

  const toggleTheme = () => {
    const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(nextTheme)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme deve ser utilizado dentro de um ThemeProvider')
  }
  return context
}
