import React from 'react'
import { NavLink } from 'react-router-dom'
import { ClipboardCheck, FileSpreadsheet, Building2, Truck, User } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

export const MobileBottomNav: React.FC = () => {
  const { isCliente } = useAuth()

  const navItems = [
    {
      to: '/checklists',
      label: 'Checklists',
      icon: ClipboardCheck,
    },
    ...(!isCliente
      ? [
          {
            to: '/modelos',
            label: 'Modelos',
            icon: FileSpreadsheet,
          },
          {
            to: '/clientes',
            label: 'Clientes',
            icon: Building2,
          },
          {
            to: '/equipamentos',
            label: 'Equipamentos',
            icon: Truck,
          },
        ]
      : []),
    {
      to: '/meu-perfil',
      label: 'Perfil',
      icon: User,
    },
  ]

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-2 py-1.5 flex items-center justify-around select-none shadow-2xl safe-area-pb"
      aria-label="Navegação inferior mobile"
    >
      {navItems.map((item) => {
        const Icon = item.icon
        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center min-w-[56px] min-h-[48px] py-1 px-2 rounded-xl transition-all duration-150 active:scale-95 ${
                isActive
                  ? 'text-blue-400 font-semibold bg-blue-950/50'
                  : 'text-slate-400 hover:text-slate-200 active:bg-slate-800'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  className={`w-5 h-5 mb-0.5 ${isActive ? 'text-blue-400' : 'text-slate-400'}`}
                />
                <span className="text-[10px] tracking-tight">{item.label}</span>
              </>
            )}
          </NavLink>
        )
      })}
    </nav>
  )
}
