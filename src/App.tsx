import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
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
import NotFound from './pages/NotFound'
import { Loader2 } from 'lucide-react'

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth()

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
              <ProtectedRoute>
                <ChecklistsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/checklists/novo"
            element={
              <ProtectedRoute>
                <ChecklistDetailPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/checklists/:id"
            element={
              <ProtectedRoute>
                <ChecklistDetailPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/modelos"
            element={
              <ProtectedRoute>
                <TemplatesPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/equipamentos"
            element={
              <ProtectedRoute>
                <EquipmentPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/materiais"
            element={
              <ProtectedRoute>
                <MaterialsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/clientes"
            element={
              <ProtectedRoute>
                <ClientsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/usuarios"
            element={
              <ProtectedRoute>
                <UsersPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/empresa"
            element={
              <ProtectedRoute>
                <CompanyPage />
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
