import React, { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { AppDataService } from '@/services/appDataService'
import { syncService } from '@/lib/offline/sync-service'
import { Client } from '@/types'
import { CompanySelect } from '@/components/CompanySelect'
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
import { Building2, Plus, Search, Phone, Mail, MapPin, Trash2, Edit2, FileText } from 'lucide-react'
import { toast } from 'sonner'

export const ClientsPage: React.FC = () => {
  const { company, companies, hasModulePermission } = useAuth()
  const { isOnline } = useOnlineStatus()

  const canEdit = hasModulePermission('clients', 'edit')
  const canDelete = hasModulePermission('clients', 'delete')

  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(company?.id || '')
  const [name, setName] = useState('')
  const [tradeName, setTradeName] = useState('')
  const [document, setDocument] = useState('')
  const [contactName, setContactName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('SP')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    loadClients()
    const unsubscribe = syncService.subscribe(() => {
      loadClients()
    })
    return () => {
      unsubscribe()
    }
  }, [company?.id, isOnline])

  const loadClients = async () => {
    setLoading(true)
    try {
      const data = await AppDataService.getClients(company?.id, isOnline)
      setClients(data)
    } catch (err) {
      console.error('Error loading clients:', err)
    } finally {
      setLoading(false)
    }
  }

  const openNewModal = () => {
    setEditingId(null)
    setSelectedCompanyId(company?.id || companies[0]?.id || '')
    setName('')
    setTradeName('')
    setDocument('')
    setContactName('')
    setPhone('')
    setEmail('')
    setAddress('')
    setCity('')
    setState('SP')
    setNotes('')
    setIsModalOpen(true)
  }

  const openEditModal = (c: Client) => {
    setEditingId(c.id)
    setSelectedCompanyId(c.company_id || company?.id || companies[0]?.id || '')
    setName(c.name)
    setTradeName(c.trade_name || '')
    setDocument(c.document || '')
    setContactName(c.contact_name || '')
    setPhone(c.phone || '')
    setEmail(c.email || '')
    setAddress(c.address || '')
    setCity(c.city || '')
    setState(c.state || 'SP')
    setNotes(c.notes || '')
    setIsModalOpen(true)
  }

  const handleSave = async () => {
    if (!selectedCompanyId) {
      toast.warning('A seleção da empresa é obrigatória.')
      return
    }

    if (!name.trim()) {
      toast.warning('Razão Social ou Nome do Cliente é obrigatório.')
      return
    }

    try {
      const payload: Partial<Client> = {
        id: editingId || undefined,
        company_id: selectedCompanyId,
        name,
        trade_name: tradeName,
        document,
        contact_name: contactName,
        phone,
        email,
        address,
        city,
        state,
        notes,
        active: true,
      }

      await AppDataService.saveClient(payload, isOnline)
      toast.success('Cliente / Obra salvo com sucesso!')
      setIsModalOpen(false)
      await loadClients()
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + err.message)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente remover este cliente?')) return
    try {
      await AppDataService.deleteClient(id, isOnline)
      setClients((prev) => prev.filter((c) => c.id !== id))
      toast.success('Cliente removido.')
    } catch (err: any) {
      toast.error('Erro ao remover: ' + err.message)
    }
  }

  const filtered = clients
    .filter((c) => (company?.id ? c.company_id === company.id : true))
    .filter(
      (c) =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.trade_name?.toLowerCase().includes(search.toLowerCase()) ||
        c.document?.includes(search) ||
        c.city?.toLowerCase().includes(search.toLowerCase()),
    )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Building2 className="w-6 h-6 text-blue-500" />
            Clientes e Canteiros de Obra
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Empresas contratantes para onde os guindastes e materiais são mobilizados.
          </p>
        </div>

        {canEdit && (
          <Button
            onClick={openNewModal}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-md shadow-blue-500/20 text-xs"
          >
            <Plus className="w-4 h-4 mr-1.5" /> Novo Cliente
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            placeholder="Buscar por Razão Social, Nome Fantasia, CNPJ ou Cidade..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-slate-950 border-slate-800 text-white text-xs"
          />
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((c) => (
          <Card
            key={c.id}
            className="bg-slate-900 border-slate-800 hover:border-slate-700 transition"
          >
            <CardContent className="p-5 space-y-3">
              <div className="space-y-0.5">
                <Badge
                  variant="outline"
                  className="border-blue-500/40 text-blue-400 text-[10px] px-1.5 py-0"
                >
                  {c.document ? `DOC: ${c.document}` : 'Cliente'}
                </Badge>
                <h3 className="font-bold text-white text-base leading-tight mt-1">
                  {c.trade_name || c.name}
                </h3>
                {c.trade_name && c.trade_name !== c.name && (
                  <p className="text-xs text-slate-400">{c.name}</p>
                )}
              </div>

              <div className="space-y-1.5 text-xs text-slate-300 pt-1">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Empresa:</span>
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-slate-950 border-slate-800 text-slate-300 font-normal"
                  >
                    {companies.find((comp) => comp.id === c.company_id)?.trade_name ||
                      companies.find((comp) => comp.id === c.company_id)?.name ||
                      company?.name ||
                      'Empresa Padrão'}
                  </Badge>
                </div>
                {c.contact_name && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Contato:</span>
                    <span className="text-slate-200">{c.contact_name}</span>
                  </div>
                )}
                {c.phone && (
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <Phone className="w-3.5 h-3.5 text-slate-500" />
                    <span>{c.phone}</span>
                  </div>
                )}
                {c.email && (
                  <div className="flex items-center gap-1.5 text-slate-300 truncate">
                    <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="truncate">{c.email}</span>
                  </div>
                )}
                {(c.city || c.address) && (
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="truncate">
                      {c.address ? `${c.address}, ` : ''}
                      {c.city ? `${c.city}/${c.state}` : ''}
                    </span>
                  </div>
                )}
              </div>

              {c.notes && (
                <p className="text-[11px] text-slate-400 bg-slate-950 p-2 rounded border border-slate-800 line-clamp-2">
                  {c.notes}
                </p>
              )}

              {(canEdit || canDelete) && (
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                  {canEdit && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openEditModal(c)}
                      className="h-7 text-xs text-slate-300 hover:text-white"
                    >
                      <Edit2 className="w-3.5 h-3.5 mr-1" /> Editar
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(c.id)}
                      className="h-7 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/20"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {filtered.length === 0 && (
          <div className="col-span-full p-12 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-xl text-xs">
            Nenhum cliente cadastrado.
          </div>
        )}
      </div>

      {/* Modal: Add / Edit Client */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white text-base">
              {editingId ? 'Editar Cliente' : 'Cadastrar Cliente / Obra'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Empresa Selector */}
            <CompanySelect
              value={selectedCompanyId}
              onChange={setSelectedCompanyId}
              required
              label="Empresa Prestadora do Serviço"
            />

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300">Razão Social / Nome Completo *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Petrobras S/A - Refinaria RPBC"
                className="bg-slate-950 border-slate-800 text-white text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">Nome Fantasia / Unidade</Label>
                <Input
                  value={tradeName}
                  onChange={(e) => setTradeName(e.target.value)}
                  placeholder="Ex: Refinaria Cubatão"
                  className="bg-slate-950 border-slate-800 text-white text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">CPF ou CNPJ</Label>
                <Input
                  value={document}
                  onChange={(e) => setDocument(e.target.value)}
                  placeholder="Ex: 33.000.167/0001-01"
                  className="bg-slate-950 border-slate-800 text-white text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">Contato Responsável</Label>
                <Input
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Ex: Eng. Rafael"
                  className="bg-slate-950 border-slate-800 text-white text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">Telefone</Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(13) 3362-8000"
                  className="bg-slate-950 border-slate-800 text-white text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">E-mail</Label>
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="obras@empresa.com"
                  className="bg-slate-950 border-slate-800 text-white text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs text-slate-300">Endereço / Canteiro de Obras</Label>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Av. 9 de Abril, 777"
                  className="bg-slate-950 border-slate-800 text-white text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">Cidade/UF</Label>
                <Input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Cubatão/SP"
                  className="bg-slate-950 border-slate-800 text-white text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300">Requisitos Especiais de Rigging</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Exige teste de carga e ART assinada."
                className="bg-slate-950 border-slate-800 text-white text-xs"
              />
            </div>
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
              Salvar Cliente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
