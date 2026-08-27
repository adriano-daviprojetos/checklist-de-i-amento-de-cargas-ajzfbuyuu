import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { AppDataService } from '@/services/appDataService'
import { syncService } from '@/lib/offline/sync-service'
import { Checklist, ChecklistTemplate, Equipment, Material, Client } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
  FileText,
  Loader2,
  Eye,
  Cloud,
  CloudOff,
  AlertTriangle,
  HelpCircle,
} from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { toast } from 'sonner'
import { generateChecklistPdf } from '@/lib/checklistPdfGenerator'
import { generateChecklistReportPdf } from '@/lib/checklistReportPdfGenerator'

export const ChecklistsPage: React.FC = () => {
  const { company, companies, role, isAdmin, isGestor, hasModulePermission, isCliente } = useAuth()
  const { isOnline } = useOnlineStatus()
  const navigate = useNavigate()

  const isRestrictedRole =
    role === 'operador' ||
    role === 'rigger' ||
    role === 'sinaleiro' ||
    role === 'supervisor' ||
    role === 'gestor'
  const canManageFinalized = isAdmin

  const canEdit = hasModulePermission('checklists', 'edit') && !isCliente
  const canDelete = hasModulePermission('checklists', 'delete')

  const [checklists, setChecklists] = useState<Checklist[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('todos')
  const [exportingId, setExportingId] = useState<string | null>(null)

  // Report Modal States
  const [isReportModalOpen, setIsReportModalOpen] = useState(false)
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([])
  const [clientsList, setClientsList] = useState<Client[]>([])
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string>('all')
  const [reportDateFrom, setReportDateFrom] = useState<string>(() => {
    const d = new Date()
    d.setDate(1) // First day of current month
    return d.toISOString().split('T')[0]
  })
  const [reportDateTo, setReportDateTo] = useState<string>(() => {
    return new Date().toISOString().split('T')[0]
  })
  const [isGeneratingReport, setIsGeneratingReport] = useState(false)

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
      const [data, eqData, cliData] = await Promise.all([
        AppDataService.getChecklists(company?.id, isOnline),
        AppDataService.getEquipment(company?.id, isOnline),
        AppDataService.getClients(company?.id, isOnline),
      ])
      setChecklists(data)
      setEquipmentList(eqData)
      setClientsList(cliData)
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

      const [
        items,
        groups,
        templatesList,
        companiesList,
        clientsList,
        equipmentList,
        materialsList,
      ] = await Promise.all([
        targetChecklist.template_id
          ? AppDataService.getTemplateItems(targetChecklist.template_id, isOnline)
          : Promise.resolve([]),
        targetChecklist.template_id
          ? AppDataService.getItemGroups(targetChecklist.template_id, isOnline)
          : Promise.resolve([]),
        AppDataService.getTemplates(targetChecklist.company_id, isOnline),
        AppDataService.getCompanies(isOnline),
        AppDataService.getClients(targetChecklist.company_id, isOnline),
        AppDataService.getEquipment(targetChecklist.company_id, isOnline),
        AppDataService.getMaterials(targetChecklist.company_id, isOnline),
      ])

      const foundComp = companiesList.find((c) => c.id === targetChecklist.company_id) || company
      const foundClient = clientsList.find((c) => c.id === targetChecklist.client_id)
      const foundEquipment = equipmentList.find((e) => e.id === targetChecklist.equipment_id)
      const foundMaterial = materialsList.find((m) => m.id === targetChecklist.material_id)
      const foundTemplate = templatesList.find((t) => t.id === targetChecklist.template_id)
      const templateName =
        foundTemplate?.title || targetChecklist.expand?.template_id?.title || null

      await generateChecklistPdf({
        checklist: targetChecklist,
        responses,
        items,
        groups,
        company: foundComp,
        client: foundClient,
        equipment: foundEquipment,
        material: foundMaterial,
        templateName,
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

  const handleOpenReportModal = async () => {
    try {
      const [eqData, cliData] = await Promise.all([
        AppDataService.getEquipment(company?.id, isOnline),
        AppDataService.getClients(company?.id, isOnline),
      ])
      setEquipmentList(eqData)
      setClientsList(cliData)
    } catch (e) {
      console.warn('Erro ao atualizar lista de equipamentos para o relatório:', e)
    }
    setIsReportModalOpen(true)
  }

  const handleGenerateReport = async () => {
    if (!reportDateFrom || !reportDateTo) {
      toast.warning('Por favor, informe as datas inicial e final do período.')
      return
    }

    const start = new Date(`${reportDateFrom}T00:00:00`)
    const end = new Date(`${reportDateTo}T23:59:59`)

    if (start > end) {
      toast.warning('A data inicial não pode ser posterior à data final.')
      return
    }

    setIsGeneratingReport(true)
    try {
      // Filter checklists by company, dates (completed_at or created or scheduled_date) and equipment
      const filteredForReport = checklists.filter((chk) => {
        if (company?.id && chk.company_id && chk.company_id !== company.id) {
          return false
        }

        if (selectedEquipmentId !== 'all') {
          if (chk.equipment_id !== selectedEquipmentId) {
            return false
          }
        }

        // Check date in range
        const rawDate = chk.completed_at || chk.created || chk.scheduled_date
        if (!rawDate) return false
        const chkDate = new Date(rawDate)
        if (isNaN(chkDate.getTime())) return false

        return chkDate >= start && chkDate <= end
      })

      // Map to ChecklistReportItem
      const formattedItems = filteredForReport.map((chk) => {
        // Resolve client
        const clientObj = chk.expand?.client_id || clientsList.find((c) => c.id === chk.client_id)
        const clientName = clientObj?.trade_name || clientObj?.name || 'Não informado'

        // Resolve equipment
        const eqObj =
          chk.expand?.equipment_id || equipmentList.find((e) => e.id === chk.equipment_id)

        let equipmentInfo = '-'
        if (eqObj) {
          const mfgModel =
            [eqObj.manufacturer, eqObj.model].filter(Boolean).join(' ') ||
            eqObj.type ||
            'Equipamento'
          const plate = eqObj.license_plate ? ` — ${eqObj.license_plate}` : ''
          equipmentInfo = `${mfgModel}${plate}`
        }

        return {
          id: chk.id,
          code: chk.code || 'CHK-N/A',
          title: chk.title || 'Checklist',
          status: chk.status || 'Pendente',
          completed_at: chk.completed_at,
          created: chk.created,
          location: chk.location || '-',
          clientName,
          equipmentInfo,
        }
      })

      // Format date labels
      const [fromYear, fromMonth, fromDay] = reportDateFrom.split('-')
      const [toYear, toMonth, toDay] = reportDateTo.split('-')
      const dateFromFormatted = `${fromDay}/${fromMonth}/${fromYear}`
      const dateToFormatted = `${toDay}/${toMonth}/${toYear}`

      let selectedEqName = 'Todos os Equipamentos'
      if (selectedEquipmentId !== 'all') {
        const foundEq = equipmentList.find((e) => e.id === selectedEquipmentId)
        if (foundEq) {
          const mfgModel =
            [foundEq.manufacturer, foundEq.model].filter(Boolean).join(' ') ||
            foundEq.type ||
            'Equipamento'
          const plate = foundEq.license_plate ? ` — ${foundEq.license_plate}` : ''
          selectedEqName = `${mfgModel}${plate}`
        }
      }

      const activeCompanyName =
        company?.trade_name || company?.name || 'Davi Projetos - Engenharia e Rigging'

      await generateChecklistReportPdf({
        checklists: formattedItems,
        dateFrom: dateFromFormatted,
        dateTo: dateToFormatted,
        equipmentName: selectedEqName,
        companyName: activeCompanyName,
      })

      toast.success('Relatório consolidado gerado com sucesso!')
      setIsReportModalOpen(false)
    } catch (err: any) {
      console.error('Error generating consolidated report:', err)
      toast.error('Erro ao gerar relatório consolidado: ' + (err?.message || 'Erro desconhecido'))
    } finally {
      setIsGeneratingReport(false)
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

  const getSyncStatusIndicator = (syncStatus?: string, chkId?: string) => {
    const isLocalOnly = syncStatus === 'pending_sync' || (chkId && chkId.startsWith('local_'))

    if (isLocalOnly) {
      return (
        <Tooltip>
          <TooltipTrigger asChild onClick={(e) => e.stopPropagation()}>
            <span
              className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-amber-950/60 text-amber-400 border border-amber-800/80 cursor-help"
              aria-label="💾 Salvo no Dispositivo (Pendente de Sincronização)"
            >
              <CloudOff className="w-3 h-3 text-amber-400" />
              <span>💾 Local</span>
            </span>
          </TooltipTrigger>
          <TooltipContent
            side="top"
            className="text-xs bg-slate-900 border-slate-800 text-slate-200 max-w-xs"
          >
            Salvo com segurança no dispositivo. Será sincronizado com a nuvem assim que houver
            conexão com a internet.
          </TooltipContent>
        </Tooltip>
      )
    }

    if (syncStatus === 'conflict') {
      return (
        <Tooltip>
          <TooltipTrigger asChild onClick={(e) => e.stopPropagation()}>
            <span
              className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-red-950/60 text-red-400 border border-red-800 cursor-help"
              aria-label="Conflito de sincronização"
            >
              <AlertTriangle className="w-3 h-3" />
              <span>Conflito</span>
            </span>
          </TooltipTrigger>
          <TooltipContent
            side="top"
            className="text-xs bg-slate-900 border-slate-800 text-slate-200"
          >
            Conflito de sincronização resolvido localmente.
          </TooltipContent>
        </Tooltip>
      )
    }

    return (
      <Tooltip>
        <TooltipTrigger asChild onClick={(e) => e.stopPropagation()}>
          <span
            className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-950/50 text-emerald-400 border border-emerald-800/60 cursor-help"
            aria-label="☁️ Sincronizado no Servidor"
          >
            <Cloud className="w-3 h-3 text-emerald-400" />
            <span>☁️ Servidor</span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs bg-slate-900 border-slate-800 text-slate-200">
          Sincronizado e salvo na nuvem com sucesso.
        </TooltipContent>
      </Tooltip>
    )
  }

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
          <div className="flex items-center gap-2">
            {(isAdmin || isGestor) && (
              <Button
                variant="outline"
                onClick={handleOpenReportModal}
                className="bg-slate-900 border-slate-800 hover:bg-slate-800 text-slate-200 hover:text-white"
              >
                <FileText className="w-4 h-4 mr-2 text-blue-400" />
                Relatório Consolidado
              </Button>
            )}

            <Button
              onClick={() => navigate('/checklists/novo')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-md shadow-blue-500/20"
            >
              <Plus className="w-4 h-4 mr-2" />
              Novo Checklist de Campo
            </Button>
          </div>
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
                  {getSyncStatusIndicator(chk.sync_status, chk.id)}
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

      {/* Consolidated Report Modal */}
      <Dialog open={isReportModalOpen} onOpenChange={setIsReportModalOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-500" />
              Relatório Consolidado de Checklists
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              Defina o intervalo de datas e selecione o equipamento desejado para gerar o relatório
              PDF detalhado.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="report-from" className="text-xs text-slate-300">
                  Data Inicial
                </Label>
                <Input
                  id="report-from"
                  type="date"
                  value={reportDateFrom}
                  onChange={(e) => setReportDateFrom(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-white text-xs focus:border-blue-500 [color-scheme:dark]"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="report-to" className="text-xs text-slate-300">
                  Data Final
                </Label>
                <Input
                  id="report-to"
                  type="date"
                  value={reportDateTo}
                  onChange={(e) => setReportDateTo(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-white text-xs focus:border-blue-500 [color-scheme:dark]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="report-equipment" className="text-xs text-slate-300">
                Equipamento
              </Label>
              <Select value={selectedEquipmentId} onValueChange={setSelectedEquipmentId}>
                <SelectTrigger
                  id="report-equipment"
                  className="bg-slate-950 border-slate-800 text-slate-200 text-xs"
                >
                  <SelectValue placeholder="Selecione o equipamento" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-slate-200 max-h-60">
                  <SelectItem value="all">Todos os Equipamentos</SelectItem>
                  {equipmentList.map((eq) => {
                    const label = [
                      eq.type,
                      eq.manufacturer,
                      eq.model,
                      eq.license_plate ? `(${eq.license_plate})` : '',
                    ]
                      .filter(Boolean)
                      .join(' ')
                    return (
                      <SelectItem key={eq.id} value={eq.id} className="text-xs">
                        {label}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsReportModalOpen(false)}
              disabled={isGeneratingReport}
              className="border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800 text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleGenerateReport}
              disabled={isGeneratingReport}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-md shadow-blue-500/20"
            >
              {isGeneratingReport ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Gerando PDF...
                </>
              ) : (
                <>
                  <FileDown className="w-3.5 h-3.5 mr-1.5" />
                  Gerar Relatório PDF
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
