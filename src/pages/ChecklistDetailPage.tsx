import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { AppDataService } from '@/services/appDataService'
import { syncService } from '@/lib/offline/sync-service'
import {
  Checklist,
  ChecklistResponse,
  ChecklistTemplate,
  ChecklistTemplateItem,
  ChecklistItemGroup,
  Equipment,
  Material,
  Client,
  ResponseStatus,
} from '@/types'
import { CompanySelect } from '@/components/CompanySelect'
import { FinalizeChecklistModal } from '@/components/FinalizeChecklistModal'
import { DigitalSignaturePad, DigitalSignaturePadRef } from '@/components/DigitalSignaturePad'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Camera,
  Save,
  ArrowLeft,
  Truck,
  Anchor,
  ShieldCheck,
  Building,
  Clock,
  Printer,
  FileCheck,
  Check,
  X,
  Minus,
  PenLine,
  UserCheck,
  Calendar,
  RotateCcw,
  Folder,
  FileDown,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { generateChecklistPdf } from '@/lib/checklistPdfGenerator'

export const ChecklistDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const isNew = !id || id === 'novo'
  const navigate = useNavigate()

  const { company, companies, user } = useAuth()
  const { isOnline } = useOnlineStatus()

  // Reference lists
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([])
  const [templateItems, setTemplateItems] = useState<ChecklistTemplateItem[]>([])
  const [templateGroups, setTemplateGroups] = useState<ChecklistItemGroup[]>([])
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([])
  const [materialsList, setMaterialsList] = useState<Material[]>([])
  const [clientsList, setClientsList] = useState<Client[]>([])

  // Checklist state
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(company?.id || '')
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [title, setTitle] = useState('')
  const [code, setCode] = useState('')
  const [location, setLocation] = useState('')
  const [operationType, setOperationType] = useState('Içamento de Carga Geral')
  const [clientId, setClientId] = useState<string>('none')
  const [equipmentId, setEquipmentId] = useState<string>('none')
  const [materialId, setMaterialId] = useState<string>('none')
  const [riskLevel, setRiskLevel] = useState<'Baixo' | 'Médio' | 'Alto' | 'Crítico'>('Médio')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<'Pendente' | 'Em Andamento' | 'Concluído' | 'Reprovado'>(
    'Em Andamento',
  )
  const [filledByName, setFilledByName] = useState(user?.name || '')
  const [filledBySignature, setFilledBySignature] = useState<string | undefined>(undefined)
  const [completedAt, setCompletedAt] = useState<string | undefined>(undefined)
  const filledByPadRef = useRef<DigitalSignaturePadRef>(null)

  // Modal State for Finalization with Digital Signature
  const [isFinalizeModalOpen, setIsFinalizeModalOpen] = useState(false)
  const [finalizeTargetStatus, setFinalizeTargetStatus] = useState<'Concluído' | 'Reprovado'>(
    'Concluído',
  )

  // Answers Map: itemId -> ChecklistResponse
  const [responsesMap, setResponsesMap] = useState<Record<string, Partial<ChecklistResponse>>>({})
  const [createdAt, setCreatedAt] = useState<string | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  useEffect(() => {
    const targetCompId = selectedCompanyId || company?.id
    loadPrerequisites(targetCompId)
    const unsubscribe = syncService.subscribe(() => {
      loadPrerequisites(selectedCompanyId || company?.id)
    })
    return () => {
      unsubscribe()
    }
  }, [selectedCompanyId, company?.id, isOnline])

  const loadPrerequisites = async (targetCompanyId?: string) => {
    setLoading(true)
    try {
      const compToLoad = targetCompanyId || company?.id
      const [tpls, eqs, mats, cls] = await Promise.all([
        AppDataService.getTemplates(compToLoad, isOnline),
        AppDataService.getEquipment(compToLoad, isOnline),
        AppDataService.getMaterials(compToLoad, isOnline),
        AppDataService.getClients(compToLoad, isOnline),
      ])
      setTemplates(tpls)
      setEquipmentList(eqs)
      setMaterialsList(mats)
      setClientsList(cls)

      if (isNew) {
        if (tpls.length > 0) {
          handleSelectTemplate(tpls[0].id)
        }
        setCode(`CHK-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`)
        setTitle('Checklist Operacional de Içamento')
        setFilledByName(user?.name || '')
        setFilledBySignature(undefined)
      } else if (id) {
        // Load existing checklist
        const { checklist, responses } = await AppDataService.getChecklistById(id, isOnline)
        if (checklist) {
          if (checklist.company_id && checklist.company_id !== selectedCompanyId) {
            setSelectedCompanyId(checklist.company_id)
          }
          setTitle(checklist.title || '')
          setCode(checklist.code || '')
          setLocation(checklist.location || '')
          setOperationType(checklist.operation_type || 'Içamento')
          setClientId(checklist.client_id || 'none')
          setEquipmentId(checklist.equipment_id || 'none')
          setMaterialId(checklist.material_id || 'none')
          setRiskLevel(checklist.risk_level || 'Médio')
          setFilledByName(checklist.filled_by_name || user?.name || '')
          setFilledBySignature(checklist.filled_by_signature)
          setNotes(checklist.notes || '')
          setStatus(checklist.status)
          setCompletedAt(checklist.completed_at)
          setCreatedAt(checklist.created)
          setSelectedTemplateId(checklist.template_id)

          // Load template items and groups
          const [items, groups] = await Promise.all([
            AppDataService.getTemplateItems(checklist.template_id, isOnline),
            AppDataService.getItemGroups(checklist.template_id, isOnline),
          ])
          setTemplateItems(items)
          setTemplateGroups(groups)

          // Populate responses
          const rMap: Record<string, Partial<ChecklistResponse>> = {}
          responses.forEach((r) => {
            if (r.item_id) {
              rMap[r.item_id] = r
            } else {
              // match by title
              const matchedItem = items.find((it) => it.title === r.item_title)
              if (matchedItem) rMap[matchedItem.id] = r
            }
          })
          setResponsesMap(rMap)
        }
      }
    } catch (err) {
      console.error('Error loading checklist details:', err)
      toast.error('Erro ao carregar dados do checklist')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectTemplate = async (templateId: string) => {
    setSelectedTemplateId(templateId)
    try {
      const [items, groups] = await Promise.all([
        AppDataService.getTemplateItems(templateId, isOnline),
        AppDataService.getItemGroups(templateId, isOnline),
      ])
      setTemplateItems(items)
      setTemplateGroups(groups)

      const chosenTpl = templates.find((t) => t.id === templateId)
      if (chosenTpl && isNew) {
        setTitle(`Inspeção: ${chosenTpl.title}`)
      }

      // Initialize missing answers
      setResponsesMap((prev) => {
        const nextMap = { ...prev }
        items.forEach((it) => {
          if (!nextMap[it.id]) {
            nextMap[it.id] = {
              item_id: it.id,
              item_title: it.title,
              item_section: it.section,
              status: 'PENDENTE',
              observation: '',
              is_critical_fail: false,
            }
          }
        })
        return nextMap
      })
    } catch (err) {
      console.error('Error fetching template items and groups:', err)
    }
  }

  const handleResponseChange = (
    itemId: string,
    field: 'status' | 'observation' | 'value' | 'photo_url',
    val: any,
    itemMeta?: ChecklistTemplateItem,
  ) => {
    setResponsesMap((prev) => {
      const current = prev[itemId] || {
        item_id: itemId,
        item_title: itemMeta?.title || '',
        item_section: itemMeta?.section || '',
        status: 'PENDENTE',
      }

      const updated = { ...current, [field]: val }

      // Critical check
      if (field === 'status') {
        const isFail = val === 'NC' || val === 'NAO'
        updated.is_critical_fail = itemMeta?.is_critical && isFail
      }

      return {
        ...prev,
        [itemId]: updated,
      }
    })
  }

  const handleOpenFinalizeModal = (target: 'Concluído' | 'Reprovado') => {
    const effectiveCompId = selectedCompanyId || company?.id
    if (!effectiveCompId) {
      toast.warning('A seleção da empresa é obrigatória.')
      return
    }
    if (!selectedTemplateId) {
      toast.warning('Selecione um modelo de checklist.')
      return
    }
    if (!title.trim()) {
      toast.warning('Informe um título para o checklist.')
      return
    }

    setFinalizeTargetStatus(target)
    setIsFinalizeModalOpen(true)
  }

  const handleConfirmFinalize = async (data: {
    status: 'Concluído' | 'Reprovado'
    completedAt: string
    userId?: string
  }) => {
    const effectiveCompId = selectedCompanyId || company?.id
    if (!effectiveCompId) {
      toast.warning('A seleção da empresa é obrigatória.')
      return
    }

    setSaving(true)
    try {
      const finalUserId = data.userId || user?.id || ''

      const checklistData: Partial<Checklist> = {
        id: isNew ? undefined : id,
        company_id: effectiveCompId,
        template_id: selectedTemplateId,
        client_id: clientId === 'none' ? undefined : clientId,
        equipment_id: equipmentId === 'none' ? undefined : equipmentId,
        material_id: materialId === 'none' ? undefined : materialId,
        user_id: finalUserId,
        code,
        title,
        location,
        operation_type: operationType,
        status: data.status,
        risk_level: riskLevel,
        filled_by_name: filledByName,
        filled_by_signature: filledBySignature,
        notes,
        completed_at: data.completedAt,
      }

      const responsesList = Object.values(responsesMap).map((r) => ({
        ...r,
        checklist_id: isNew ? undefined : id,
      }))

      const res = await AppDataService.saveChecklist(checklistData, responsesList, isOnline)

      setStatus(data.status)
      setCompletedAt(data.completedAt)
      setIsFinalizeModalOpen(false)

      toast.success(
        data.status === 'Concluído'
          ? 'Checklist finalizado com sucesso e operação liberada!'
          : 'Checklist reprovado e registrado com sucesso.',
      )

      if (isNew && res.checklist.id) {
        navigate(`/checklists/${res.checklist.id}`, { replace: true })
      }
    } catch (err: any) {
      toast.error('Erro ao finalizar checklist: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const isFinalized = status === 'Concluído' || status === 'Reprovado'

  const handleExportPdf = async () => {
    if (!isFinalized) {
      toast.warning('Finalize o checklist antes de exportar o PDF.')
      return
    }

    setExportingPdf(true)
    try {
      const selectedComp =
        companies.find((c) => c.id === (selectedCompanyId || company?.id)) || company
      const selectedCli =
        clientId && clientId !== 'none' ? clientsList.find((c) => c.id === clientId) : null
      const selectedEq =
        equipmentId && equipmentId !== 'none'
          ? equipmentList.find((e) => e.id === equipmentId)
          : null
      const selectedMat =
        materialId && materialId !== 'none' ? materialsList.find((m) => m.id === materialId) : null

      const checklistObj: Checklist = {
        id: id || 'local',
        company_id: selectedCompanyId || company?.id || '',
        template_id: selectedTemplateId,
        client_id: clientId === 'none' ? undefined : clientId,
        equipment_id: equipmentId === 'none' ? undefined : equipmentId,
        material_id: materialId === 'none' ? undefined : materialId,
        user_id: user?.id || '',
        code,
        title,
        location,
        operation_type: operationType,
        scheduled_date: createdAt,
        completed_at: completedAt,
        status,
        risk_level: riskLevel,
        notes,
        filled_by_name: filledByName,
        filled_by_signature: filledBySignature,
        created: createdAt,
      }

      const responsesList = Object.values(responsesMap).map(
        (r) =>
          ({
            id: r.id || `resp_${Date.now()}`,
            checklist_id: id || '',
            item_id: r.item_id,
            item_title: r.item_title || '',
            item_section: r.item_section,
            status: r.status || 'PENDENTE',
            observation: r.observation,
            value: r.value,
            photo_url: r.photo_url,
            is_critical_fail: r.is_critical_fail,
          }) as ChecklistResponse,
      )

      await generateChecklistPdf({
        checklist: checklistObj,
        responses: responsesList,
        items: templateItems,
        groups: templateGroups,
        company: selectedComp,
        client: selectedCli,
        equipment: selectedEq,
        material: selectedMat,
      })

      toast.success('Relatório PDF gerado e baixado com sucesso!')
    } catch (err: any) {
      console.error('Error generating PDF:', err)
      toast.error('Erro ao gerar relatório PDF: ' + (err?.message || 'Erro desconhecido'))
    } finally {
      setExportingPdf(false)
    }
  }

  const handleSaveDraft = async () => {
    const effectiveCompId = selectedCompanyId || company?.id
    if (!effectiveCompId) {
      toast.warning('A seleção da empresa é obrigatória.')
      return
    }
    if (!selectedTemplateId) {
      toast.warning('Selecione um modelo de checklist.')
      return
    }
    if (!title.trim()) {
      toast.warning('Informe um título para o checklist.')
      return
    }

    setSaving(true)
    try {
      const checklistData: Partial<Checklist> = {
        id: isNew ? undefined : id,
        company_id: effectiveCompId,
        template_id: selectedTemplateId,
        client_id: clientId === 'none' ? undefined : clientId,
        equipment_id: equipmentId === 'none' ? undefined : equipmentId,
        material_id: materialId === 'none' ? undefined : materialId,
        user_id: user?.id || '',
        code,
        title,
        location,
        operation_type: operationType,
        status: status === 'Concluído' || status === 'Reprovado' ? status : 'Em Andamento',
        risk_level: riskLevel,
        filled_by_name: filledByName,
        filled_by_signature: filledBySignature,
        notes,
        completed_at: completedAt,
      }

      const responsesList = Object.values(responsesMap).map((r) => ({
        ...r,
        checklist_id: isNew ? undefined : id,
      }))

      const res = await AppDataService.saveChecklist(checklistData, responsesList, isOnline)
      toast.success(
        isOnline
          ? 'Rascunho do checklist salvo e sincronizado!'
          : 'Rascunho salvo no dispositivo (Offline).',
      )

      if (isNew && res.checklist.id) {
        navigate(`/checklists/${res.checklist.id}`, { replace: true })
      }
    } catch (err: any) {
      toast.error('Erro ao salvar rascunho: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  // Hierarchical display groups mirroring TemplatesPage
  interface DisplayGroup {
    group: ChecklistItemGroup | null // null means "Geral"
    name: string
    id: string
    groupNumber: number | null // 1, 2, 3... or null if "Geral"
    items: ChecklistTemplateItem[]
  }

  const displayGroups: DisplayGroup[] = []

  // Ensure templateGroups are ordered by sort_order
  const sortedTemplateGroups = [...templateGroups].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  )

  // Add defined groups with sequential numbering
  sortedTemplateGroups.forEach((grp, gIdx) => {
    const itemsInGroup = templateItems
      .filter((it) => it.group === grp.id)
      .sort((a, b) => (a.sort_order ?? a.order_num ?? 0) - (b.sort_order ?? b.order_num ?? 0))
    displayGroups.push({
      group: grp,
      name: grp.name,
      id: grp.id,
      groupNumber: gIdx + 1,
      items: itemsInGroup,
    })
  })

  // Add "Geral" group for unassigned items
  const knownGroupIds = new Set(templateGroups.map((g) => g.id))
  const unassignedItems = templateItems
    .filter((it) => !it.group || !knownGroupIds.has(it.group))
    .sort((a, b) => (a.sort_order ?? a.order_num ?? 0) - (b.sort_order ?? b.order_num ?? 0))

  if (unassignedItems.length > 0 || templateGroups.length === 0) {
    displayGroups.push({
      group: null,
      name: 'Geral',
      id: 'none',
      groupNumber: null,
      items: unassignedItems,
    })
  }

  const totalItems = templateItems.length
  const answeredCount = Object.values(responsesMap).filter(
    (r) => r.status && r.status !== 'PENDENTE',
  ).length
  const criticalFailsCount = Object.values(responsesMap).filter((r) => r.is_critical_fail).length

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate('/checklists')}
            className="border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-bold text-blue-400">
                {code || 'CHK-NOVO'}
              </span>
              <Badge
                variant="outline"
                className={`text-xs ${
                  status === 'Concluído'
                    ? 'border-emerald-500 text-emerald-400'
                    : status === 'Reprovado'
                      ? 'border-red-500 text-red-400'
                      : 'border-blue-500 text-blue-400'
                }`}
              >
                {status}
              </Badge>
              {completedAt ? (
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>
                    Finalizado em{' '}
                    <strong className="text-slate-200 font-medium">
                      {new Date(completedAt).toLocaleDateString('pt-BR')} às{' '}
                      {new Date(completedAt).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </strong>
                  </span>
                </span>
              ) : createdAt ? (
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span>
                    Criado em{' '}
                    <strong className="text-slate-200 font-medium">
                      {new Date(createdAt).toLocaleDateString('pt-BR')} às{' '}
                      {new Date(createdAt).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </strong>
                  </span>
                </span>
              ) : null}
              {!isOnline && (
                <Badge variant="outline" className="border-amber-500 text-amber-400 text-xs">
                  Modo Campo (Offline)
                </Badge>
              )}
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight mt-1">
              {title || 'Execução de Checklist de Içamento'}
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isFinalized && (
            <Button
              variant="outline"
              onClick={handleExportPdf}
              disabled={exportingPdf || saving}
              className="border-blue-600 bg-blue-950/40 text-blue-300 hover:bg-blue-900/60 text-xs font-semibold shadow-sm"
            >
              {exportingPdf ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <FileDown className="w-3.5 h-3.5 mr-1.5 text-blue-400" />
              )}
              Exportar PDF
            </Button>
          )}

          <Button
            variant="outline"
            onClick={handleSaveDraft}
            disabled={saving || exportingPdf}
            className="border-slate-800 bg-slate-900 text-slate-200 hover:bg-slate-800 text-xs"
          >
            <Save className="w-3.5 h-3.5 mr-1.5" /> Salvar Rascunho
          </Button>

          <Button
            onClick={() => handleOpenFinalizeModal('Concluído')}
            disabled={saving || exportingPdf}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-md shadow-emerald-600/20"
          >
            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Finalizar & Liberar Operação
          </Button>

          <Button
            onClick={() => handleOpenFinalizeModal('Reprovado')}
            disabled={saving || exportingPdf}
            variant="destructive"
            className="text-xs bg-red-600/90 hover:bg-red-600 font-medium"
          >
            <XCircle className="w-3.5 h-3.5 mr-1.5" /> Reprovar
          </Button>
        </div>
      </div>

      {/* Progress & Alert Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs text-slate-400">Progresso do Checklist</span>
              <div className="text-lg font-bold text-white">
                {answeredCount} de {totalItems} itens (
                {totalItems > 0 ? Math.round((answeredCount / totalItems) * 100) : 0}%)
              </div>
            </div>
            <div className="p-2.5 bg-blue-500/10 rounded-xl text-blue-400">
              <FileCheck className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs text-slate-400">Nível de Risco da Operação</span>
              <div className="text-lg font-bold text-amber-400">{riskLevel}</div>
            </div>
            <div className="p-2.5 bg-amber-500/10 rounded-xl text-amber-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs text-slate-400">Itens Críticos Reprovados</span>
              <div
                className={`text-lg font-bold ${criticalFailsCount > 0 ? 'text-red-400' : 'text-emerald-400'}`}
              >
                {criticalFailsCount} {criticalFailsCount > 0 ? '(Bloqueante)' : '(Conforme)'}
              </div>
            </div>
            <div
              className={`p-2.5 rounded-xl ${criticalFailsCount > 0 ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}
            >
              <ShieldCheck className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Checklist Header Details */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="pb-3 border-b border-slate-800">
          <CardTitle className="text-base text-white">Dados da Operação e Equipamentos</CardTitle>
          <CardDescription className="text-slate-400 text-xs">
            Associação de modelo de inspeção, obra, guindaste ou acessório de içamento
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          {/* Seletor de Empresa no Topo do Formulário */}
          <CompanySelect
            value={selectedCompanyId}
            onChange={(val) => {
              setSelectedCompanyId(val)
              loadPrerequisites(val)
            }}
            required
            label="Empresa Responsável pela Operação"
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300">Modelo de Checklist *</Label>
              <Select
                value={selectedTemplateId}
                onValueChange={(val) => handleSelectTemplate(val)}
                disabled={!isNew}
              >
                <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200 text-xs">
                  <SelectValue placeholder="Selecione o modelo" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                  {templates.map((tpl) => (
                    <SelectItem key={tpl.id} value={tpl.id} className="text-xs">
                      [{tpl.category}] {tpl.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300">Título / Descrição da Manobra *</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Içamento de Transformador 40t"
                className="bg-slate-950 border-slate-800 text-white text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300">Local / Obra / Canteiro</Label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Ex: Refinaria RPBC - Setor U-20"
                className="bg-slate-950 border-slate-800 text-white text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300">Cliente / Contratante</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200 text-xs">
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                  <SelectItem value="none">Nenhum / Não vinculado</SelectItem>
                  {clientsList.map((c) => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">
                      {c.trade_name || c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300">Guindaste / Munck</Label>
              <Select value={equipmentId} onValueChange={setEquipmentId}>
                <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200 text-xs">
                  <SelectValue placeholder="Selecione o equipamento" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                  <SelectItem value="none">Nenhum equipamento</SelectItem>
                  {equipmentList.map((e) => (
                    <SelectItem key={e.id} value={e.id} className="text-xs">
                      {e.type} {e.manufacturer} {e.model} ({e.capacity})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300">Acessório / TAG de Rigging</Label>
              <Select value={materialId} onValueChange={setMaterialId}>
                <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200 text-xs">
                  <SelectValue placeholder="Selecione o material" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                  <SelectItem value="none">Nenhum acessório</SelectItem>
                  {materialsList.map((m) => (
                    <SelectItem key={m.id} value={m.id} className="text-xs">
                      TAG: {m.tag} - {m.type} ({m.capacity})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300">Grau de Risco</Label>
              <Select value={riskLevel} onValueChange={(val: any) => setRiskLevel(val)}>
                <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200 text-xs">
                  <SelectValue placeholder="Nível de risco" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                  <SelectItem value="Baixo">Baixo (Operação Padrão)</SelectItem>
                  <SelectItem value="Médio">Médio (Içamento Monitorado)</SelectItem>
                  <SelectItem value="Alto">Alto (Içamento Crítico)</SelectItem>
                  <SelectItem value="Crítico">Crítico (Tandem / Espaço Confinado)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Card informativo de equipamento selecionado */}
          {equipmentId &&
            equipmentId !== 'none' &&
            (() => {
              const selectedEq = equipmentList.find((e) => e.id === equipmentId)
              if (!selectedEq) return null

              return (
                <div className="mt-2 p-3.5 bg-slate-950/80 border border-slate-800/80 rounded-xl space-y-2 animate-in fade-in-50 duration-200">
                  <div className="flex items-center justify-between gap-2 border-b border-slate-800/60 pb-2">
                    <div className="flex items-center gap-2">
                      <Truck className="w-4 h-4 text-blue-400 shrink-0" />
                      <span className="text-xs font-semibold text-slate-200">
                        Especificações do Equipamento
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-blue-950/40 text-blue-400 border-blue-800/60 font-normal"
                      >
                        {selectedEq.type || 'Equipamento'}
                      </Badge>
                    </div>
                    {selectedEq.status && (
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          selectedEq.status === 'Operacional'
                            ? 'border-emerald-700/60 text-emerald-400 bg-emerald-950/30'
                            : selectedEq.status === 'Em Manutenção'
                              ? 'border-amber-700/60 text-amber-400 bg-amber-950/30'
                              : 'border-slate-700 text-slate-400 bg-slate-900'
                        }`}
                      >
                        {selectedEq.status}
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-0.5 text-xs">
                    <div className="space-y-0.5">
                      <span className="text-[11px] text-slate-400">Fabricante</span>
                      <p className="font-medium text-slate-200 truncate">
                        {selectedEq.manufacturer || 'Não informado'}
                      </p>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-[11px] text-slate-400">Modelo</span>
                      <p className="font-medium text-slate-200 truncate">
                        {selectedEq.model || 'Não informado'}
                      </p>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-[11px] text-slate-400">Capacidade</span>
                      <p className="font-medium text-slate-200 truncate">
                        {selectedEq.capacity || 'Não informado'}
                      </p>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-[11px] text-slate-400">Placa</span>
                      <p className="font-medium text-slate-200 font-mono">
                        {selectedEq.license_plate || 'Sem placa / N/A'}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })()}
        </CardContent>
      </Card>

      {/* Card: Responsável pelo Preenchimento */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="pb-3 border-b border-slate-800">
          <CardTitle className="text-base text-white flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-blue-500" />
            Responsável pelo Preenchimento
          </CardTitle>
          <CardDescription className="text-slate-400 text-xs">
            Identificação do operador, rigger ou profissional que realizou a inspeção item por item
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          <div className="space-y-1.5 max-w-md">
            <Label className="text-xs text-slate-300">Nome do Responsável</Label>
            <Input
              value={filledByName}
              onChange={(e) => setFilledByName(e.target.value)}
              placeholder="Nome completo do responsável pelo preenchimento"
              className="bg-slate-950 border-slate-800 text-white text-xs"
            />
          </div>

          <div className="space-y-2 pt-1">
            <Label className="text-xs text-slate-300 flex items-center justify-between">
              <span>Assinatura do Responsável pelo Preenchimento</span>
              <span className="text-[11px] text-slate-500">(Opcional)</span>
            </Label>

            {filledBySignature ? (
              <div className="space-y-3 p-4 bg-slate-950 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-blue-950/80 text-blue-400 border border-blue-800 text-xs px-2.5 py-1">
                      <PenLine className="w-3.5 h-3.5 mr-1" /> Assinatura Registrada
                    </Badge>
                    <span className="text-xs text-slate-400">
                      Responsável:{' '}
                      <strong className="text-slate-200">{filledByName || 'Não informado'}</strong>
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setFilledBySignature(undefined)
                      if (filledByPadRef.current) {
                        filledByPadRef.current.clear()
                      }
                    }}
                    className="h-7 text-[11px] border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800"
                  >
                    <RotateCcw className="w-3 h-3 mr-1" /> Refazer Assinatura
                  </Button>
                </div>
                <div className="bg-white p-3 rounded-lg flex items-center justify-center border border-slate-300 shadow-inner max-w-md">
                  <img
                    src={filledBySignature}
                    alt="Assinatura do Responsável pelo Preenchimento"
                    className="max-h-24 object-contain"
                  />
                </div>
              </div>
            ) : (
              <DigitalSignaturePad
                ref={filledByPadRef}
                height={150}
                strokeColor="#1e3a5f"
                title="Área de Assinatura do Responsável pelo Preenchimento"
                signerName={filledByName || user?.name || ''}
                onSignatureChange={(_isEmpty, dataUrl) => {
                  setFilledBySignature(dataUrl || undefined)
                }}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Verification Items Checklist Sections */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-blue-500" />
          Itens de Verificação e Inspeção Visual
        </h2>

        {displayGroups.map((displayGrp) => (
          <Card
            key={displayGrp.id}
            className="bg-slate-900 border-slate-800 overflow-hidden shadow-sm"
          >
            <div className="bg-slate-950 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Folder className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="font-semibold text-xs text-blue-400 uppercase tracking-wider flex items-center gap-2">
                  {displayGrp.groupNumber !== null
                    ? `${displayGrp.groupNumber}. ${displayGrp.name}`
                    : displayGrp.name}
                  {displayGrp.group === null && (
                    <Badge
                      variant="outline"
                      className="text-[10px] border-slate-700 text-slate-400 font-normal lowercase"
                    >
                      geral
                    </Badge>
                  )}
                </span>
              </div>
              <span className="text-[11px] text-slate-500 font-normal">
                {displayGrp.items.length} {displayGrp.items.length === 1 ? 'item' : 'itens'}
              </span>
            </div>

            <CardContent className="p-0 divide-y divide-slate-800">
              {displayGrp.items.map((item, itemIdx) => {
                const currentResp = responsesMap[item.id] || {}
                const currentStatus = currentResp.status || 'PENDENTE'
                const itemNumberLabel =
                  displayGrp.groupNumber !== null
                    ? `${displayGrp.groupNumber}.${itemIdx + 1}`
                    : `${itemIdx + 1}.`

                return (
                  <div key={item.id} className="p-4 space-y-3 hover:bg-slate-850/50 transition">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-slate-400 font-mono text-xs font-semibold shrink-0">
                            {itemNumberLabel}
                          </span>
                          <span className="font-medium text-white text-sm">{item.title}</span>
                          {item.is_critical && (
                            <Badge className="bg-red-950/80 text-red-400 border border-red-800 text-[10px] px-1.5 py-0">
                              Item Crítico
                            </Badge>
                          )}
                          {item.is_mandatory && (
                            <Badge
                              variant="outline"
                              className="text-slate-400 border-slate-700 text-[10px] px-1.5 py-0"
                            >
                              Obrigatório
                            </Badge>
                          )}
                        </div>
                        {item.description && (
                          <p className="text-xs text-slate-400 pl-6">{item.description}</p>
                        )}
                      </div>

                      {/* Response Buttons */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {item.type === 'conforme_nao_conforme' && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleResponseChange(item.id, 'status', 'C', item)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 border transition ${
                                currentStatus === 'C'
                                  ? 'bg-emerald-600 border-emerald-500 text-white shadow-sm'
                                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
                              }`}
                            >
                              <Check className="w-3.5 h-3.5" /> Conforme
                            </button>

                            <button
                              type="button"
                              onClick={() => handleResponseChange(item.id, 'status', 'NC', item)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 border transition ${
                                currentStatus === 'NC'
                                  ? 'bg-red-600 border-red-500 text-white shadow-sm'
                                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
                              }`}
                            >
                              <X className="w-3.5 h-3.5" /> Não Conforme
                            </button>

                            <button
                              type="button"
                              onClick={() => handleResponseChange(item.id, 'status', 'NA', item)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 border transition ${
                                currentStatus === 'NA'
                                  ? 'bg-slate-700 border-slate-600 text-white shadow-sm'
                                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
                              }`}
                            >
                              <Minus className="w-3.5 h-3.5" /> N/A
                            </button>
                          </>
                        )}

                        {item.type === 'sim_nao_na' && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleResponseChange(item.id, 'status', 'SIM', item)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 border transition ${
                                currentStatus === 'SIM'
                                  ? 'bg-emerald-600 border-emerald-500 text-white shadow-sm'
                                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
                              }`}
                            >
                              <Check className="w-3.5 h-3.5" /> Sim
                            </button>

                            <button
                              type="button"
                              onClick={() => handleResponseChange(item.id, 'status', 'NAO', item)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 border transition ${
                                currentStatus === 'NAO'
                                  ? 'bg-red-600 border-red-500 text-white shadow-sm'
                                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
                              }`}
                            >
                              <X className="w-3.5 h-3.5" /> Não
                            </button>

                            <button
                              type="button"
                              onClick={() => handleResponseChange(item.id, 'status', 'NA', item)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 border transition ${
                                currentStatus === 'NA'
                                  ? 'bg-slate-700 border-slate-600 text-white shadow-sm'
                                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
                              }`}
                            >
                              <Minus className="w-3.5 h-3.5" /> N/A
                            </button>
                          </>
                        )}

                        {item.type === 'numero' && (
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              placeholder="Valor / Medição"
                              value={currentResp.value || ''}
                              onChange={(e) => {
                                handleResponseChange(item.id, 'value', e.target.value, item)
                                handleResponseChange(item.id, 'status', 'C', item)
                              }}
                              className="w-32 bg-slate-950 border-slate-800 text-white text-xs h-8"
                            />
                            <Badge
                              variant="outline"
                              className="text-xs text-slate-400 border-slate-800"
                            >
                              Numérico
                            </Badge>
                          </div>
                        )}

                        {item.type === 'foto_obrigatoria' && (
                          <button
                            type="button"
                            onClick={() => {
                              handleResponseChange(item.id, 'status', 'C', item)
                              handleResponseChange(
                                item.id,
                                'photo_url',
                                'https://img.usecurling.com/p/600/400?q=crane%20inspection',
                                item,
                              )
                              toast.success('Foto de evidência anexada.')
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition ${
                              currentResp.photo_url
                                ? 'bg-blue-600 border-blue-500 text-white'
                                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                            }`}
                          >
                            <Camera className="w-3.5 h-3.5" />
                            {currentResp.photo_url ? 'Foto Anexada' : 'Capturar Foto'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Optional / Required Observation input when non-conforming */}
                    {(currentStatus === 'NC' ||
                      currentStatus === 'NAO' ||
                      currentResp.observation) && (
                      <div className="pt-2">
                        <Input
                          placeholder="Observação detalhada / motivo da não-conformidade..."
                          value={currentResp.observation || ''}
                          onChange={(e) =>
                            handleResponseChange(item.id, 'observation', e.target.value, item)
                          }
                          className="bg-slate-950 border-red-900/60 text-white text-xs placeholder:text-slate-500"
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>
        ))}

        {templateItems.length === 0 && (
          <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-xl text-slate-500 text-xs">
            Selecione um modelo acima para carregar os itens de verificação.
          </div>
        )}
      </div>

      {/* General Observations & Sign-off */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="pb-3 border-b border-slate-800">
          <CardTitle className="text-base text-white">Parecer Final & Liberação</CardTitle>
          <CardDescription className="text-slate-400 text-xs">
            Observações finais do rigger / operador e parecer técnico da operação
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-300">
              Observações Gerais / Recomendações de Rigging
            </Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Velocidade do vento aferida em 14 km/h. Isolamento de área verificado e aprovado com raio de 25 metros."
              rows={3}
              className="bg-slate-950 border-slate-800 text-white text-xs placeholder:text-slate-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300">Status Geral do Checklist</Label>
              <Select value={status} onValueChange={(val: any) => setStatus(val)}>
                <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                  <SelectItem value="Pendente">Pendente</SelectItem>
                  <SelectItem value="Em Andamento">Em Andamento</SelectItem>
                  <SelectItem value="Concluído">Concluído (Operação Liberada)</SelectItem>
                  <SelectItem value="Reprovado">Reprovado (Operação Bloqueada)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end gap-2">
              <Button
                type="button"
                onClick={() => handleOpenFinalizeModal('Concluído')}
                disabled={saving || exportingPdf}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-md shadow-emerald-600/20"
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Finalizar & Liberar
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => handleOpenFinalizeModal('Reprovado')}
                disabled={saving || exportingPdf}
                className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold"
              >
                <XCircle className="w-3.5 h-3.5 mr-1.5" /> Reprovar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Floating Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-950/90 backdrop-blur border-t border-slate-800 z-30 flex items-center justify-between max-w-5xl mx-auto rounded-t-xl">
        <div className="text-xs text-slate-400">
          Respondidos:{' '}
          <strong className="text-white">
            {answeredCount}/{totalItems}
          </strong>
          {criticalFailsCount > 0 && (
            <span className="text-red-400 font-semibold ml-2">
              ({criticalFailsCount} reprovações críticas)
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isFinalized && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPdf}
              disabled={exportingPdf || saving}
              className="border-blue-600 bg-blue-950/40 text-blue-300 hover:bg-blue-900/60 text-xs font-semibold"
            >
              {exportingPdf ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <FileDown className="w-3.5 h-3.5 mr-1.5 text-blue-400" />
              )}
              Exportar PDF
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleSaveDraft}
            disabled={saving || exportingPdf}
            className="border-slate-800 bg-slate-900 text-slate-300 text-xs"
          >
            Salvar Rascunho
          </Button>

          <Button
            size="sm"
            onClick={() => handleOpenFinalizeModal('Concluído')}
            disabled={saving || exportingPdf}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-md shadow-emerald-600/20"
          >
            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Finalizar & Liberar Operação
          </Button>
        </div>{' '}
      </div>

      {/* Finalization Modal with Mandatory Digital Signature */}
      <FinalizeChecklistModal
        isOpen={isFinalizeModalOpen}
        onClose={() => setIsFinalizeModalOpen(false)}
        onConfirm={handleConfirmFinalize}
        targetStatus={finalizeTargetStatus}
        checklistCode={code}
        checklistTitle={title}
        answeredCount={answeredCount}
        totalItems={totalItems}
        criticalFailsCount={criticalFailsCount}
        saving={saving}
      />
    </div>
  )
}
