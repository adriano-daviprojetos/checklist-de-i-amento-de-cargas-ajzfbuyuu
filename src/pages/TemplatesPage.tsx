import React, { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { AppDataService } from '@/services/appDataService'
import { syncService } from '@/lib/offline/sync-service'
import {
  ChecklistTemplate,
  ChecklistTemplateItem,
  ChecklistItemGroup,
  TemplateCategory,
  TargetRole,
  ItemType,
} from '@/types'
import { CompanySelect } from '@/components/CompanySelect'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
  FileSpreadsheet,
  Plus,
  Trash2,
  Edit2,
  Search,
  FolderPlus,
  Folder,
  Layers,
  ArrowUp,
  ArrowDown,
  GripVertical,
  MoveRight,
  Sparkles,
  Check,
} from 'lucide-react'
import { toast } from 'sonner'

export const TemplatesPage: React.FC = () => {
  const { company, companies, hasModulePermission } = useAuth()
  const { isOnline } = useOnlineStatus()

  const canEdit = hasModulePermission('templates', 'edit')
  const canDelete = hasModulePermission('templates', 'delete')

  const [templates, setTemplates] = useState<ChecklistTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<ChecklistTemplate | null>(null)
  const [templateItems, setTemplateItems] = useState<ChecklistTemplateItem[]>([])
  const [templateGroups, setTemplateGroups] = useState<ChecklistItemGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Modal create/edit Template
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(company?.id || '')
  const [editTitle, setEditTitle] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editCategory, setEditCategory] = useState<TemplateCategory>('Guindaste')
  const [editTargetRole, setEditTargetRole] = useState<TargetRole>('Todos')
  const [editGroups, setEditGroups] = useState<Partial<ChecklistItemGroup>[]>([])
  const [editItems, setEditItems] = useState<Partial<ChecklistTemplateItem>[]>([])

  // Modal / Inline Group Management on Details View
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<Partial<ChecklistItemGroup> | null>(null)
  const [groupNameInput, setGroupNameInput] = useState('')

  // Modal / Item fast create/edit on Details View
  const [isItemModalOpen, setIsItemModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Partial<ChecklistTemplateItem> | null>(null)
  const [itemTitleInput, setItemTitleInput] = useState('')
  const [itemTypeInput, setItemTypeInput] = useState<ItemType>('conforme_nao_conforme')
  const [itemGroupInput, setItemGroupInput] = useState<string>('none')
  const [itemMandatoryInput, setItemMandatoryInput] = useState(true)
  const [itemCriticalInput, setItemCriticalInput] = useState(false)
  const [itemDescInput, setItemDescInput] = useState('')

  useEffect(() => {
    loadTemplates()
    const unsubscribe = syncService.subscribe(() => {
      loadTemplates()
    })
    return () => {
      unsubscribe()
    }
  }, [company?.id, isOnline])

  const loadTemplates = async () => {
    setLoading(true)
    try {
      const data = await AppDataService.getTemplates(company?.id, isOnline)
      setTemplates(data)
      if (data.length > 0) {
        if (!selectedTemplate || !data.some((d) => d.id === selectedTemplate.id)) {
          handleSelectTemplate(data[0])
        } else {
          // reload selected template items and groups
          const cur = data.find((d) => d.id === selectedTemplate.id) || data[0]
          handleSelectTemplate(cur)
        }
      } else {
        setSelectedTemplate(null)
        setTemplateItems([])
        setTemplateGroups([])
      }
    } catch (err) {
      console.error('Error loading templates:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectTemplate = async (tpl: ChecklistTemplate) => {
    setSelectedTemplate(tpl)
    try {
      const [items, groups] = await Promise.all([
        AppDataService.getTemplateItems(tpl.id, isOnline),
        AppDataService.getItemGroups(tpl.id, isOnline),
      ])
      setTemplateItems(items)
      setTemplateGroups(groups)
    } catch (err) {
      console.error('Error loading template details:', err)
    }
  }

  const handleDeleteTemplate = async (e: React.MouseEvent, tplId: string) => {
    e.stopPropagation()
    if (
      !confirm('Deseja realmente excluir este modelo de checklist e todos os seus grupos e itens?')
    )
      return
    try {
      await AppDataService.deleteTemplate(tplId, isOnline)
      setTemplates((prev) => prev.filter((t) => t.id !== tplId))
      if (selectedTemplate?.id === tplId) {
        setSelectedTemplate(null)
        setTemplateItems([])
        setTemplateGroups([])
      }
      toast.success('Modelo excluído com sucesso.')
    } catch (err: any) {
      toast.error('Erro ao excluir modelo: ' + err.message)
    }
  }

  const openNewTemplateModal = () => {
    setSelectedCompanyId(company?.id || companies[0]?.id || '')
    setEditTitle('')
    setEditDesc('')
    setEditCategory('Guindaste')
    setEditTargetRole('Operador')

    const defaultG1Id = `temp_grp_1`
    const defaultG2Id = `temp_grp_2`

    setEditGroups([
      { id: defaultG1Id, name: 'Condições Mecânicas e Estrutura', sort_order: 1 },
      { id: defaultG2Id, name: 'Cabos, Ganchos e Acessórios', sort_order: 2 },
    ])

    setEditItems([
      {
        id: `temp_item_1`,
        group: defaultG1Id,
        section: 'Condições Mecânicas e Estrutura',
        title: 'Verificação visual de patolas e estabilização de solo',
        type: 'conforme_nao_conforme',
        is_mandatory: true,
        is_critical: true,
        sort_order: 1,
      },
      {
        id: `temp_item_2`,
        group: defaultG2Id,
        section: 'Cabos, Ganchos e Acessórios',
        title: 'Inspeção do cabo de aço principal e trava de segurança do gancho',
        type: 'conforme_nao_conforme',
        is_mandatory: true,
        is_critical: true,
        sort_order: 1,
      },
    ])
    setIsModalOpen(true)
  }

  const openEditModal = async (tpl: ChecklistTemplate) => {
    setSelectedCompanyId(tpl.company_id || company?.id || companies[0]?.id || '')
    setEditTitle(tpl.title)
    setEditDesc(tpl.description || '')
    setEditCategory(tpl.category)
    setEditTargetRole(tpl.target_role || 'Todos')
    const [items, groups] = await Promise.all([
      AppDataService.getTemplateItems(tpl.id, isOnline),
      AppDataService.getItemGroups(tpl.id, isOnline),
    ])
    setEditGroups(groups)
    setEditItems(items)
    setIsModalOpen(true)
  }

  const addGroupInModal = () => {
    const newGId = `temp_grp_${Date.now()}`
    setEditGroups([
      ...editGroups,
      {
        id: newGId,
        name: `Novo Grupo ${editGroups.length + 1}`,
        sort_order: editGroups.length + 1,
      },
    ])
  }

  const removeGroupInModal = (index: number) => {
    const groupToRemove = editGroups[index]
    const updatedGroups = editGroups.filter((_, i) => i !== index)
    setEditGroups(updatedGroups)

    // Unlink items that had this group
    if (groupToRemove?.id) {
      setEditItems(
        editItems.map((item) =>
          item.group === groupToRemove.id ? { ...item, group: undefined } : item,
        ),
      )
    }
  }

  const moveGroupOrderInModal = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === editGroups.length - 1) return

    const targetIndex = direction === 'up' ? index - 1 : index + 1
    const newGroups = [...editGroups]
    const temp = newGroups[index]
    newGroups[index] = newGroups[targetIndex]
    newGroups[targetIndex] = temp

    // re-assign sort_orders
    newGroups.forEach((g, idx) => {
      g.sort_order = idx + 1
    })

    setEditGroups(newGroups)
  }

  const addItemInModal = () => {
    const defaultGroup = editGroups.length > 0 ? editGroups[0].id : undefined
    setEditItems([
      ...editItems,
      {
        id: `temp_item_${Date.now()}`,
        group: defaultGroup,
        section: 'Geral',
        title: 'Novo item de inspeção',
        type: 'conforme_nao_conforme',
        is_mandatory: true,
        is_critical: false,
        sort_order: editItems.length + 1,
      },
    ])
  }

  const removeItemInModal = (index: number) => {
    setEditItems(editItems.filter((_, i) => i !== index))
  }

  const handleSaveTemplateModal = async () => {
    if (!selectedCompanyId) {
      toast.warning('A seleção da empresa é obrigatória.')
      return
    }

    if (!editTitle.trim()) {
      toast.warning('Informe um título para o modelo.')
      return
    }

    try {
      const payload: Partial<ChecklistTemplate> = {
        id:
          selectedTemplate?.id && isModalOpen && editTitle === selectedTemplate.title
            ? selectedTemplate.id
            : undefined,
        company_id: selectedCompanyId,
        title: editTitle,
        description: editDesc,
        category: editCategory,
        target_role: editTargetRole,
        active: true,
        version: 1,
      }

      const saved = await AppDataService.saveTemplate(payload, editItems, isOnline, editGroups)
      toast.success('Modelo de checklist salvo com sucesso!')
      setIsModalOpen(false)
      await loadTemplates()
      if (saved?.id) {
        handleSelectTemplate(saved)
      }
    } catch (err: any) {
      toast.error('Erro ao salvar modelo: ' + err.message)
    }
  }

  // --- Group Actions directly from Details View ---
  const openNewGroupDialog = () => {
    if (!selectedTemplate) return
    setEditingGroup(null)
    setGroupNameInput('')
    setIsGroupModalOpen(true)
  }

  const openEditGroupDialog = (group: ChecklistItemGroup) => {
    setEditingGroup(group)
    setGroupNameInput(group.name)
    setIsGroupModalOpen(true)
  }

  const handleSaveGroupDialog = async () => {
    if (!selectedTemplate) return
    if (!groupNameInput.trim()) {
      toast.warning('Informe o nome do grupo.')
      return
    }

    try {
      const groupData: Partial<ChecklistItemGroup> = {
        id: editingGroup?.id,
        template: selectedTemplate.id,
        company: selectedTemplate.company_id || company?.id,
        name: groupNameInput.trim(),
        sort_order: editingGroup?.sort_order ?? templateGroups.length + 1,
      }

      await AppDataService.saveItemGroup(groupData, isOnline)
      toast.success(editingGroup ? 'Grupo atualizado!' : 'Grupo criado!')
      setIsGroupModalOpen(false)
      const groups = await AppDataService.getItemGroups(selectedTemplate.id, isOnline)
      setTemplateGroups(groups)
    } catch (err: any) {
      toast.error('Erro ao salvar grupo: ' + err.message)
    }
  }

  const handleDeleteGroup = async (groupId: string, groupName: string) => {
    if (
      !confirm(
        `Deseja realmente excluir o grupo "${groupName}"? Os itens pertencentes a ele serão movidos para o grupo Geral.`,
      )
    ) {
      return
    }

    try {
      await AppDataService.deleteItemGroup(groupId, isOnline)
      if (selectedTemplate) {
        const [items, groups] = await Promise.all([
          AppDataService.getTemplateItems(selectedTemplate.id, isOnline),
          AppDataService.getItemGroups(selectedTemplate.id, isOnline),
        ])
        setTemplateItems(items)
        setTemplateGroups(groups)
      }
      toast.success('Grupo excluído com sucesso.')
    } catch (err: any) {
      toast.error('Erro ao excluir grupo: ' + err.message)
    }
  }

  const handleMoveGroupOrder = async (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === templateGroups.length - 1) return

    const targetIndex = direction === 'up' ? index - 1 : index + 1
    const newGroups = [...templateGroups]
    const temp = newGroups[index]
    newGroups[index] = newGroups[targetIndex]
    newGroups[targetIndex] = temp

    // Update sort_order locally first
    newGroups.forEach((g, idx) => {
      g.sort_order = idx + 1
    })
    setTemplateGroups([...newGroups])

    try {
      for (let i = 0; i < newGroups.length; i++) {
        await AppDataService.saveItemGroup(newGroups[i], isOnline)
      }
      toast.success('Ordem dos grupos atualizada.')
    } catch (err: any) {
      toast.error('Erro ao reordenar grupos: ' + err.message)
    }
  }

  // --- Item Actions directly from Details View ---
  const openNewItemDialog = (defaultGroupId?: string) => {
    if (!selectedTemplate) return
    setEditingItem(null)
    setItemTitleInput('')
    setItemDescInput('')
    setItemTypeInput('conforme_nao_conforme')
    setItemGroupInput(defaultGroupId || 'none')
    setItemMandatoryInput(true)
    setItemCriticalInput(false)
    setIsItemModalOpen(true)
  }

  const openEditItemDialog = (item: ChecklistTemplateItem) => {
    setEditingItem(item)
    setItemTitleInput(item.title)
    setItemDescInput(item.description || '')
    setItemTypeInput(item.type)
    setItemGroupInput(item.group || 'none')
    setItemMandatoryInput(item.is_mandatory ?? true)
    setItemCriticalInput(item.is_critical ?? false)
    setIsItemModalOpen(true)
  }

  const handleSaveItemDialog = async () => {
    if (!selectedTemplate) return
    if (!itemTitleInput.trim()) {
      toast.warning('Informe o título do item.')
      return
    }

    try {
      const targetGroup = itemGroupInput !== 'none' ? itemGroupInput : undefined
      const groupObj = templateGroups.find((g) => g.id === targetGroup)

      const itemData: Partial<ChecklistTemplateItem> = {
        id: editingItem?.id,
        template_id: selectedTemplate.id,
        group: targetGroup,
        section: groupObj ? groupObj.name : 'Geral',
        title: itemTitleInput.trim(),
        description: itemDescInput.trim(),
        type: itemTypeInput,
        is_mandatory: itemMandatoryInput,
        is_critical: itemCriticalInput,
        sort_order: editingItem?.sort_order ?? templateItems.length + 1,
      }

      // Save using existing items array update
      let updatedItems: Partial<ChecklistTemplateItem>[] = []
      if (editingItem?.id) {
        updatedItems = templateItems.map((it) =>
          it.id === editingItem.id ? { ...it, ...itemData } : it,
        )
      } else {
        updatedItems = [...templateItems, itemData]
      }

      await AppDataService.saveTemplate(selectedTemplate, updatedItems, isOnline, templateGroups)
      toast.success(editingItem ? 'Item atualizado com sucesso!' : 'Novo item adicionado!')
      setIsItemModalOpen(false)
      const items = await AppDataService.getTemplateItems(selectedTemplate.id, isOnline)
      setTemplateItems(items)
    } catch (err: any) {
      toast.error('Erro ao salvar item: ' + err.message)
    }
  }

  const handleDeleteItem = async (itemId: string) => {
    if (!selectedTemplate) return
    if (!confirm('Deseja realmente excluir este item?')) return

    try {
      const remaining = templateItems.filter((it) => it.id !== itemId)
      await AppDataService.saveTemplate(selectedTemplate, remaining, isOnline, templateGroups)
      setTemplateItems(remaining)
      toast.success('Item removido com sucesso.')
    } catch (err: any) {
      toast.error('Erro ao excluir item: ' + err.message)
    }
  }

  const handleMoveItemOrder = async (item: ChecklistTemplateItem, direction: 'up' | 'down') => {
    if (!selectedTemplate) return

    // Sort within its current group list
    const currentGroupId = item.group || 'none'
    const sameGroupItems = templateItems.filter((it) => (it.group || 'none') === currentGroupId)
    const itemIndex = sameGroupItems.findIndex((it) => it.id === item.id)

    if (direction === 'up' && itemIndex === 0) return
    if (direction === 'down' && itemIndex === sameGroupItems.length - 1) return

    const targetIndex = direction === 'up' ? itemIndex - 1 : itemIndex + 1
    const swappedItem = sameGroupItems[targetIndex]

    // Swap sort_order between item and swappedItem
    const currentSort = item.sort_order ?? itemIndex + 1
    const targetSort = swappedItem.sort_order ?? targetIndex + 1

    const updated = templateItems.map((it) => {
      if (it.id === item.id) {
        return { ...it, sort_order: targetSort }
      }
      if (it.id === swappedItem.id) {
        return { ...it, sort_order: currentSort }
      }
      return it
    })

    try {
      await AppDataService.saveTemplate(selectedTemplate, updated, isOnline, templateGroups)
      const items = await AppDataService.getTemplateItems(selectedTemplate.id, isOnline)
      setTemplateItems(items)
      toast.success('Ordem do item atualizada.')
    } catch (err: any) {
      toast.error('Erro ao reordenar item: ' + err.message)
    }
  }

  const handleQuickMoveGroup = async (item: ChecklistTemplateItem, targetGroupId: string) => {
    if (!selectedTemplate) return
    try {
      const finalGroupId = targetGroupId === 'none' ? undefined : targetGroupId
      const groupObj = templateGroups.find((g) => g.id === finalGroupId)
      const updated = templateItems.map((it) =>
        it.id === item.id
          ? {
              ...it,
              group: finalGroupId,
              section: groupObj ? groupObj.name : 'Geral',
            }
          : it,
      )
      await AppDataService.saveTemplate(selectedTemplate, updated, isOnline, templateGroups)
      const items = await AppDataService.getTemplateItems(selectedTemplate.id, isOnline)
      setTemplateItems(items)
      toast.success(`Item movido para "${groupObj ? groupObj.name : 'Geral'}"`)
    } catch (err: any) {
      toast.error('Erro ao mover item: ' + err.message)
    }
  }

  const filtered = templates
    .filter((t) => (company?.id ? t.company_id === company.id : true))
    .filter(
      (t) =>
        t.title.toLowerCase().includes(search.toLowerCase()) ||
        t.category.toLowerCase().includes(search.toLowerCase()),
    )

  // Grouping logic for Details Display
  // 1. Grouped items in templateGroups (ordered by sort_order)
  // 2. Default "Geral" group for items without group or whose group was deleted
  interface DisplayGroup {
    group: ChecklistItemGroup | null // null means "Geral"
    name: string
    id: string
    groupNumber: number | null // 1, 2, 3... or null if "Geral" (no group)
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-blue-500" />
            Modelos de Checklist (Templates)
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Padronize os itens e grupos de verificação para guindastes, muncks, lingadas e rigging.
          </p>
        </div>

        {canEdit && (
          <Button
            onClick={openNewTemplateModal}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-md shadow-blue-500/20 text-xs"
          >
            <Plus className="w-4 h-4 mr-1.5" /> Criar Novo Modelo
          </Button>
        )}
      </div>

      {/* Grid: Templates List & Details Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Templates Sidebar */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              placeholder="Buscar modelos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-slate-900 border-slate-800 text-white text-xs"
            />
          </div>

          <div className="space-y-2 max-h-[75vh] overflow-y-auto">
            {filtered.map((tpl) => (
              <div
                key={tpl.id}
                onClick={() => handleSelectTemplate(tpl)}
                className={`p-3.5 rounded-xl border transition cursor-pointer select-none ${
                  selectedTemplate?.id === tpl.id
                    ? 'bg-blue-950/40 border-blue-500/60 shadow-sm'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <Badge
                    variant="outline"
                    className="border-blue-500/40 text-blue-400 text-[10px] px-1.5 py-0"
                  >
                    {tpl.category}
                  </Badge>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-500">
                      Perfil: {tpl.target_role || 'Todos'}
                    </span>
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => handleDeleteTemplate(e, tpl.id)}
                        className="h-5 w-5 text-slate-500 hover:text-red-400 hover:bg-red-950/20 ml-1"
                        title="Excluir Modelo"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="mb-1">
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-slate-950 border-slate-800 text-slate-300 font-normal"
                  >
                    {companies.find((comp) => comp.id === tpl.company_id)?.trade_name ||
                      companies.find((comp) => comp.id === tpl.company_id)?.name ||
                      company?.name ||
                      'Empresa Padrão'}
                  </Badge>
                </div>
                <h4 className="font-semibold text-white text-sm">{tpl.title}</h4>
                {tpl.description && (
                  <p className="text-xs text-slate-400 line-clamp-2 mt-1">{tpl.description}</p>
                )}
              </div>
            ))}

            {filtered.length === 0 && (
              <div className="p-6 text-center text-xs text-slate-500 bg-slate-900 border border-slate-800 rounded-xl">
                Nenhum modelo encontrado.
              </div>
            )}
          </div>
        </div>

        {/* Selected Template Details View */}
        <div className="lg:col-span-2">
          {selectedTemplate ? (
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader className="pb-3 border-b border-slate-800 flex flex-row items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-blue-950 text-blue-400 border border-blue-800 text-xs">
                      {selectedTemplate.category}
                    </Badge>
                    <Badge variant="outline" className="border-slate-700 text-slate-400 text-xs">
                      Alvo: {selectedTemplate.target_role || 'Todos'}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="text-xs bg-slate-950 border-slate-800 text-slate-300"
                    >
                      {companies.find((comp) => comp.id === selectedTemplate.company_id)
                        ?.trade_name ||
                        companies.find((comp) => comp.id === selectedTemplate.company_id)?.name ||
                        company?.name ||
                        'Empresa'}
                    </Badge>
                  </div>
                  <CardTitle className="text-lg text-white mt-2">
                    {selectedTemplate.title}
                  </CardTitle>
                  {selectedTemplate.description && (
                    <CardDescription className="text-slate-400 text-xs mt-1">
                      {selectedTemplate.description}
                    </CardDescription>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {canEdit && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEditModal(selectedTemplate)}
                      className="border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800 text-xs"
                    >
                      <Edit2 className="w-3.5 h-3.5 mr-1" /> Editar Modelo
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => handleDeleteTemplate(e, selectedTemplate.id)}
                      className="border-red-900/40 bg-red-950/20 text-red-400 hover:bg-red-950/40 hover:text-red-300 text-xs"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" /> Excluir
                    </Button>
                  )}
                </div>
              </CardHeader>

              <CardContent className="p-4 space-y-5">
                {/* Section header with Action Buttons for Groups & Items */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-blue-400" />
                    <span className="font-semibold text-xs text-slate-200 uppercase tracking-wider">
                      Grupos e Itens do Modelo ({templateItems.length}{' '}
                      {templateItems.length === 1 ? 'item' : 'itens'} em {templateGroups.length}{' '}
                      {templateGroups.length === 1 ? 'grupo' : 'grupos'})
                    </span>
                  </div>

                  {canEdit && (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={openNewGroupDialog}
                        className="border-blue-900/50 bg-blue-950/30 text-blue-300 hover:bg-blue-900/40 text-xs h-8"
                      >
                        <FolderPlus className="w-3.5 h-3.5 mr-1 text-blue-400" /> Novo Grupo
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => openNewItemDialog()}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar Item
                      </Button>
                    </div>
                  )}
                </div>

                {/* Display groups and items under each group */}
                <div className="space-y-4">
                  {displayGroups.map((displayGrp, gIdx) => (
                    <div
                      key={displayGrp.id}
                      className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/60 transition shadow-sm"
                    >
                      {/* Group Header */}
                      <div className="p-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Folder className="w-4 h-4 text-blue-400 shrink-0" />
                          <div>
                            <span className="font-semibold text-sm text-white flex items-center gap-2">
                              {displayGrp.groupNumber !== null
                                ? `${displayGrp.groupNumber}. ${displayGrp.name}`
                                : displayGrp.name}
                              {displayGrp.group === null && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] border-slate-700 text-slate-400 font-normal"
                                >
                                  Padrão
                                </Badge>
                              )}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {displayGrp.items.length}{' '}
                              {displayGrp.items.length === 1 ? 'item' : 'itens'}
                            </span>
                          </div>
                        </div>

                        {/* Group Actions */}
                        {canEdit && (
                          <div className="flex items-center gap-1">
                            {displayGrp.group && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleMoveGroupOrder(gIdx, 'up')}
                                  disabled={gIdx === 0}
                                  className="h-7 w-7 text-slate-400 hover:text-white disabled:opacity-30"
                                  title="Subir Grupo"
                                >
                                  <ArrowUp className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleMoveGroupOrder(gIdx, 'down')}
                                  disabled={gIdx === templateGroups.length - 1}
                                  className="h-7 w-7 text-slate-400 hover:text-white disabled:opacity-30"
                                  title="Descer Grupo"
                                >
                                  <ArrowDown className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openEditGroupDialog(displayGrp.group!)}
                                  className="h-7 w-7 text-slate-400 hover:text-blue-300"
                                  title="Editar Grupo"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() =>
                                    handleDeleteGroup(displayGrp.group!.id, displayGrp.group!.name)
                                  }
                                  className="h-7 w-7 text-slate-400 hover:text-red-400"
                                  title="Excluir Grupo"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </>
                            )}

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openNewItemDialog(displayGrp.group?.id)}
                              className="text-[11px] h-7 text-blue-400 hover:text-blue-300 hover:bg-blue-950/40 ml-1"
                            >
                              <Plus className="w-3 h-3 mr-1" /> Novo Item
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Items List in Group */}
                      <div className="divide-y divide-slate-800/80">
                        {displayGrp.items.map((item, itemIdx) => (
                          <div
                            key={item.id}
                            className="p-3 hover:bg-slate-900/40 transition flex items-center justify-between gap-3 text-xs"
                          >
                            <div className="space-y-1 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-slate-400 font-mono text-[11px] font-medium">
                                  {displayGrp.groupNumber !== null
                                    ? `${displayGrp.groupNumber}.${itemIdx + 1}`
                                    : `${itemIdx + 1}.`}
                                </span>
                                <span className="font-medium text-white text-xs">{item.title}</span>
                                {item.is_critical && (
                                  <Badge className="bg-red-950 text-red-400 border border-red-800 text-[10px] px-1.5 py-0">
                                    Crítico
                                  </Badge>
                                )}
                                {item.is_mandatory && (
                                  <Badge
                                    variant="outline"
                                    className="text-slate-400 border-slate-700 text-[10px] px-1 py-0"
                                  >
                                    Obrigatório
                                  </Badge>
                                )}
                              </div>
                              {item.description && (
                                <p className="text-[11px] text-slate-400 pl-4">
                                  {item.description}
                                </p>
                              )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <Badge
                                variant="outline"
                                className="text-[10px] text-slate-400 border-slate-800"
                              >
                                {item.type === 'conforme_nao_conforme'
                                  ? 'C / NC / NA'
                                  : item.type === 'sim_nao_na'
                                    ? 'Sim / Não / NA'
                                    : item.type === 'numero'
                                      ? 'Numérico'
                                      : item.type === 'foto_obrigatoria'
                                        ? 'Foto'
                                        : 'Texto'}
                              </Badge>

                              {canEdit && (
                                <div className="flex items-center gap-1">
                                  {/* Quick move group select */}
                                  <Select
                                    value={item.group || 'none'}
                                    onValueChange={(val) => handleQuickMoveGroup(item, val)}
                                  >
                                    <SelectTrigger className="h-6 text-[10px] bg-slate-950 border-slate-800 text-slate-400 w-28 px-2 py-0">
                                      <SelectValue placeholder="Mover grupo" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-900 border-slate-800 text-slate-200 text-xs">
                                      <SelectItem value="none">Geral</SelectItem>
                                      {templateGroups.map((g, grpIdx) => (
                                        <SelectItem key={g.id} value={g.id}>
                                          {grpIdx + 1}. {g.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>

                                  {/* Move order up/down within group */}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleMoveItemOrder(item, 'up')}
                                    disabled={itemIdx === 0}
                                    className="h-6 w-6 text-slate-500 hover:text-white disabled:opacity-20"
                                    title="Subir Item"
                                  >
                                    <ArrowUp className="w-3 h-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleMoveItemOrder(item, 'down')}
                                    disabled={itemIdx === displayGrp.items.length - 1}
                                    className="h-6 w-6 text-slate-500 hover:text-white disabled:opacity-20"
                                    title="Descer Item"
                                  >
                                    <ArrowDown className="w-3 h-3" />
                                  </Button>

                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => openEditItemDialog(item)}
                                    className="h-6 w-6 text-slate-500 hover:text-blue-400"
                                    title="Editar Item"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDeleteItem(item.id)}
                                    className="h-6 w-6 text-slate-500 hover:text-red-400"
                                    title="Excluir Item"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}

                        {displayGrp.items.length === 0 && (
                          <div className="p-4 text-center text-xs text-slate-500">
                            Nenhum item vinculado a este grupo.{' '}
                            {canEdit && (
                              <button
                                onClick={() => openNewItemDialog(displayGrp.group?.id)}
                                className="text-blue-400 hover:underline inline ml-1"
                              >
                                Adicionar item agora.
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {templateItems.length === 0 && (
                    <div className="p-8 text-center text-xs text-slate-500 border border-slate-800 rounded-xl bg-slate-950/40">
                      Nenhum item cadastrado neste modelo. Clique em "Adicionar Item" ou "Novo
                      Grupo" para começar.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="h-full flex items-center justify-center p-12 bg-slate-900 border border-slate-800 rounded-2xl text-slate-500 text-xs">
              Selecione um modelo à esquerda para ver seus itens e grupos.
            </div>
          )}
        </div>
      </div>

      {/* Modal: Create / Full Edit Template */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-3xl bg-slate-900 border-slate-800 text-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white text-base">
              Configurar Modelo de Checklist
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Seletor de Empresa */}
            <CompanySelect
              value={selectedCompanyId}
              onChange={setSelectedCompanyId}
              required
              label="Empresa Proprietária do Modelo"
            />

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300">Título do Modelo *</Label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Ex: Checklist Pré-Operacional de Guindaste Telescópico"
                className="bg-slate-950 border-slate-800 text-white text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">Categoria *</Label>
                <Select value={editCategory} onValueChange={(val: any) => setEditCategory(val)}>
                  <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                    <SelectItem value="Guindaste">Guindaste</SelectItem>
                    <SelectItem value="Munck">Munck</SelectItem>
                    <SelectItem value="Acessórios e Materiais">Acessórios e Materiais</SelectItem>
                    <SelectItem value="Plano de Rigging">Plano de Rigging</SelectItem>
                    <SelectItem value="Segurança e Sinalização">Segurança e Sinalização</SelectItem>
                    <SelectItem value="Geral de Içamento">Geral de Içamento</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">Perfil Responsável *</Label>
                <Select value={editTargetRole} onValueChange={(val: any) => setEditTargetRole(val)}>
                  <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                    <SelectItem value="Todos">Todos os Perfis</SelectItem>
                    <SelectItem value="Operador">Operador</SelectItem>
                    <SelectItem value="Rigger">Rigger</SelectItem>
                    <SelectItem value="Sinaleiro">Sinaleiro</SelectItem>
                    <SelectItem value="Supervisor">Supervisor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300">Descrição / Instruções</Label>
              <Textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                rows={2}
                className="bg-slate-950 border-slate-800 text-white text-xs"
              />
            </div>

            {/* Grupos de Itens Builder */}
            <div className="space-y-3 pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Folder className="w-3.5 h-3.5" /> Grupos de Itens ({editGroups.length})
                </Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={addGroupInModal}
                  className="border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800 text-xs h-7"
                >
                  <FolderPlus className="w-3.5 h-3.5 mr-1" /> Adicionar Grupo
                </Button>
              </div>

              <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                {editGroups.map((grp, gIdx) => (
                  <div
                    key={grp.id || gIdx}
                    className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 flex-1">
                      <span className="text-xs font-semibold text-blue-400 font-mono shrink-0">
                        {gIdx + 1}.
                      </span>
                      <Input
                        placeholder="Nome do grupo (ex: Cabos de Aço, Inspeção Visual)..."
                        value={grp.name || ''}
                        onChange={(e) => {
                          const updated = [...editGroups]
                          updated[gIdx].name = e.target.value
                          setEditGroups(updated)
                        }}
                        className="bg-slate-900 border-slate-800 text-white text-xs h-7"
                      />
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => moveGroupOrderInModal(gIdx, 'up')}
                        disabled={gIdx === 0}
                        className="h-7 w-7 text-slate-500 hover:text-white disabled:opacity-20"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => moveGroupOrderInModal(gIdx, 'down')}
                        disabled={gIdx === editGroups.length - 1}
                        className="h-7 w-7 text-slate-500 hover:text-white disabled:opacity-20"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeGroupInModal(gIdx)}
                        className="h-7 w-7 text-slate-500 hover:text-red-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}

                {editGroups.length === 0 && (
                  <div className="text-center p-3 text-[11px] text-slate-500 bg-slate-950/60 rounded-lg border border-dashed border-slate-800">
                    Nenhum grupo criado. Os itens ficarão agrupados sob a seção "Geral".
                  </div>
                )}
              </div>
            </div>

            {/* Template Items builder */}
            <div className="space-y-3 pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" /> Itens de Verificação ({editItems.length})
                </Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={addItemInModal}
                  className="border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800 text-xs h-7"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar Item
                </Button>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {editItems.map((item, idx) => {
                  // Determine item sequence label in edit modal based on group
                  let itemNumberLabel = `${idx + 1}.`
                  if (item.group) {
                    const groupIdx = editGroups.findIndex((g) => g.id === item.group)
                    if (groupIdx !== -1) {
                      // Find index of this item among items of the same group
                      const sameGroupItems = editItems.filter((it) => it.group === item.group)
                      const itemIdxInGroup = sameGroupItems.findIndex(
                        (it) => it === item || (it.id && it.id === item.id),
                      )
                      const subIdx = itemIdxInGroup !== -1 ? itemIdxInGroup + 1 : idx + 1
                      itemNumberLabel = `${groupIdx + 1}.${subIdx}`
                    } else {
                      // Group not found in editGroups, treat as Geral
                      const unassigned = editItems.filter(
                        (it) => !it.group || !editGroups.some((g) => g.id === it.group),
                      )
                      const unassignedIdx = unassigned.findIndex(
                        (it) => it === item || (it.id && it.id === item.id),
                      )
                      itemNumberLabel = `${unassignedIdx !== -1 ? unassignedIdx + 1 : idx + 1}.`
                    }
                  } else {
                    const unassigned = editItems.filter(
                      (it) => !it.group || !editGroups.some((g) => g.id === it.group),
                    )
                    const unassignedIdx = unassigned.findIndex(
                      (it) => it === item || (it.id && it.id === item.id),
                    )
                    itemNumberLabel = `${unassignedIdx !== -1 ? unassignedIdx + 1 : idx + 1}.`
                  }

                  return (
                    <div
                      key={item.id || idx}
                      className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                          <span className="text-xs font-semibold text-blue-400 font-mono shrink-0 min-w-[28px]">
                            {itemNumberLabel}
                          </span>
                          {/* Group Selection for this item */}
                          <Select
                            value={item.group || 'none'}
                            onValueChange={(val) => {
                              const updated = [...editItems]
                              updated[idx].group = val === 'none' ? undefined : val
                              const foundG = editGroups.find((g) => g.id === val)
                              if (foundG) {
                                updated[idx].section = foundG.name
                              } else {
                                updated[idx].section = 'Geral'
                              }
                              setEditItems(updated)
                            }}
                          >
                            <SelectTrigger className="h-7 text-xs bg-slate-900 border-slate-800 text-slate-300 w-48">
                              <SelectValue placeholder="Selecionar Grupo" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-slate-800 text-slate-200 text-xs">
                              <SelectItem value="none">Geral (Sem grupo)</SelectItem>
                              {editGroups.map((g, grpIdx) => (
                                <SelectItem key={g.id || grpIdx} value={g.id || ''}>
                                  {grpIdx + 1}. {g.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <Select
                            value={item.type || 'conforme_nao_conforme'}
                            onValueChange={(val: any) => {
                              const updated = [...editItems]
                              updated[idx].type = val
                              setEditItems(updated)
                            }}
                          >
                            <SelectTrigger className="h-7 text-xs bg-slate-900 border-slate-800 text-slate-300 w-36">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-slate-800 text-slate-200 text-xs">
                              <SelectItem value="conforme_nao_conforme">C / NC / NA</SelectItem>
                              <SelectItem value="sim_nao_na">Sim / Não / NA</SelectItem>
                              <SelectItem value="numero">Numérico</SelectItem>
                              <SelectItem value="foto_obrigatoria">Foto</SelectItem>
                              <SelectItem value="texto">Texto</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-1 text-[11px] text-red-400 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={item.is_critical || false}
                              onChange={(e) => {
                                const updated = [...editItems]
                                updated[idx].is_critical = e.target.checked
                                setEditItems(updated)
                              }}
                              className="rounded bg-slate-900 border-slate-800"
                            />
                            Crítico
                          </label>

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeItemInModal(idx)}
                            className="h-7 w-7 text-slate-500 hover:text-red-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>

                      <Input
                        placeholder="Item a ser verificado..."
                        value={item.title || ''}
                        onChange={(e) => {
                          const updated = [...editItems]
                          updated[idx].title = e.target.value
                          setEditItems(updated)
                        }}
                        className="bg-slate-900 border-slate-800 text-white text-xs h-8"
                      />
                    </div>
                  )
                })}
              </div>
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
              onClick={handleSaveTemplateModal}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
            >
              Salvar Modelo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Create/Edit Single Group on Details View */}
      <Dialog open={isGroupModalOpen} onOpenChange={setIsGroupModalOpen}>
        <DialogContent className="max-w-md bg-slate-900 border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-white text-base">
              {editingGroup ? 'Editar Grupo de Itens' : 'Novo Grupo de Itens'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300">Nome do Grupo *</Label>
              <Input
                value={groupNameInput}
                onChange={(e) => setGroupNameInput(e.target.value)}
                placeholder="Ex: Cabos de Aço, Acessórios de Içamento, Inspeção Visual"
                className="bg-slate-950 border-slate-800 text-white text-xs"
                autoFocus
              />
            </div>
            <p className="text-[11px] text-slate-400">
              O grupo organiza visualmente os itens do modelo em seções com cabeçalhos dedicados.
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsGroupModalOpen(false)}
              className="border-slate-800 bg-slate-950 text-slate-300 text-xs"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveGroupDialog}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
            >
              Salvar Grupo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Create/Edit Single Item on Details View */}
      <Dialog open={isItemModalOpen} onOpenChange={setIsItemModalOpen}>
        <DialogContent className="max-w-lg bg-slate-900 border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-white text-base">
              {editingItem ? 'Editar Item de Verificação' : 'Novo Item de Verificação'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300">Grupo de Itens</Label>
              <Select value={itemGroupInput} onValueChange={setItemGroupInput}>
                <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200 text-xs">
                  <SelectValue placeholder="Selecione o grupo" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-slate-200 text-xs">
                  <SelectItem value="none">Geral (Sem grupo específico)</SelectItem>
                  {templateGroups.map((grp, grpIdx) => (
                    <SelectItem key={grp.id} value={grp.id}>
                      {grpIdx + 1}. {grp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300">Título do Item *</Label>
              <Input
                value={itemTitleInput}
                onChange={(e) => setItemTitleInput(e.target.value)}
                placeholder="Ex: Inspeção visual de patolas e estabilização de solo"
                className="bg-slate-950 border-slate-800 text-white text-xs"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">Tipo de Resposta *</Label>
                <Select value={itemTypeInput} onValueChange={(val: any) => setItemTypeInput(val)}>
                  <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-200 text-xs">
                    <SelectItem value="conforme_nao_conforme">
                      Conforme / Não Conforme / NA
                    </SelectItem>
                    <SelectItem value="sim_nao_na">Sim / Não / NA</SelectItem>
                    <SelectItem value="numero">Valor Numérico (Medição)</SelectItem>
                    <SelectItem value="foto_obrigatoria">Foto de Evidência</SelectItem>
                    <SelectItem value="texto">Observação em Texto</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 pt-5">
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={itemMandatoryInput}
                    onChange={(e) => setItemMandatoryInput(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-800 text-blue-600"
                  />
                  Preenchimento Obrigatório
                </label>

                <label className="flex items-center gap-2 text-xs text-red-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={itemCriticalInput}
                    onChange={(e) => setItemCriticalInput(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-800 text-red-600"
                  />
                  Item Crítico (Reprova Operação)
                </label>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300">
                Descrição / Instrução Adicional (Opcional)
              </Label>
              <Textarea
                value={itemDescInput}
                onChange={(e) => setItemDescInput(e.target.value)}
                rows={2}
                placeholder="Ex: Verificar vazamento hidráulico nas mangueiras e cilindros..."
                className="bg-slate-950 border-slate-800 text-white text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsItemModalOpen(false)}
              className="border-slate-800 bg-slate-950 text-slate-300 text-xs"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveItemDialog}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
            >
              Salvar Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
