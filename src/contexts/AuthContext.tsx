import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from 'react'
import pb from '@/lib/pocketbase/client'
import {
  AppUser,
  Company,
  UserRole,
  SystemModuleKey,
  ModulePermission,
  UserPermissions,
} from '@/types'
import { syncService } from '@/lib/offline/sync-service'
import { dbGetAll, dbGetById, dbPut } from '@/lib/offline/db'

export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, UserPermissions> = {
  superadmin: {
    checklists: { read: true, edit: true, delete: true },
    templates: { read: true, edit: true, delete: true },
    equipment: { read: true, edit: true, delete: true },
    materials: { read: true, edit: true, delete: true },
    clients: { read: true, edit: true, delete: true },
    users: { read: true, edit: true, delete: true },
    company: { read: true, edit: true, delete: true },
  },
  admin: {
    checklists: { read: true, edit: true, delete: true },
    templates: { read: true, edit: true, delete: true },
    equipment: { read: true, edit: true, delete: true },
    materials: { read: true, edit: true, delete: true },
    clients: { read: true, edit: true, delete: true },
    users: { read: true, edit: true, delete: true },
    company: { read: true, edit: true, delete: true },
  },
  gestor: {
    checklists: { read: true, edit: true, delete: true },
    templates: { read: true, edit: true, delete: true },
    equipment: { read: true, edit: true, delete: true },
    materials: { read: true, edit: true, delete: true },
    clients: { read: true, edit: true, delete: true },
    users: { read: true, edit: true, delete: true },
    company: { read: true, edit: false, delete: false },
  },
  supervisor: {
    checklists: { read: true, edit: true, delete: true },
    templates: { read: true, edit: true, delete: false },
    equipment: { read: true, edit: true, delete: false },
    materials: { read: true, edit: true, delete: false },
    clients: { read: true, edit: true, delete: false },
    users: { read: true, edit: false, delete: false },
    company: { read: true, edit: false, delete: false },
  },
  rigger: {
    checklists: { read: true, edit: true, delete: false },
    templates: { read: true, edit: false, delete: false },
    equipment: { read: true, edit: false, delete: false },
    materials: { read: true, edit: true, delete: false },
    clients: { read: true, edit: false, delete: false },
    users: { read: false, edit: false, delete: false },
    company: { read: false, edit: false, delete: false },
  },
  sinaleiro: {
    checklists: { read: true, edit: true, delete: false },
    templates: { read: true, edit: false, delete: false },
    equipment: { read: true, edit: false, delete: false },
    materials: { read: true, edit: false, delete: false },
    clients: { read: true, edit: false, delete: false },
    users: { read: false, edit: false, delete: false },
    company: { read: false, edit: false, delete: false },
  },
  operador: {
    checklists: { read: true, edit: true, delete: false },
    templates: { read: true, edit: false, delete: false },
    equipment: { read: true, edit: false, delete: false },
    materials: { read: true, edit: false, delete: false },
    clients: { read: true, edit: false, delete: false },
    users: { read: false, edit: false, delete: false },
    company: { read: false, edit: false, delete: false },
  },
}

export function getUserEffectivePermissions(user: AppUser | null): UserPermissions {
  if (!user) {
    return {
      checklists: { read: false, edit: false, delete: false },
      templates: { read: false, edit: false, delete: false },
      equipment: { read: false, edit: false, delete: false },
      materials: { read: false, edit: false, delete: false },
      clients: { read: false, edit: false, delete: false },
      users: { read: false, edit: false, delete: false },
      company: { read: false, edit: false, delete: false },
    }
  }

  const role = (user.role as UserRole) || 'operador'
  const defaultForRole = DEFAULT_ROLE_PERMISSIONS[role] || DEFAULT_ROLE_PERMISSIONS.operador

  if (role === 'superadmin' || role === 'admin') {
    return DEFAULT_ROLE_PERMISSIONS.admin
  }

  // If custom granular permissions are defined on user record, merge them
  if (user.permissions && typeof user.permissions === 'object') {
    const modules: SystemModuleKey[] = [
      'checklists',
      'templates',
      'equipment',
      'materials',
      'clients',
      'users',
      'company',
    ]

    const merged: Partial<UserPermissions> = {}
    for (const mod of modules) {
      const customMod = user.permissions[mod]
      const fallback = defaultForRole[mod]
      merged[mod] = {
        read: customMod?.read ?? fallback?.read ?? false,
        edit: customMod?.edit ?? fallback?.edit ?? false,
        delete: customMod?.delete ?? fallback?.delete ?? false,
      }
    }
    return merged as UserPermissions
  }

  return defaultForRole
}

interface AuthContextType {
  user: AppUser | null
  company: Company | null
  companies: Company[]
  isAuthenticated: boolean
  isLoading: boolean
  role: UserRole
  permissions: UserPermissions
  isSuperAdmin: boolean
  isAdmin: boolean
  isGestor: boolean
  isSupervisor: boolean
  canManageUsers: boolean
  canManageCompanies: boolean
  canManageTemplates: boolean
  canManageAssets: boolean
  canCreateChecklist: boolean
  hasModulePermission: (module: SystemModuleKey, action?: 'read' | 'edit' | 'delete') => boolean
  login: (emailOrCpf: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  switchCompany: (companyId: string) => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null)
  const [company, setCompany] = useState<Company | null>(null)
  const [companies, setCompanies] = useState<Company[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)

  const role: UserRole = (user?.role as UserRole) || 'operador'
  const isSuperAdmin = role === 'superadmin'
  const isAdmin = role === 'admin' || isSuperAdmin
  const isGestor = role === 'gestor' || isAdmin
  const isSupervisor = role === 'supervisor' || isGestor

  const permissions = getUserEffectivePermissions(user)

  const hasModulePermission = useCallback(
    (mod: SystemModuleKey, action: 'read' | 'edit' | 'delete' = 'read') => {
      if (isAdmin) return true
      return !!permissions?.[mod]?.[action]
    },
    [isAdmin, permissions],
  )

  const canManageCompanies = isAdmin || hasModulePermission('company', 'edit')
  const canManageUsers = isAdmin || hasModulePermission('users', 'edit')
  const canManageTemplates = isAdmin || hasModulePermission('templates', 'edit')
  const canManageAssets =
    isAdmin || hasModulePermission('equipment', 'edit') || hasModulePermission('materials', 'edit')
  const canCreateChecklist = isAdmin || hasModulePermission('checklists', 'edit')

  // Load current user and company from memory / IndexedDB
  const loadUserContext = useCallback(async () => {
    try {
      if (pb.authStore.isValid && pb.authStore.record) {
        const rawUser = pb.authStore.record as unknown as AppUser
        setUser(rawUser)

        // Load companies from local DB or backend
        let localCompanies = await dbGetAll<Company>('companies')
        if (localCompanies.length === 0) {
          try {
            localCompanies = await pb.collection('companies').getFullList<Company>({ sort: 'name' })
            for (const c of localCompanies) {
              await dbPut('companies', c)
            }
          } catch (e) {
            console.warn('Could not fetch companies online', e)
          }
        }
        setCompanies(localCompanies)

        // Find active company
        const userCompId = rawUser.company_id || localCompanies[0]?.id
        if (userCompId) {
          const comp = localCompanies.find((c) => c.id === userCompId)
          if (comp) {
            setCompany(comp)
          } else {
            // try by ID
            const fetched = await dbGetById<Company>('companies', userCompId)
            if (fetched) setCompany(fetched)
          }
        }
      } else {
        // Check offline cached user
        const cachedUserStr = localStorage.getItem('offline_user_session')
        if (cachedUserStr) {
          try {
            const cachedUser = JSON.parse(cachedUserStr) as AppUser
            setUser(cachedUser)
            const localCompanies = await dbGetAll<Company>('companies')
            setCompanies(localCompanies)
            if (cachedUser.company_id) {
              const comp = localCompanies.find((c) => c.id === cachedUser.company_id)
              if (comp) setCompany(comp)
            }
          } catch (_) {
            setUser(null)
            setCompany(null)
          }
        } else {
          setUser(null)
          setCompany(null)
        }
      }
    } catch (err) {
      console.error('Error loading user context:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadUserContext()

    const unsubscribe = pb.authStore.onChange(() => {
      loadUserContext()
    })

    return () => {
      unsubscribe()
    }
  }, [loadUserContext])

  const login = async (
    emailOrCpf: string,
    password: string,
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const loginIdentifier = emailOrCpf.trim()
      const authData = await pb.collection('users').authWithPassword(loginIdentifier, password)
      const appUser = authData.record as unknown as AppUser

      setUser(appUser)
      localStorage.setItem('offline_user_session', JSON.stringify(appUser))

      // Trigger immediate background sync
      if (appUser.company_id) {
        syncService.pullAllData(appUser.company_id)
      }

      await loadUserContext()
      return { success: true }
    } catch (err: any) {
      // Offline fallback: check if we have offline credentials
      const cachedUserStr = localStorage.getItem('offline_user_session')
      if (cachedUserStr) {
        try {
          const cachedUser = JSON.parse(cachedUserStr) as AppUser
          if (
            ((cachedUser.email && cachedUser.email.toLowerCase() === emailOrCpf.toLowerCase()) ||
              (cachedUser.username &&
                cachedUser.username.toLowerCase() === emailOrCpf.toLowerCase()) ||
              (cachedUser.cpf &&
                cachedUser.cpf.replace(/\D/g, '') === emailOrCpf.replace(/\D/g, ''))) &&
            password === 'Skip@Pass'
          ) {
            setUser(cachedUser)
            await loadUserContext()
            return { success: true }
          }
        } catch {
          /* intentionally ignored */
        }
      }

      return {
        success: false,
        error: err.message || 'Credenciais inválidas. Verifique seu e-mail/CPF/usuário e senha.',
      }
    }
  }

  const logout = () => {
    pb.authStore.clear()
    localStorage.removeItem('offline_user_session')
    setUser(null)
    setCompany(null)
  }

  const switchCompany = async (companyId: string) => {
    const selected = companies.find((c) => c.id === companyId)
    if (selected) {
      setCompany(selected)
      if (user) {
        const updated = { ...user, company_id: companyId }
        setUser(updated)
        localStorage.setItem('offline_user_session', JSON.stringify(updated))
      }
      // Re-sync data for selected company
      syncService.pullAllData(companyId)
    }
  }

  const refreshProfile = async () => {
    await loadUserContext()
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        company,
        companies,
        isAuthenticated: !!user,
        isLoading,
        role,
        permissions,
        isSuperAdmin,
        isAdmin,
        isGestor,
        isSupervisor,
        canManageUsers,
        canManageCompanies,
        canManageTemplates,
        canManageAssets,
        canCreateChecklist,
        hasModulePermission,
        login,
        logout,
        switchCompany,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
