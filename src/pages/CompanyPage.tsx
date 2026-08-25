import React, { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { AppDataService } from '@/services/appDataService'
import { syncService } from '@/lib/offline/sync-service'
import { Company } from '@/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
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
  Building,
  ShieldCheck,
  Plus,
  Edit2,
  CheckCircle2,
  Phone,
  Mail,
  MapPin,
  Globe,
  Layers,
  Trash2,
  AlertTriangle,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'

export const CompanyPage: React.FC = () => {
  const { company, companies, isAdmin, canManageCompanies, switchCompany, refreshProfile } =
    useAuth()
  const { isOnline } = useOnlineStatus()

  const [isEditingCurrent, setIsEditingCurrent] = useState(false)
  const [name, setName] = useState('')
  const [tradeName, setTradeName] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('SP')

  // Superadmin new tenant modal
  const [isNewTenantModalOpen, setIsNewTenantModalOpen] = useState(false)
  const [newCompName, setNewCompName] = useState('')
  const [newCompTrade, setNewCompTrade] = useState('')
  const [newCompCnpj, setNewCompCnpj] = useState('')
  const [newCompPhone, setNewCompPhone] = useState('')
  const [newCompEmail, setNewCompEmail] = useState('')
  const [newCompCity, setNewCompCity] = useState('')

  // Delete company modal state
  const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (company) {
      setName(company.name)
      setTradeName(company.trade_name || '')
      setCnpj(company.cnpj || '')
      setPhone(company.phone || '')
      setEmail(company.email || '')
      setAddress(company.address || '')
      setCity(company.city || '')
      setState(company.state || 'SP')
    }
    const unsubscribe = syncService.subscribe(() => {
      refreshProfile()
    })
    return () => {
      unsubscribe()
    }
  }, [company, refreshProfile])

  if (!canManageCompanies) {
    return <Navigate to="/" replace />
  }

  const handleSaveCurrentCompany = async () => {
    if (!name.trim()) {
      toast.warning('Nome da empresa é obrigatório.')
      return
    }

    try {
      await AppDataService.saveCompany({
        id: company?.id,
        name,
        trade_name: tradeName,
        cnpj,
        phone,
        email,
        address,
        city,
        state,
      })

      toast.success('Dados da empresa atualizados com sucesso!')
      setIsEditingCurrent(false)
      await refreshProfile()
    } catch (err: any) {
      toast.error('Erro ao salvar empresa: ' + err.message)
    }
  }

  const handleCreateNewTenant = async () => {
    if (!newCompName.trim()) {
      toast.warning('Nome da empresa é obrigatório.')
      return
    }

    try {
      const created = await AppDataService.saveCompany({
        name: newCompName,
        trade_name: newCompTrade,
        cnpj: newCompCnpj,
        phone: newCompPhone,
        email: newCompEmail,
        city: newCompCity,
        active: true,
      })

      toast.success(`Nova empresa "${created.name}" criada no ambiente centralizado!`)
      setIsNewTenantModalOpen(false)
      setNewCompName('')
      setNewCompTrade('')
      setNewCompCnpj('')
      setNewCompPhone('')
      setNewCompEmail('')
      setNewCompCity('')
      await refreshProfile()
      await switchCompany(created.id)
    } catch (err: any) {
      toast.error('Erro ao criar empresa: ' + err.message)
    }
  }

  const handleDeleteCompany = async () => {
    if (!companyToDelete) return

    const targetCompany = companyToDelete
    const targetName = targetCompany.trade_name || targetCompany.name

    setIsDeleting(true)
    try {
      await AppDataService.deleteCompany(targetCompany.id)
      toast.success(`Empresa ${targetName} excluída com sucesso`)
      setCompanyToDelete(null)
      await refreshProfile()
    } catch (err: any) {
      console.error('Error deleting company:', err)
      toast.error('Erro ao excluir empresa: ' + (err.message || 'Erro desconhecido'))
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Building className="w-6 h-6 text-blue-500" />
            Configuração da Empresa (Multi-Tenant)
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Isolamento de dados por empresa e gestão de tenant centralizado.
          </p>
        </div>

        {isAdmin && (
          <Button
            onClick={() => setIsNewTenantModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-md shadow-blue-500/20 text-xs"
          >
            <Plus className="w-4 h-4 mr-1.5" /> Adicionar Nova Empresa (Tenant)
          </Button>
        )}
      </div>

      {/* Active Company Card */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="pb-3 border-b border-slate-800 flex flex-row items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Badge className="bg-blue-950 text-blue-400 border border-blue-800 text-xs">
                Empresa Ativa
              </Badge>
              <Badge variant="outline" className="border-emerald-500/50 text-emerald-400 text-xs">
                Ambiente Isolado
              </Badge>
            </div>
            <CardTitle className="text-lg text-white mt-2">
              {company?.trade_name || company?.name}
            </CardTitle>
            <CardDescription className="text-slate-400 text-xs">
              CNPJ: {company?.cnpj || 'Não informado'}
            </CardDescription>
          </div>

          {isAdmin && !isEditingCurrent && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditingCurrent(true)}
              className="border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800 text-xs"
            >
              <Edit2 className="w-3.5 h-3.5 mr-1" /> Editar Dados
            </Button>
          )}
        </CardHeader>

        <CardContent className="p-5 space-y-4">
          {isEditingCurrent ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300">Razão Social *</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-white text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300">Nome Fantasia</Label>
                  <Input
                    value={tradeName}
                    onChange={(e) => setTradeName(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-white text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300">CNPJ</Label>
                  <Input
                    value={cnpj}
                    onChange={(e) => setCnpj(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-white text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300">Telefone</Label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-white text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300">E-mail</Label>
                  <Input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-white text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs text-slate-300">Endereço</Label>
                  <Input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-white text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300">Cidade / UF</Label>
                  <Input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-white text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditingCurrent(false)}
                  className="border-slate-800 bg-slate-950 text-slate-300 text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveCurrentCompany}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                >
                  Salvar Alterações
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-300">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Building className="w-4 h-4 text-slate-500" />
                  <span>
                    Razão Social: <strong className="text-white">{company?.name}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-slate-500" />
                  <span>Telefone: {company?.phone || 'Não cadastrado'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-slate-500" />
                  <span>E-mail: {company?.email || 'Não cadastrado'}</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-slate-500" />
                  <span>
                    Endereço: {company?.address || 'Não cadastrado'}, {company?.city}/
                    {company?.state}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>
                    Multi-Tenant: Registros e checklists filtrados estritamente para esta empresa.
                  </span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Switch Tenant List (Centralized Multi-Tenant Showcase) */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="pb-3 border-b border-slate-800">
          <CardTitle className="text-base text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-400" />
            Todas as Empresas Cadastradas no Sistema ({companies.length})
          </CardTitle>
          <CardDescription className="text-slate-400 text-xs">
            Selecione uma empresa para alternar seu contexto operacional em tempo real
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 divide-y divide-slate-800">
          {companies.map((c) => (
            <div
              key={c.id}
              className={`p-4 flex items-center justify-between gap-4 hover:bg-slate-850/60 transition ${
                company?.id === c.id ? 'bg-blue-950/20' : ''
              }`}
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-white text-sm">{c.trade_name || c.name}</h4>
                  {company?.id === c.id && (
                    <Badge className="bg-blue-600 text-white text-[10px] px-1.5 py-0">
                      Selecionada
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-slate-400">
                  {c.name} {c.cnpj ? `• CNPJ: ${c.cnpj}` : ''}{' '}
                  {c.city ? `• ${c.city}/${c.state}` : ''}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {company?.id !== c.id && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => switchCompany(c.id)}
                    className="border-slate-800 bg-slate-950 text-blue-400 hover:text-white hover:bg-blue-600 text-xs h-8"
                  >
                    Alternar para esta Empresa
                  </Button>
                )}

                {isAdmin && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCompanyToDelete(c)}
                    className="border-red-900/50 bg-red-950/20 text-red-400 hover:bg-red-600 hover:text-white text-xs h-8 px-2.5 transition"
                    title={`Excluir ${c.trade_name || c.name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    <span className="hidden sm:inline">Excluir</span>
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Modal: Confirmation for Cascade Deleting Company */}
      <Dialog
        open={!!companyToDelete}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setCompanyToDelete(null)
          }
        }}
      >
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <DialogTitle className="text-white text-base">Excluir Empresa</DialogTitle>
            </div>
          </DialogHeader>

          <div className="py-3 text-slate-300 text-sm leading-relaxed space-y-3">
            <p>
              Tem certeza que deseja excluir a empresa{' '}
              <strong className="text-white font-semibold">
                {companyToDelete?.trade_name || companyToDelete?.name}
              </strong>
              ?
            </p>
            <div className="p-3 rounded-md bg-red-950/30 border border-red-900/40 text-red-300 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>
                Esta ação é irreversível e removerá todos os dados vinculados: usuários, checklists,
                equipamentos e materiais.
              </span>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setCompanyToDelete(null)}
              disabled={isDeleting}
              className="border-slate-800 bg-slate-950 text-slate-300 text-xs"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleDeleteCompany}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  Excluindo...
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                  Excluir Empresa
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: New Tenant */}
      <Dialog open={isNewTenantModalOpen} onOpenChange={setIsNewTenantModalOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white text-base">
              Cadastrar Nova Empresa (Multi-Tenant Centralizado)
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300">Razão Social *</Label>
              <Input
                value={newCompName}
                onChange={(e) => setNewCompName(e.target.value)}
                placeholder="Ex: Alfa Içamentos Pesados Ltda"
                className="bg-slate-950 border-slate-800 text-white text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300">Nome Fantasia</Label>
              <Input
                value={newCompTrade}
                onChange={(e) => setNewCompTrade(e.target.value)}
                placeholder="Ex: Alfa Rigging"
                className="bg-slate-950 border-slate-800 text-white text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">CNPJ</Label>
                <Input
                  value={newCompCnpj}
                  onChange={(e) => setNewCompCnpj(e.target.value)}
                  placeholder="00.000.000/0001-00"
                  className="bg-slate-950 border-slate-800 text-white text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">Cidade/UF</Label>
                <Input
                  value={newCompCity}
                  onChange={(e) => setNewCompCity(e.target.value)}
                  placeholder="Santos/SP"
                  className="bg-slate-950 border-slate-800 text-white text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">Telefone</Label>
                <Input
                  value={newCompPhone}
                  onChange={(e) => setNewCompPhone(e.target.value)}
                  placeholder="(13) 3000-0000"
                  className="bg-slate-950 border-slate-800 text-white text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">E-mail</Label>
                <Input
                  value={newCompEmail}
                  onChange={(e) => setNewCompEmail(e.target.value)}
                  placeholder="contato@alfarigging.com.br"
                  className="bg-slate-950 border-slate-800 text-white text-xs"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsNewTenantModalOpen(false)}
              className="border-slate-800 bg-slate-950 text-slate-300 text-xs"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateNewTenant}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
            >
              Criar Empresa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
