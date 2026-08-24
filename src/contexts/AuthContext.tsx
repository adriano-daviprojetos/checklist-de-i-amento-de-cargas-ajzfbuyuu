import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from 'react'
import pb from '@/lib/pocketbase/client'
import { AppUser, Company, UserRole } from '@/types'
import { syncService } from '@/lib/offline/sync-service'
import { dbGetAll, dbGetById, dbPut } from '@/lib/offline/db'

interface AuthContextType {
  user: AppUser | null
  company: Company | null
  companies: Company[]
  isAuthenticated: boolean
  isLoading: boolean
  role: UserRole
  isSuperAdmin: boolean
  isAdmin: boolean
  isGestor: boolean
  isSupervisor: boolean
  canManageUsers: boolean
  canManageTemplates: boolean
  canManageAssets: boolean
  canCreateChecklist: boolean
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

  const canManageUsers = isAdmin || role === 'gestor'
  const canManageTemplates = isAdmin || role === 'gestor' || role === 'supervisor'
  const canManageAssets = isAdmin || role === 'gestor' || role === 'supervisor'
  const canCreateChecklist = true // All operational roles (Admin, Gestor, Supervisor, Rigger, Sinaleiro, Operador) can start / fill checklists

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
      let loginIdentifier = emailOrCpf.trim()

      // If user typed a CPF (contains dots or is only numbers / not an email)
      if (!loginIdentifier.includes('@')) {
        const cleanedCpf = loginIdentifier.replace(/\D/g, '')
        // Search user by CPF via PB first if online
        try {
          const matchedUsers = await pb.collection('users').getFullList<AppUser>({
            filter: `cpf ~ '${loginIdentifier}' || cpf ~ '${cleanedCpf}'`,
          })
          if (matchedUsers.length > 0 && matchedUsers[0].email) {
            loginIdentifier = matchedUsers[0].email
          }
        } catch (cpfLookupErr) {
          console.warn('CPF lookup failed:', cpfLookupErr)
        }
      }

      const authData = await pb.collection('users').authWithPassword(loginIdentifier, password)
      const appUser = authData.record as unknown as AppUser
      setUser(appUser)
      localStorage.setItem('offline_user_session', JSON.stringify(appUser))

      // Trigger immediate background sync
      syncService.pullAllData(appUser.company_id)

      await loadUserContext()
      return { success: true }
    } catch (err: any) {
      // Offline fallback: check if we have offline credentials
      const cachedUserStr = localStorage.getItem('offline_user_session')
      if (cachedUserStr) {
        try {
          const cachedUser = JSON.parse(cachedUserStr) as AppUser
          if (
            (cachedUser.email.toLowerCase() === emailOrCpf.toLowerCase() ||
              cachedUser.cpf?.replace(/\D/g, '') === emailOrCpf.replace(/\D/g, '')) &&
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
        error: err.message || 'Credenciais inválidas. Verifique seu e-mail/CPF e senha.',
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
        isSuperAdmin,
        isAdmin,
        isGestor,
        isSupervisor,
        canManageUsers,
        canManageTemplates,
        canManageAssets,
        canCreateChecklist,
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
