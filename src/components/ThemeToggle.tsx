import React from 'react'
import { Sun, Moon } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface ThemeToggleProps {
  className?: string
  showLabel?: boolean
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '', showLabel = false }) => {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size={showLabel ? 'sm' : 'icon'}
          onClick={toggleTheme}
          aria-label={isDark ? 'Ativar modo claro' : 'Ativar modo escuro'}
          className={`relative h-8 w-8 sm:h-8 sm:w-8 p-0 rounded-lg text-slate-400 hover:text-slate-100 dark:hover:text-amber-300 hover:bg-slate-800/80 dark:hover:bg-slate-800/80 transition-all duration-200 active:scale-95 focus-visible:ring-1 focus-visible:ring-blue-500 ${className}`}
        >
          <div className="relative w-4 h-4 flex items-center justify-center">
            {/* Ícone Sol (Modo Claro) */}
            <Sun
              className={`w-4 h-4 text-amber-500 absolute transition-all duration-300 ease-in-out transform ${
                isDark ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100'
              }`}
            />
            {/* Ícone Lua (Modo Escuro) */}
            <Moon
              className={`w-4 h-4 text-amber-300 absolute transition-all duration-300 ease-in-out transform ${
                isDark ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-0 opacity-0'
              }`}
            />
          </div>
          {showLabel && (
            <span className="ml-2 text-xs font-medium">
              {isDark ? 'Modo Escuro' : 'Modo Claro'}
            </span>
          )}
          <span className="sr-only">
            {isDark ? 'Alternar para tema claro' : 'Alternar para tema escuro'}
          </span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {isDark ? 'Alternar para modo claro' : 'Alternar para modo escuro'}
      </TooltipContent>
    </Tooltip>
  )
}
