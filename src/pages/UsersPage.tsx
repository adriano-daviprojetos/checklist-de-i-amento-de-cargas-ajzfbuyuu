import React, { useState, useEffect } from 'react'
import { useAuth, DEFAULT_ROLE_PERMISSIONS } from '@/contexts/AuthContext'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { AppDataService } from '@/services/appDataService'
import { AppUser, UserRole, SystemModuleKey, UserPermissions, ModulePermission } from '@/types'
import { CompanySelect } from '@/components/CompanySelect'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Users,
  Plus,
  Search,
  ShieldCheck,
  UserCheck,
  Edit2,
  Trash2,
  HardHat,
  Truck,
  Anchor,
  Radio,
  KeyRound,
  Eye,
  EyeOff,
  SlidersHorizontal,
  CheckCircle2,
  Lock,
  Building2,
  FileSpreadsheet,
  ClipboardCheck,
  Building,
} from 'lucide-react'
import { toast } from 'sonner'

interface ModuleConfig {
  key: SystemModuleKey
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}

const SYSTEM_MODULES: ModuleConfig[] = [
  {
    key: 'checklists',
    label: 'Checklists de Içamento',
    description: 'Preenchimento, inspeção e aprovação de checklists em campo',
    icon: ClipboardCheck,
  },
  {
    key: 'templates',
    label: 'Modelos de Inspeção',
    description: 'Criação e edição de checklists padrão e itens de checagem',
    icon: FileSpreadsheet,
  },
  {
    key: 'equipment',
    label: 'Equipamentos (Guindastes / Muncks)',
    description: 'Cadastro da frota de guindastes, muncks e caminhões',
    icon: Truck,
  },
  {
    key: 'materials',
    label: 'Materiais & Acessórios',
    description: 'Cintas, cabos de aço, manilhas, ganchos e balancins',
    icon: Anchor,
  },
  {
    key: 'clients',
    label: 'Clientes & Obras',
    description: 'Gestão de clientes, locais de içamento e contatos',
    icon: Building2,
  },
  {
    key: 'users',
    label: 'Usuários & Perfis',
    description: 'Gestão da equipe, operadores e credenciais de acesso',
    icon: Users,
  },
  {
    key: 'company',
    label: 'Dados da Empresa',
    description: 'Configurações corporativas, CNPJ e filiais',
    icon: Building,
  },
]

export const UsersPage: React.FC = () => {
  const {
    company,
    companies,
    isAdmin,
    isGestor,
    user: currentUser,
    hasModulePermission,
  } = useAuth()
  const { isOnline } = useOnlineStatus()

  const canEditUsers = hasModulePermission('users', 'edit')
  const canDeleteUsers = hasModulePermission('users', 'delete')

  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(company?.id || '')
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [cpf, setCpf] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState<UserRole>('operador')

  // Password fields
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPasswordChange, setShowPasswordChange] = useState(false)
  const [showPasswordText, setShowPasswordText] = useState(false)
  const [showConfirmPasswordText, setShowConfirmPasswordText] = useState(false)

  // Module Permissions Matrix
  const [permissions, setPermissions] = useState<UserPermissions>(() =>
    structuredClone(DEFAULT_ROLE_PERMISSIONS.operador),
  )

  const canEditPermissions = isAdmin || isGestor

  useEffect(() => {
    loadUsers()
  }, [company?.id, isOnline])

  const loadUsers = async () => {
    setLoading(true)
    try {
      const data = await AppDataService.getUsers(company?.id, isOnline)
      setUsers(data)
    } catch (err) {
      console.error('Error loading users:', err)
    } finally {
      setLoading(false)
    }
  }

  // Permission helper to check if current logged-in user can edit a specific user target
  const canEditTargetUser = (targetUser: AppUser) => {
    if (!canEditUsers) return false
    if (isAdmin) return true
    // Gestor can only edit users from their own company
    return company?.id ? targetUser.company_id === company.id : false
  }

  // Permission helper to check if current logged-in user can delete a specific user target
  const canDeleteTargetUser = (targetUser: AppUser) => {
    if (!canDeleteUsers) return false
    if (isAdmin) return true
    // Gestor can only delete users from their own company
    return company?.id ? targetUser.company_id === company.id : false
  }

  const openNewModal = () => {
    if (!canEditUsers) {
      toast.error('Você não tem permissão para cadastrar usuários.')
      return
    }
    setEditingId(null)
    setSelectedCompanyId(company?.id || companies[0]?.id || '')
    setName('')
    setUsername('')
    setEmail('')
    setCpf('')
    setPhone('')
    const initialRole: UserRole = 'operador'
    setRole(initialRole)
    setPassword('')
    setConfirmPassword('')
    setShowPasswordChange(false)
    setShowPasswordText(false)
    setShowConfirmPasswordText(false)

    // Set default permissions according to initial role
    const initialPerms = DEFAULT_ROLE_PERMISSIONS[initialRole] || DEFAULT_ROLE_PERMISSIONS.operador
    setPermissions(structuredClone(initialPerms))

    setIsModalOpen(true)
  }

  const openEditModal = (u: AppUser) => {
    if (!canEditTargetUser(u)) {
      toast.error('Você só tem permissão para gerenciar usuários da sua empresa.')
      return
    }
    setEditingId(u.id)
    setSelectedCompanyId(isAdmin ? u.company_id || company?.id || '' : company?.id || '')
    setName(u.name || '')
    setUsername(u.username || '')
    setEmail(u.email || '')
    setCpf(u.cpf || '')
    setPhone(u.phone || '')
    const userRole = u.role || 'operador'
    setRole(userRole)

    setPassword('')
    setConfirmPassword('')
    setShowPasswordChange(false)
    setShowPasswordText(false)
    setShowConfirmPasswordText(false)

    // Load custom permissions or fallback to role defaults
    const defaultForRole = DEFAULT_ROLE_PERMISSIONS[userRole] || DEFAULT_ROLE_PERMISSIONS.operador
    const initialPerms: Partial<UserPermissions> = {}

    SYSTEM_MODULES.forEach((mod) => {
      const customMod = u.permissions?.[mod.key]
      const fallback = defaultForRole[mod.key]
      initialPerms[mod.key] = {
        read: customMod?.read ?? fallback?.read ?? false,
        edit: customMod?.edit ?? fallback?.edit ?? false,
        delete: customMod?.delete ?? fallback?.delete ?? false,
      }
    })

    setPermissions(initialPerms as UserPermissions)
    setIsModalOpen(true)
  }

  // Handle role change and automatically suggest role default permissions
  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole)
    const defaultForRole = DEFAULT_ROLE_PERMISSIONS[newRole] || DEFAULT_ROLE_PERMISSIONS.operador
    setPermissions(structuredClone(defaultForRole))
  }

  // Toggle permission helper
  const handlePermissionToggle = (
    moduleKey: SystemModuleKey,
    action: keyof ModulePermission,
    checked: boolean,
  ) => {
    if (!canEditPermissions) return

    setPermissions((prev) => {
      const currentMod = prev[moduleKey] || { read: false, edit: false, delete: false }
      const updatedMod = { ...currentMod, [action]: checked }

      // If user enables edit or delete, automatically enable read
      if ((action === 'edit' || action === 'delete') && checked) {
        updatedMod.read = true
      }
      // If user unchecks read, automatically disable edit and delete
      if (action === 'read' && !checked) {
        updatedMod.edit = false
        updatedMod.delete = false
      }

      return {
        ...prev,
        [moduleKey]: updatedMod,
      }
    })
  }

  // Quick preset helper
  const handleApplyRoleDefaults = () => {
    const defaultForRole = DEFAULT_ROLE_PERMISSIONS[role] || DEFAULT_ROLE_PERMISSIONS.operador
    setPermissions(structuredClone(defaultForRole))
    toast.info(`Permissões restauradas para o padrão do perfil: ${role.toUpperCase()}`)
  }

  const handleGrantAll = () => {
    if (!canEditPermissions) return
    const allPerms: Partial<UserPermissions> = {}
    SYSTEM_MODULES.forEach((m) => {
      allPerms[m.key] = { read: true, edit: true, delete: true }
    })
    setPermissions(allPerms as UserPermissions)
  }

  const handleClearAll = () => {
    if (!canEditPermissions) return
    const allPerms: Partial<UserPermissions> = {}
    SYSTEM_MODULES.forEach((m) => {
      allPerms[m.key] = { read: false, edit: false, delete: false }
    })
    setPermissions(allPerms as UserPermissions)
  }

  const handleDeleteUser = async (u: AppUser) => {
    if (!canDeleteTargetUser(u)) {
      toast.error('Você não tem permissão para excluir este usuário.')
      return
    }
    if (u.id === currentUser?.id) {
      toast.warning('Você não pode excluir seu próprio usuário logado.')
      return
    }
    if (!confirm(`Deseja realmente remover o usuário "${u.name || u.username || u.email}"?`)) {
      return
    }
    try {
      await AppDataService.deleteUser(u.id)
      toast.success('Usuário removido com sucesso.')
      await loadUsers()
    } catch (err: any) {
      toast.error('Erro ao excluir usuário: ' + err.message)
    }
  }

  const handleSave = async () => {
    if (!canEditUsers) {
      toast.error('Você não tem permissão para cadastrar ou editar usuários.')
      return
    }

    if (!name.trim() || !username.trim() || !cpf.trim()) {
      toast.warning('Nome, nome de usuário e CPF são obrigatórios.')
      return
    }

    // Gestor is strictly forced to their own company
    const finalCompanyId = isAdmin ? selectedCompanyId : company?.id || selectedCompanyId

    if (!finalCompanyId) {
      toast.warning('A seleção da empresa é obrigatória.')
      return
    }

    // Password validation for new user
    if (!editingId) {
      if (!password.trim()) {
        toast.warning('Informe a senha para o novo usuário.')
        return
      }
      if (password.trim().length < 8) {
        toast.warning('A senha deve conter no mínimo 8 caracteres.')
        return
      }
      if (password !== confirmPassword) {
        toast.warning('A confirmação de senha não confere com a senha digitada.')
        return
      }
    }

    // Password validation for editing user (if password change enabled)
    if (editingId && showPasswordChange) {
      if (!password.trim()) {
        toast.warning('Informe a nova senha.')
        return
      }
      if (password.trim().length < 8) {
        toast.warning('A nova senha deve possuir no mínimo 8 caracteres.')
        return
      }
      if (password !== confirmPassword) {
        toast.warning('A confirmação da nova senha não confere.')
        return
      }
    }

    try {
      const payload: Partial<AppUser> & {
        password?: string
        newPassword?: string
        passwordConfirm?: string
      } = {
        id: editingId || undefined,
        name: name.trim(),
        username: username.trim() || undefined,
        email: email.trim() || undefined,
        cpf: cpf.trim() || undefined,
        phone: phone.trim() || undefined,
        role,
        company_id: finalCompanyId,
        permissions,
        active: true,
      }

      if (!editingId) {
        payload.password = password.trim()
        payload.passwordConfirm = confirmPassword.trim()
      } else if (showPasswordChange && password.trim()) {
        payload.newPassword = password.trim()
        payload.passwordConfirm = confirmPassword.trim()
      }

      await AppDataService.saveUser(payload)
      toast.success(
        editingId ? 'Usuário e permissões atualizados com sucesso!' : 'Usuário criado com sucesso!',
      )
      setIsModalOpen(false)
      await loadUsers()
    } catch (err: any) {
      console.error('Error saving user:', err)
      toast.error('Erro ao salvar usuário: ' + (err.message || 'Erro inesperado'))
    }
  }

  const getRoleBadge = (r?: UserRole) => {
    switch (r) {
      case 'superadmin':
      case 'admin':
        return (
          <Badge className="bg-blue-950 text-blue-400 border border-blue-800 text-[10px]">
            <ShieldCheck className="w-3 h-3 mr-1" /> Administrador
          </Badge>
        )
      case 'gestor':
        return (
          <Badge className="bg-purple-950 text-purple-400 border border-purple-800 text-[10px]">
            <UserCheck className="w-3 h-3 mr-1" /> Gestor
          </Badge>
        )
      case 'supervisor':
        return (
          <Badge className="bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px]">
            <HardHat className="w-3 h-3 mr-1" /> Supervisor
          </Badge>
        )
      case 'rigger':
        return (
          <Badge className="bg-amber-950 text-amber-400 border border-amber-800 text-[10px]">
            <Anchor className="w-3 h-3 mr-1" /> Rigger
          </Badge>
        )
      case 'sinaleiro':
        return (
          <Badge className="bg-cyan-950 text-cyan-400 border border-cyan-800 text-[10px]">
            <Radio className="w-3 h-3 mr-1" /> Sinaleiro
          </Badge>
        )
      default:
        return (
          <Badge className="bg-slate-800 text-slate-300 border border-slate-700 text-[10px]">
            <Truck className="w-3 h-3 mr-1" /> Operador
          </Badge>
        )
    }
  }

  const filtered = users
    .filter((u) => (company?.id ? u.company_id === company.id : true))
    .filter(
      (u) =>
        u.name?.toLowerCase().includes(search.toLowerCase()) ||
        u.username?.toLowerCase().includes(search.toLowerCase()) ||
        (u.email && u.email.toLowerCase().includes(search.toLowerCase())) ||
        u.cpf?.includes(search) ||
        u.role?.toLowerCase().includes(search.toLowerCase()),
    )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-500" />
            Usuários e Níveis de Acesso
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Gestão de operadores, riggers, sinaleiros, supervisores e gestores da empresa.
          </p>
        </div>

        {canEditUsers && (
          <Button
            onClick={openNewModal}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-md shadow-blue-500/20 text-xs"
          >
            <Plus className="w-4 h-4 mr-1.5" /> Novo Usuário
          </Button>
        )}
      </div>

      {/* Role Explanations Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
        <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
          <div className="font-semibold text-blue-400">Admin</div>
          <p className="text-[10px] text-slate-400 mt-0.5">Acesso total e gestão da empresa</p>
        </div>
        <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
          <div className="font-semibold text-purple-400">Gestor</div>
          <p className="text-[10px] text-slate-400 mt-0.5">Gerencia frota, modelos e time</p>
        </div>
        <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
          <div className="font-semibold text-emerald-400">Supervisor</div>
          <p className="text-[10px] text-slate-400 mt-0.5">Aprova checklists e inspeções</p>
        </div>
        <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
          <div className="font-semibold text-amber-400">Rigger</div>
          <p className="text-[10px] text-slate-400 mt-0.5">Inspeção de lingadas e amarrações</p>
        </div>
        <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
          <div className="font-semibold text-cyan-400">Sinaleiro</div>
          <p className="text-[10px] text-slate-400 mt-0.5">Comunicação e sinalização segura</p>
        </div>
        <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
          <div className="font-semibold text-slate-300">Operador</div>
          <p className="text-[10px] text-slate-400 mt-0.5">Checklist pré-uso de guindaste</p>
        </div>
      </div>

      {/* Search */}
      <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            placeholder="Buscar por nome, e-mail, CPF ou perfil..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-slate-950 border-slate-800 text-white text-xs"
          />
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((u) => (
          <Card
            key={u.id}
            className="bg-slate-900 border-slate-800 hover:border-slate-700 transition"
          >
            <CardContent className="p-5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold text-white text-base leading-tight">{u.name}</h3>
                  {u.email ? (
                    <p className="text-xs text-slate-400 mt-0.5">{u.email}</p>
                  ) : (
                    <p className="text-xs text-slate-500 italic mt-0.5">Sem e-mail</p>
                  )}
                </div>
                {getRoleBadge(u.role)}
              </div>

              <div className="space-y-1.5 text-xs text-slate-300 pt-1">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Empresa:</span>
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-slate-950 border-slate-800 text-slate-300 font-normal"
                  >
                    {companies.find((c) => c.id === u.company_id)?.trade_name ||
                      companies.find((c) => c.id === u.company_id)?.name ||
                      company?.name ||
                      'Empresa Padrão'}
                  </Badge>
                </div>
                {u.username && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Usuário:</span>
                    <span className="font-mono text-blue-300">@{u.username}</span>
                  </div>
                )}
                {u.cpf && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">CPF:</span>
                    <span className="font-mono text-slate-300">{u.cpf}</span>
                  </div>
                )}
                {u.phone && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Telefone:</span>
                    <span>{u.phone}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">Status:</span>
                  <span className="text-emerald-400 font-medium">Ativo</span>
                </div>
              </div>

              {(canEditTargetUser(u) || (canDeleteTargetUser(u) && u.id !== currentUser?.id)) && (
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                  {canEditTargetUser(u) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openEditModal(u)}
                      className="h-7 text-xs text-slate-300 hover:text-white"
                    >
                      <Edit2 className="w-3.5 h-3.5 mr-1" /> Editar
                    </Button>
                  )}
                  {canDeleteTargetUser(u) && u.id !== currentUser?.id && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteUser(u)}
                      className="h-7 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/20"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" /> Excluir
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {filtered.length === 0 && (
          <div className="col-span-full p-12 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-xl text-xs">
            Nenhum usuário cadastrado nesta empresa.
          </div>
        )}
      </div>

      {/* Modal: Add / Edit User */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-5 pb-3 border-b border-slate-800 shrink-0">
            <DialogTitle className="text-white text-base flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-500" />
              {editingId ? 'Editar Usuário e Permissões' : 'Cadastrar Novo Usuário'}
            </DialogTitle>
          </DialogHeader>

          <div className="overflow-y-auto px-5 py-4 space-y-5 flex-1 pr-4">
            {/* Empresa Selector */}
            <CompanySelect
              value={selectedCompanyId}
              onChange={setSelectedCompanyId}
              required
              label="Empresa Vinculada"
            />

            {/* Basic Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">Nome Completo *</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Carlos Eduardo Silva"
                  className="bg-slate-950 border-slate-800 text-white text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">Nome de Usuário (username) *</Label>
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="ex: carlos.silva ou carloss"
                  className="bg-slate-950 border-slate-800 text-white text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">E-mail (Opcional)</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="carlos@empresa.com.br (Opcional)"
                  className="bg-slate-950 border-slate-800 text-white text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">CPF (Obrigatório) *</Label>
                <Input
                  value={cpf}
                  onChange={(e) => setCpf(e.target.value)}
                  placeholder="000.000.000-00"
                  className="bg-slate-950 border-slate-800 text-white text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">Telefone / WhatsApp</Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(11) 98765-4321"
                  className="bg-slate-950 border-slate-800 text-white text-xs"
                />
              </div>
            </div>

            {/* Perfil / Role */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-slate-300">
                  Perfil de Acesso (Função Principal) *
                </Label>
                <span className="text-[11px] text-slate-400">
                  Define o conjunto base de permissões
                </span>
              </div>
              <Select value={role} onValueChange={(val: any) => handleRoleChange(val)}>
                <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                  <SelectItem value="operador">
                    Operador (Preenche checklists do guindaste/munck)
                  </SelectItem>
                  <SelectItem value="rigger">
                    Rigger (Inspeção técnica de acessórios e lingadas)
                  </SelectItem>
                  <SelectItem value="sinaleiro">
                    Sinaleiro (Sinalização e comunicação de içamento)
                  </SelectItem>
                  <SelectItem value="supervisor">
                    Supervisor (Cria/revisa checklists e gerencia inspeções)
                  </SelectItem>
                  <SelectItem value="gestor">
                    Gestor (Gerencia usuários da empresa, ativos e modelos)
                  </SelectItem>
                  {isAdmin && (
                    <SelectItem value="admin">Administrador (Acesso total à empresa)</SelectItem>
                  )}
                  {isAdmin && (
                    <SelectItem value="superadmin">Super Admin (Acesso global)</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* PASSWORD SECTION */}
            <div className="p-3.5 rounded-lg bg-slate-950/70 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-semibold text-slate-200">
                    {editingId ? 'Segurança & Senha de Acesso' : 'Definir Senha de Acesso *'}
                  </span>
                </div>

                {editingId && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowPasswordChange(!showPasswordChange)
                      if (!showPasswordChange) {
                        setPassword('')
                        setConfirmPassword('')
                      }
                    }}
                    className={`h-7 text-xs border-slate-800 ${
                      showPasswordChange
                        ? 'bg-amber-600/20 text-amber-300 border-amber-500/30'
                        : 'bg-slate-900 text-slate-300 hover:text-white'
                    }`}
                  >
                    {showPasswordChange ? 'Cancelar Alteração' : 'Alterar Senha'}
                  </Button>
                )}
              </div>

              {/* In Create mode OR when Edit mode has showPasswordChange toggled */}
              {(!editingId || showPasswordChange) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-300">
                      {editingId ? 'Nova Senha *' : 'Senha *'}
                    </Label>
                    <div className="relative">
                      <Input
                        type={showPasswordText ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Mínimo 8 caracteres"
                        className="bg-slate-900 border-slate-800 text-white text-xs pr-9"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswordText(!showPasswordText)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                        tabIndex={-1}
                      >
                        {showPasswordText ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-300">
                      {editingId ? 'Confirmar Nova Senha *' : 'Confirmar Senha *'}
                    </Label>
                    <div className="relative">
                      <Input
                        type={showConfirmPasswordText ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repita a senha"
                        className={`bg-slate-900 border-slate-800 text-white text-xs pr-9 ${
                          confirmPassword && password !== confirmPassword
                            ? 'border-red-500 focus:border-red-500'
                            : ''
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPasswordText(!showConfirmPasswordText)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                        tabIndex={-1}
                      >
                        {showConfirmPasswordText ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                    {confirmPassword && password !== confirmPassword && (
                      <p className="text-[10px] text-red-400">As senhas digitadas não coincidem.</p>
                    )}
                  </div>
                </div>
              )}

              {editingId && !showPasswordChange && (
                <p className="text-[11px] text-slate-400">
                  A senha do usuário permanece a mesma cadastrada atualmente. Clique em
                  &quot;Alterar Senha&quot; se desejar redefinir.
                </p>
              )}
            </div>

            {/* MODULE PERMISSIONS MATRIX */}
            <div className="space-y-3 pt-1">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-blue-400" />
                    <h4 className="text-xs font-semibold text-slate-200">
                      Matriz de Permissões por Módulo
                    </h4>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Controle granular de acesso para cada módulo do sistema
                  </p>
                </div>

                {canEditPermissions && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleApplyRoleDefaults}
                      className="h-6 px-2 text-[10px] text-slate-400 hover:text-white"
                      title="Restaurar valores padrão da função selecionada"
                    >
                      Padrão da Função
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleGrantAll}
                      className="h-6 px-2 text-[10px] text-emerald-400 hover:bg-emerald-950/20"
                    >
                      Marcar Tudo
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleClearAll}
                      className="h-6 px-2 text-[10px] text-red-400 hover:bg-red-950/20"
                    >
                      Limpar
                    </Button>
                  </div>
                )}
              </div>

              {!canEditPermissions && (
                <div className="p-2.5 rounded-lg bg-amber-950/30 border border-amber-900/50 text-[11px] text-amber-300 flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                  Apenas Administradores e Gestores podem alterar permissões de acesso.
                </div>
              )}

              {/* Permissions Table / Card List */}
              <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950/40">
                <div className="grid grid-cols-12 gap-2 p-2.5 bg-slate-950 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider items-center">
                  <div className="col-span-6 sm:col-span-6">Módulo</div>
                  <div className="col-span-2 text-center">Leitura</div>
                  <div className="col-span-2 text-center">Edição</div>
                  <div className="col-span-2 text-center">Exclusão</div>
                </div>

                <div className="divide-y divide-slate-800/80">
                  {SYSTEM_MODULES.map((mod) => {
                    const Icon = mod.icon
                    const modPerm = permissions[mod.key] || {
                      read: false,
                      edit: false,
                      delete: false,
                    }

                    return (
                      <div
                        key={mod.key}
                        className="grid grid-cols-12 gap-2 p-3 items-center hover:bg-slate-900/50 transition-colors"
                      >
                        <div className="col-span-6 sm:col-span-6 flex items-start gap-2.5 pr-2">
                          <div className="p-1.5 rounded-md bg-slate-900 border border-slate-800 text-blue-400 shrink-0 mt-0.5">
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-slate-200 truncate">
                              {mod.label}
                            </div>
                            <div className="text-[10px] text-slate-400 line-clamp-1">
                              {mod.description}
                            </div>
                          </div>
                        </div>

                        {/* Read Checkbox */}
                        <div className="col-span-2 flex flex-col items-center justify-center">
                          <label className="cursor-pointer flex flex-col items-center gap-1">
                            <Checkbox
                              checked={!!modPerm.read}
                              disabled={!canEditPermissions}
                              onCheckedChange={(checked) =>
                                handlePermissionToggle(mod.key, 'read', !!checked)
                              }
                              className="border-slate-700 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                            />
                            <span className="text-[9px] text-slate-400 sm:hidden">Ler</span>
                          </label>
                        </div>

                        {/* Edit Checkbox */}
                        <div className="col-span-2 flex flex-col items-center justify-center">
                          <label className="cursor-pointer flex flex-col items-center gap-1">
                            <Checkbox
                              checked={!!modPerm.edit}
                              disabled={!canEditPermissions}
                              onCheckedChange={(checked) =>
                                handlePermissionToggle(mod.key, 'edit', !!checked)
                              }
                              className="border-slate-700 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
                            />
                            <span className="text-[9px] text-slate-400 sm:hidden">Editar</span>
                          </label>
                        </div>

                        {/* Delete Checkbox */}
                        <div className="col-span-2 flex flex-col items-center justify-center">
                          <label className="cursor-pointer flex flex-col items-center gap-1">
                            <Checkbox
                              checked={!!modPerm.delete}
                              disabled={!canEditPermissions}
                              onCheckedChange={(checked) =>
                                handlePermissionToggle(mod.key, 'delete', !!checked)
                              }
                              className="border-slate-700 data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600"
                            />
                            <span className="text-[9px] text-slate-400 sm:hidden">Excluir</span>
                          </label>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="flex items-center gap-2 text-[11px] text-slate-400 pt-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>
                  Permissões ativadas concedem acesso aos menus e operações correspondentes.
                </span>
              </div>
            </div>
          </div>

          <DialogFooter className="p-4 border-t border-slate-800 bg-slate-950/80 shrink-0 flex items-center justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              className="border-slate-800 bg-slate-900 text-slate-300 text-xs hover:bg-slate-800"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium shadow-md shadow-blue-500/20"
            >
              {editingId ? 'Salvar Alterações' : 'Cadastrar Usuário'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
