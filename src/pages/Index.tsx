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
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <span className="text-xs text-slate-400">Carregando DAVI PROJETOS CHECKLIST...</span>
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
