import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { SystemModuleKey } from '@/types'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { SidebarLayout } from '@/components/SidebarLayout'
import { LoginModal } from '@/components/LoginModal'

// Pages
import Index from './pages/Index'
import { ChecklistsPage } from './pages/ChecklistsPage'
import { ChecklistDetailPage } from './pages/ChecklistDetailPage'
import { TemplatesPage } from './pages/TemplatesPage'
import { EquipmentPage } from './pages/EquipmentPage'
import { MaterialsPage } from './pages/MaterialsPage'
import { ClientsPage } from './pages/ClientsPage'
import { UsersPage } from './pages/UsersPage'
import { CompanyPage } from './pages/CompanyPage'
import { ProfilePage } from './pages/ProfilePage'
import NotFound from './pages/NotFound'
import { Loader2 } from 'lucide-react'

interface ProtectedRouteProps {
  children: React.ReactNode
  adminOnly?: boolean
  module?: SystemModuleKey
  action?: 'read' | 'edit' | 'delete'
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  adminOnly = false,
  module,
  action = 'read',
}) => {
  const { isAuthenticated, isLoading, canManageCompanies, hasModulePermission } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <LoginModal />
  }

  if (adminOnly && !canManageCompanies) {
    return <Navigate to="/" replace />
  }

  if (module && !hasModulePermission(module, action)) {
    return <Navigate to="/" replace />
  }

  return <SidebarLayout>{children}</SidebarLayout>
}

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner position="top-right" />
        <Routes>
          <Route path="/" element={<Index />} />

          <Route
            path="/checklists"
            element={
              <ProtectedRoute module="checklists" action="read">
                <ChecklistsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/checklists/novo"
            element={
              <ProtectedRoute module="checklists" action="edit">
                <ChecklistDetailPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/checklists/:id"
            element={
              <ProtectedRoute module="checklists" action="read">
                <ChecklistDetailPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/modelos"
            element={
              <ProtectedRoute module="templates" action="read">
                <TemplatesPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/equipamentos"
            element={
              <ProtectedRoute module="equipment" action="read">
                <EquipmentPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/materiais"
            element={
              <ProtectedRoute module="materials" action="read">
                <MaterialsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/clientes"
            element={
              <ProtectedRoute module="clients" action="read">
                <ClientsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/usuarios"
            element={
              <ProtectedRoute module="users" action="read">
                <UsersPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/empresa"
            element={
              <ProtectedRoute adminOnly>
                <CompanyPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/meu-perfil"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </TooltipProvider>
    </AuthProvider>
  </BrowserRouter>
)

export default App
