import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { OfflineSyncBar } from './OfflineSyncBar'
import {
  LayoutDashboard,
  ClipboardCheck,
  FileSpreadsheet,
  Building2,
  Truck,
  Anchor,
  Users,
  Building,
  LogOut,
  ChevronDown,
  Menu,
  X,
  ShieldCheck,
  HardHat,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'

interface SidebarLayoutProps {
  children: React.ReactNode
}

export const SidebarLayout: React.FC<SidebarLayoutProps> = ({ children }) => {
  const { user, company, companies, logout, switchCompany, role, isAdmin, canManageCompanies } =
    useAuth()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const allNavItems = [
    { title: 'Dashboard', path: '/', icon: LayoutDashboard, adminOnly: false },
    { title: 'Checklists', path: '/checklists', icon: ClipboardCheck, adminOnly: false },
    { title: 'Modelos de Inspeção', path: '/modelos', icon: FileSpreadsheet, adminOnly: false },
    { title: 'Equipamentos', path: '/equipamentos', icon: Truck, adminOnly: false },
    { title: 'Materiais & Acessórios', path: '/materiais', icon: Anchor, adminOnly: false },
    { title: 'Clientes & Obras', path: '/clientes', icon: Building2, adminOnly: false },
    { title: 'Usuários & Perfis', path: '/usuarios', icon: Users, adminOnly: false },
    { title: 'Dados da Empresa', path: '/empresa', icon: Building, adminOnly: true },
  ]

  const navItems = allNavItems.filter((item) => !item.adminOnly || canManageCompanies)

  const getRoleLabel = (r: string) => {
    switch (r) {
      case 'superadmin':
        return 'Super Admin'
      case 'admin':
        return 'Administrador'
      case 'gestor':
        return 'Gestor Operacional'
      case 'supervisor':
        return 'Supervisor de Rigging'
      case 'rigger':
        return 'Rigger Especialista'
      case 'sinaleiro':
        return 'Sinaleiro / Amarrador'
      case 'operador':
        return 'Operador de Guindaste'
      default:
        return r
    }
  }

  const getRoleBadgeVariant = (r: string) => {
    switch (r) {
      case 'superadmin':
      case 'admin':
        return 'bg-blue-600/20 text-blue-400 border-blue-500/30'
      case 'gestor':
        return 'bg-purple-600/20 text-purple-400 border-purple-500/30'
      case 'supervisor':
        return 'bg-emerald-600/20 text-emerald-400 border-emerald-500/30'
      case 'rigger':
        return 'bg-amber-600/20 text-amber-400 border-amber-500/30'
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700'
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row antialiased">
      {/* Mobile Topbar */}
      <header className="md:hidden flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800 sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <img
            src="/logo.svg"
            alt="DAVI PROJETOS DE RIGGING"
            className="h-8 w-auto object-contain rounded-md"
          />
          <img
            src="/seal-10-years.svg"
            alt="10 Anos"
            className="h-7 w-7 object-contain drop-shadow"
          />
        </div>
        <div className="flex items-center gap-2">
          <OfflineSyncBar />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="text-slate-300"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </Button>
        </div>
      </header>

      {/* Sidebar Navigation */}
      <aside
        className={`${
          mobileMenuOpen ? 'fixed inset-0 z-50 bg-slate-950 flex flex-col' : 'hidden'
        } md:flex md:w-64 md:flex-col md:shrink-0 bg-slate-900 border-r border-slate-800 select-none`}
      >
        {/* Brand / Company Header */}
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <Link to="/" className="block w-full focus:outline-none group">
              <div className="flex flex-col items-center gap-2">
                <img
                  src="/logo.svg"
                  alt="DAVI PROJETOS DE RIGGING"
                  className="w-full h-auto max-h-16 object-contain rounded-lg shadow-sm transition group-hover:scale-[1.02]"
                />
                <div className="flex items-center justify-center gap-1.5 w-full bg-slate-950/70 border border-amber-500/20 rounded-md py-1 px-2">
                  <img
                    src="/seal-10-years.svg"
                    alt="10 Anos"
                    className="w-5 h-5 object-contain shrink-0"
                  />
                  <span className="text-[11px] font-semibold text-amber-300 tracking-tight">
                    10 ANOS (2016-2026)
                  </span>
                </div>
              </div>
            </Link>
            {mobileMenuOpen && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileMenuOpen(false)}
                className="md:hidden text-slate-400 shrink-0 ml-2"
              >
                <X className="w-5 h-5" />
              </Button>
            )}
          </div>

          {/* Multi-Tenant Switcher */}
          <div className="pt-2">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
              {canManageCompanies ? 'Ambiente / Empresa' : 'Empresa Vinculada'}
            </label>
            {canManageCompanies ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="w-full flex items-center justify-between p-2 rounded-lg bg-slate-950/80 hover:bg-slate-950 border border-slate-800 text-left transition"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="text-xs font-medium text-slate-200 truncate">
                        {company?.trade_name || company?.name || 'Selecione a Empresa'}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        CNPJ: {company?.cnpj || 'Não informado'}
                      </div>
                    </div>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="w-60 bg-slate-900 border-slate-800 text-slate-200"
                >
                  <DropdownMenuLabel className="text-xs text-slate-400">
                    Alternar Empresa (Multi-tenant)
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-slate-800" />
                  {companies.map((c) => (
                    <DropdownMenuItem
                      key={c.id}
                      onClick={() => switchCompany(c.id)}
                      className={`text-xs cursor-pointer ${
                        company?.id === c.id ? 'bg-blue-600/20 text-blue-400 font-semibold' : ''
                      }`}
                    >
                      <Building className="w-3.5 h-3.5 mr-2 shrink-0" />
                      <span className="truncate">{c.name}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="w-full flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 text-left cursor-default">
                <div className="min-w-0 pr-2">
                  <div className="text-xs font-medium text-slate-200 truncate">
                    {company?.trade_name || company?.name || 'Empresa Padrão'}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    CNPJ: {company?.cnpj || 'Não informado'}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive =
              location.pathname === item.path ||
              (item.path !== '/' && location.pathname.startsWith(item.path))
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`}
                />
                <span>{item.title}</span>
              </Link>
            )
          })}
        </nav>

        {/* User Card & Logout */}
        <div className="p-3 border-t border-slate-800 bg-slate-900/50">
          <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 mb-2">
            <div className="min-w-0 pr-2">
              <div className="text-xs font-semibold text-slate-200 truncate">
                {user?.name || 'Operador'}
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <Badge
                  variant="outline"
                  className={`text-[10px] px-1.5 py-0 uppercase ${getRoleBadgeVariant(role)}`}
                >
                  {getRoleLabel(role)}
                </Badge>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={logout}
              title="Sair do sistema"
              className="h-8 w-8 text-slate-400 hover:text-red-400 hover:bg-red-950/20"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto min-h-screen">
        {/* Desktop Header */}
        <header className="hidden md:flex items-center justify-between px-6 py-3.5 bg-slate-900/80 backdrop-blur border-b border-slate-800 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold text-white">
              {navItems.find((n) => n.path === location.pathname)?.title || 'Checklist de Içamento'}
            </h2>
            <Badge
              variant="secondary"
              className="bg-slate-800 text-slate-300 border-slate-700 text-xs"
            >
              {company?.trade_name || company?.name || 'GEB Rigging'}
            </Badge>
          </div>

          <div className="flex items-center gap-3">
            <OfflineSyncBar />
          </div>
        </header>

        {/* Dynamic Page Container */}
        <div className="p-4 md:p-6 flex-1 bg-slate-950">{children}</div>
      </main>
    </div>
  )
}
