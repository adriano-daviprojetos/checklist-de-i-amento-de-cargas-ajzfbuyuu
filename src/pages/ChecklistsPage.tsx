import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { AppDataService } from '@/services/appDataService'
import { syncService } from '@/lib/offline/sync-service'
import { Checklist, ChecklistTemplate, Equipment, Material, Client } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Plus,
  Search,
  Filter,
  ClipboardCheck,
  Truck,
  Anchor,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Calendar,
  Building,
  RefreshCw,
  ExternalLink,
  Trash2,
  PenLine,
  FileDown,
  Loader2,
  Eye,
} from 'lucide-react'
import { toast } from 'sonner'
import { generateChecklistPdf } from '@/lib/checklistPdfGenerator'

export const ChecklistsPage: React.FC = () => {
  const { company, companies, role, isAdmin, isGestor, hasModulePermission, isCliente } = useAuth()
  const { isOnline } = useOnlineStatus()
  const navigate = useNavigate()

  const isRestrictedRole =
    role === 'operador' || role === 'rigger' || role === 'sinaleiro' || role === 'supervisor'
  const canManageFinalized = isAdmin || isGestor

  const canEdit = hasModulePermission('checklists', 'edit') && !isCliente
  const canDelete = hasModulePermission('checklists', 'delete')

  const [checklists, setChecklists] = useState<Checklist[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('todos')
  const [exportingId, setExportingId] = useState<string | null>(null)

  useEffect(() => {
    loadChecklists()
    const unsubscribe = syncService.subscribe(() => {
      loadChecklists()
    })
    return () => {
      unsubscribe()
    }
  }, [company?.id, isOnline])

  const loadChecklists = async () => {
    setLoading(true)
    try {
      const data = await AppDataService.getChecklists(company?.id, isOnline)
      setChecklists(data)
    } catch (err) {
      console.error('Error loading checklists:', err)
      toast.error('Erro ao carregar checklists')
    } finally {
      setLoading(false)
    }
  }

  const handleExportPdfFromList = async (e: React.MouseEvent, chk: Checklist) => {
    e.stopPropagation()
    if (chk.status !== 'Concluído' && chk.status !== 'Reprovado') {
      toast.warning('Finalize o checklist antes de exportar o PDF.')
      return
    }

    setExportingId(chk.id)
    try {
      // Fetch full checklist responses, template items and groups
      const { checklist: fullChecklist, responses } = await AppDataService.getChecklistById(
        chk.id,
        isOnline,
      )
      const targetChecklist = fullChecklist || chk

      const [items, groups, companiesList, clientsList, equipmentList, materialsList] =
        await Promise.all([
          targetChecklist.template_id
            ? AppDataService.getTemplateItems(targetChecklist.template_id, isOnline)
            : Promise.resolve([]),
          targetChecklist.template_id
            ? AppDataService.getItemGroups(targetChecklist.template_id, isOnline)
            : Promise.resolve([]),
          AppDataService.getCompanies(isOnline),
          AppDataService.getClients(targetChecklist.company_id, isOnline),
          AppDataService.getEquipment(targetChecklist.company_id, isOnline),
          AppDataService.getMaterials(targetChecklist.company_id, isOnline),
        ])

      const foundComp = companiesList.find((c) => c.id === targetChecklist.company_id) || company
      const foundClient = clientsList.find((c) => c.id === targetChecklist.client_id)
      const foundEquipment = equipmentList.find((e) => e.id === targetChecklist.equipment_id)
      const foundMaterial = materialsList.find((m) => m.id === targetChecklist.material_id)

      await generateChecklistPdf({
        checklist: targetChecklist,
        responses,
        items,
        groups,
        company: foundComp,
        client: foundClient,
        equipment: foundEquipment,
        material: foundMaterial,
      })

      toast.success('Relatório PDF exportado com sucesso!')
    } catch (err: any) {
      console.error('Error generating PDF from list:', err)
      toast.error('Erro ao gerar relatório PDF: ' + (err?.message || 'Erro desconhecido'))
    } finally {
      setExportingId(null)
    }
  }

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (!confirm('Deseja realmente excluir este checklist?')) return
    try {
      await AppDataService.deleteChecklist(id, isOnline)
      setChecklists((prev) => prev.filter((c) => c.id !== id))
      toast.success('Checklist excluído com sucesso.')
    } catch (err: any) {
      toast.error('Erro ao excluir: ' + err.message)
    }
  }

  const filtered = checklists
    .filter((chk) => (company?.id ? chk.company_id === company.id : true))
    .filter((chk) => {
      const matchesSearch =
        chk.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        chk.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        chk.location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        chk.filled_by_name?.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesStatus = statusFilter === 'todos' || chk.status === statusFilter

      return matchesSearch && matchesStatus
    })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Concluído':
        return (
          <Badge className="bg-emerald-950/80 text-emerald-400 border border-emerald-800 flex items-center gap-1 text-xs">
            <CheckCircle2 className="w-3 h-3" /> Concluído
          </Badge>
        )
      case 'Em Andamento':
        return (
          <Badge className="bg-blue-950/80 text-blue-400 border border-blue-800 flex items-center gap-1 text-xs">
            <Clock className="w-3 h-3" /> Em Andamento
          </Badge>
        )
      case 'Reprovado':
        return (
          <Badge className="bg-red-950/80 text-red-400 border border-red-800 flex items-center gap-1 text-xs">
            <XCircle className="w-3 h-3" /> Reprovado
          </Badge>
        )
      default:
        return (
          <Badge className="bg-amber-950/80 text-amber-400 border border-amber-800 flex items-center gap-1 text-xs">
            <AlertCircle className="w-3 h-3" /> Pendente
          </Badge>
        )
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6 text-blue-500" />
            Checklists de Içamento
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Inspeções pré-uso, conformidade de guindastes, muncks, lingadas e planos de carga.
          </p>
        </div>

        {canEdit && (
          <Button
            onClick={() => navigate('/checklists/novo')}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-md shadow-blue-500/20"
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo Checklist de Campo
          </Button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 bg-slate-900 p-4 rounded-xl border border-slate-800">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            placeholder="Buscar por código, obra, local ou inspetor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-slate-950 border-slate-800 text-white text-sm placeholder:text-slate-500 focus:border-blue-500"
          />
        </div>

        <div className="w-full sm:w-56">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200 text-sm">
              <SelectValue placeholder="Filtrar por Status" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
              <SelectItem value="todos">Todos os Status</SelectItem>
              <SelectItem value="Concluído">Concluídos (Liberados)</SelectItem>
              <SelectItem value="Em Andamento">Em Andamento</SelectItem>
              <SelectItem value="Pendente">Pendentes</SelectItem>
              <SelectItem value="Reprovado">Reprovados</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          variant="outline"
          onClick={loadChecklists}
          className="border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800"
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Checklists List */}
      <div className="grid grid-cols-1 gap-3">
        {filtered.map((chk) => (
          <Card
            key={chk.id}
            onClick={() => navigate(`/checklists/${chk.id}`)}
            className="bg-slate-900 border-slate-800 hover:border-slate-700 transition cursor-pointer group shadow-sm hover:shadow-md"
          >
            <CardContent className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-2 flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-950/60 text-blue-400 border border-blue-900/40">
                    {chk.code || 'CHK-TEMP'}
                  </span>
                  <h3 className="font-semibold text-white text-base group-hover:text-blue-400 transition-colors">
                    {chk.title}
                  </h3>
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-slate-950 border-slate-800 text-slate-300 font-normal"
                  >
                    {companies.find((comp) => comp.id === chk.company_id)?.trade_name ||
                      companies.find((comp) => comp.id === chk.company_id)?.name ||
                      company?.name ||
                      'Empresa Padrão'}
                  </Badge>
                  {getStatusBadge(chk.status)}
                  {chk.sync_status === 'pending_sync' && (
                    <Badge
                      variant="outline"
                      className="text-amber-400 border-amber-500/40 text-[10px]"
                    >
                      Salvo Localmente (Pendente Sincronia)
                    </Badge>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-slate-400">
                  {chk.location && (
                    <div className="flex items-center gap-1.5">
                      <Building className="w-3.5 h-3.5 text-slate-500" />
                      <span>{chk.location}</span>
                    </div>
                  )}

                  {chk.expand?.equipment_id && (
                    <div className="flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-slate-500" />
                      <span>
                        {chk.expand.equipment_id.type} {chk.expand.equipment_id.model} (
                        {chk.expand.equipment_id.license_plate || 'S/ Placa'})
                      </span>
                    </div>
                  )}

                  {chk.expand?.material_id && (
                    <div className="flex items-center gap-1.5">
                      <Anchor className="w-3.5 h-3.5 text-slate-500" />
                      <span>
                        TAG: {chk.expand.material_id.tag} ({chk.expand.material_id.type})
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5">
                    {chk.status === 'Concluído' || chk.status === 'Reprovado' ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-slate-500" />
                        <span>
                          <span className="text-slate-500">Finalizado em:</span>{' '}
                          <strong className="text-slate-300 font-normal">
                            {chk.completed_at
                              ? `${new Date(chk.completed_at).toLocaleDateString('pt-BR')} às ${new Date(chk.completed_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                              : chk.updated
                                ? `${new Date(chk.updated).toLocaleDateString('pt-BR')} às ${new Date(chk.updated).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                                : `${new Date(chk.created || Date.now()).toLocaleDateString('pt-BR')} às ${new Date(chk.created || Date.now()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
                          </strong>
                        </span>
                      </>
                    ) : (
                      <>
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        <span>
                          <span className="text-slate-500">Criado em:</span>{' '}
                          <strong className="text-slate-300 font-normal">
                            {chk.created
                              ? `${new Date(chk.created).toLocaleDateString('pt-BR')} às ${new Date(chk.created).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                              : chk.scheduled_date
                                ? new Date(chk.scheduled_date).toLocaleDateString('pt-BR')
                                : `${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
                          </strong>
                        </span>
                      </>
                    )}
                  </div>

                  {chk.filled_by_name && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500">Responsável:</span>
                      <strong className="text-slate-300">{chk.filled_by_name}</strong>
                    </div>
                  )}

                  {chk.filled_by_signature && (
                    <div className="flex items-center gap-1 text-emerald-400 font-medium">
                      <PenLine className="w-3.5 h-3.5" />
                      <span>Assinado pelo Responsável</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                {(chk.status === 'Concluído' || chk.status === 'Reprovado') && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => handleExportPdfFromList(e, chk)}
                    disabled={exportingId === chk.id}
                    title="Exportar Relatório PDF"
                    className="bg-slate-950 border-blue-600/50 text-blue-400 hover:bg-blue-900/40 text-xs font-semibold"
                  >
                    {exportingId === chk.id ? (
                      <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                    ) : (
                      <FileDown className="w-3.5 h-3.5 mr-1 text-blue-400" />
                    )}
                    PDF
                  </Button>
                )}

                {(() => {
                  const isFinalized = chk.status === 'Concluído' || chk.status === 'Reprovado'
                  const isReadOnlyForUser = isFinalized && isRestrictedRole && !canManageFinalized

                  if (isReadOnlyForUser) {
                    return (
                      <Button
                        size="sm"
                        variant="outline"
                        className="bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800 text-xs flex items-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5 text-blue-400" />
                        Visualizar
                      </Button>
                    )
                  }

                  return (
                    <Button
                      size="sm"
                      className="bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/20 text-xs flex items-center gap-1.5"
                    >
                      <PenLine className="w-3.5 h-3.5" />
                      Abrir Checklist
                    </Button>
                  )
                })()}
                {canDelete && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => handleDelete(e, chk.id)}
                    className="h-8 w-8 text-slate-500 hover:text-red-400 hover:bg-red-950/20"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        {!loading && filtered.length === 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center space-y-3">
            <ClipboardCheck className="w-12 h-12 text-slate-600 mx-auto" />
            <div className="text-base font-semibold text-slate-300">
              Nenhum checklist encontrado
            </div>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Você pode iniciar uma nova verificação de içamento ou alterar os filtros de busca
              acima.
            </p>
            {canEdit && (
              <Button
                onClick={() => navigate('/checklists/novo')}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs mt-2"
              >
                <Plus className="w-4 h-4 mr-1.5" /> Iniciar Checklist Agora
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
