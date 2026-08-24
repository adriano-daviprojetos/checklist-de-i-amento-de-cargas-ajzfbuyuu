import React from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { LoginModal } from '@/components/LoginModal'
import { SidebarLayout } from '@/components/SidebarLayout'
import { DashboardPage } from './DashboardPage'
import { Loader2 } from 'lucide-react'

export default function Index() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white p-4">
        <div className="flex flex-col items-center gap-4 max-w-xs text-center">
          <img
            src="/logo.svg"
            alt="DAVI PROJETOS CHECKLIST"
            className="w-48 h-auto object-contain animate-pulse"
          />
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
            <span>Carregando sistema...</span>
          </div>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <LoginModal />
  }

  return (
    <SidebarLayout>
      <DashboardPage />
    </SidebarLayout>
  )
}
