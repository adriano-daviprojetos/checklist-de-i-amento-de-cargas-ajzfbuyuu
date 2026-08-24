import React, { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { AppDataService } from '@/services/appDataService'
import { AppUser, UserRole } from '@/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
  HardHat,
  Truck,
  Anchor,
  Radio,
} from 'lucide-react'
import { toast } from 'sonner'

export const UsersPage: React.FC = () => {
  const { company, canManageUsers, isSuperAdmin } = useAuth()
  const { isOnline } = useOnlineStatus()

  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [cpf, setCpf] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState<UserRole>('operador')
  const [password, setPassword] = useState('Skip@Pass')

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

  const openNewModal = () => {
    setEditingId(null)
    setName('')
    setEmail('')
    setCpf('')
    setPhone('')
    setRole('operador')
    setPassword('Skip@Pass')
    setIsModalOpen(true)
  }

  const openEditModal = (u: AppUser) => {
    setEditingId(u.id)
    setName(u.name || '')
    setEmail(u.email)
    setCpf(u.cpf || '')
    setPhone(u.phone || '')
    setRole(u.role || 'operador')
    setPassword('')
    setIsModalOpen(true)
  }

  const handleSave = async () => {
    if (!name.trim() || !email.trim()) {
      toast.warning('Nome e e-mail são obrigatórios.')
      return
    }

    try {
      const payload: Partial<AppUser> & { password?: string } = {
        id: editingId || undefined,
        name,
        email,
        cpf,
        phone,
        role,
        company_id: company?.id || '',
        active: true,
      }

      if (!editingId && password) {
        payload.password = password
      }

      await AppDataService.saveUser(payload)
      toast.success('Usuário salvo com sucesso!')
      setIsModalOpen(false)
      await loadUsers()
    } catch (err: any) {
      toast.error('Erro ao salvar usuário: ' + err.message)
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

  const filtered = users.filter(
    (u) =>
      u.name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
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

        {canManageUsers && (
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
                  <p className="text-xs text-slate-400 mt-0.5">{u.email}</p>
                </div>
                {getRoleBadge(u.role)}
              </div>

              <div className="space-y-1.5 text-xs text-slate-300 pt-1">
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

              {canManageUsers && (
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openEditModal(u)}
                    className="h-7 text-xs text-slate-300 hover:text-white"
                  >
                    <Edit2 className="w-3.5 h-3.5 mr-1" /> Editar
                  </Button>
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
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white text-base">
              {editingId ? 'Editar Usuário' : 'Cadastrar Novo Usuário / Operador'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
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
              <Label className="text-xs text-slate-300">E-mail de Acesso *</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="carlos@empresa.com.br"
                className="bg-slate-950 border-slate-800 text-white text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">CPF (Login Alternativo)</Label>
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

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300">Perfil de Acesso (Função) *</Label>
              <Select value={role} onValueChange={(val: any) => setRole(val)}>
                <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                  <SelectItem value="operador">
                    Operador (Preenche checklists do guindaste/munck)
                  </SelectItem>
                  <SelectItem value="rigger">
                    Rigger (Inspeção técnica de acessórios e amarrações)
                  </SelectItem>
                  <SelectItem value="sinaleiro">
                    Sinaleiro (Verificação de sinalização e comunicação)
                  </SelectItem>
                  <SelectItem value="supervisor">
                    Supervisor (Cria/revisa checklists e gerencia frota)
                  </SelectItem>
                  <SelectItem value="gestor">
                    Gestor (Gerencia usuários, ativos e modelos)
                  </SelectItem>
                  <SelectItem value="admin">Administrador (Acesso total à empresa)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {!editingId && (
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">Senha Inicial</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  className="bg-slate-950 border-slate-800 text-white text-xs"
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              className="border-slate-800 bg-slate-950 text-slate-300 text-xs"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
            >
              Salvar Usuário
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
