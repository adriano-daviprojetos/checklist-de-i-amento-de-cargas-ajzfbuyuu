import React, { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { AppDataService } from '@/services/appDataService'
import {
  ChecklistTemplate,
  ChecklistTemplateItem,
  TemplateCategory,
  TargetRole,
  ItemType,
} from '@/types'
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
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ShieldCheck,
  Search,
} from 'lucide-react'
import { toast } from 'sonner'

export const TemplatesPage: React.FC = () => {
  const { company, canManageTemplates } = useAuth()
  const { isOnline } = useOnlineStatus()

  const [templates, setTemplates] = useState<ChecklistTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<ChecklistTemplate | null>(null)
  const [templateItems, setTemplateItems] = useState<ChecklistTemplateItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Modal create/edit
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editCategory, setEditCategory] = useState<TemplateCategory>('Guindaste')
  const [editTargetRole, setEditTargetRole] = useState<TargetRole>('Todos')
  const [editItems, setEditItems] = useState<Partial<ChecklistTemplateItem>[]>([])

  useEffect(() => {
    loadTemplates()
  }, [company?.id, isOnline])

  const loadTemplates = async () => {
    setLoading(true)
    try {
      const data = await AppDataService.getTemplates(company?.id, isOnline)
      setTemplates(data)
      if (data.length > 0 && !selectedTemplate) {
        handleSelectTemplate(data[0])
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
      const items = await AppDataService.getTemplateItems(tpl.id, isOnline)
      setTemplateItems(items)
    } catch (err) {
      console.error('Error loading template items:', err)
    }
  }

  const openNewTemplateModal = () => {
    setEditTitle('')
    setEditDesc('')
    setEditCategory('Guindaste')
    setEditTargetRole('Operador')
    setEditItems([
      {
        section: '1. Condições Operacionais e Estrutura',
        title: 'Verificação visual de patolas e estabilização de solo',
        type: 'conforme_nao_conforme',
        is_mandatory: true,
        is_critical: true,
      },
      {
        section: '2. Cabos e Ganchos',
        title: 'Inspeção do cabo de aço principal e trava de segurança do gancho',
        type: 'conforme_nao_conforme',
        is_mandatory: true,
        is_critical: true,
      },
    ])
    setIsModalOpen(true)
  }

  const openEditModal = async (tpl: ChecklistTemplate) => {
    setEditTitle(tpl.title)
    setEditDesc(tpl.description || '')
    setEditCategory(tpl.category)
    setEditTargetRole(tpl.target_role || 'Todos')
    const items = await AppDataService.getTemplateItems(tpl.id, isOnline)
    setEditItems(items)
    setIsModalOpen(true)
  }

  const addItemToEditList = () => {
    setEditItems([
      ...editItems,
      {
        section: 'Geral',
        title: 'Novo item de verificação',
        type: 'conforme_nao_conforme',
        is_mandatory: true,
        is_critical: false,
      },
    ])
  }

  const removeItemFromEditList = (index: number) => {
    setEditItems(editItems.filter((_, i) => i !== index))
  }

  const handleSaveTemplate = async () => {
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
        company_id: company?.id || '',
        title: editTitle,
        description: editDesc,
        category: editCategory,
        target_role: editTargetRole,
        active: true,
        version: 1,
      }

      const saved = await AppDataService.saveTemplate(payload, editItems, isOnline)
      toast.success('Modelo de checklist salvo com sucesso!')
      setIsModalOpen(false)
      await loadTemplates()
    } catch (err: any) {
      toast.error('Erro ao salvar modelo: ' + err.message)
    }
  }

  const filtered = templates
    .filter((t) => (company?.id ? t.company_id === company.id : true))
    .filter(
      (t) =>
        t.title.toLowerCase().includes(search.toLowerCase()) ||
        t.category.toLowerCase().includes(search.toLowerCase()),
    )

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
            Padronize os itens e seções de verificação para guindastes, muncks, lingadas e rigging.
          </p>
        </div>

        {canManageTemplates && (
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

          <div className="space-y-2 max-h-[70vh] overflow-y-auto">
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
                  <span className="text-[10px] text-slate-500">
                    Perfil: {tpl.target_role || 'Todos'}
                  </span>
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

                {canManageTemplates && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEditModal(selectedTemplate)}
                    className="border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800 text-xs"
                  >
                    <Edit2 className="w-3.5 h-3.5 mr-1" /> Editar
                  </Button>
                )}
              </CardHeader>

              <CardContent className="p-4 space-y-4">
                <div className="font-semibold text-xs text-slate-300 uppercase tracking-wider">
                  Itens e Critérios de Aceite ({templateItems.length} itens)
                </div>

                <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden bg-slate-950/60">
                  {templateItems.map((item, idx) => (
                    <div key={item.id} className="p-3.5 space-y-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-0.5">
                          <div className="text-[10px] font-mono text-blue-400 uppercase">
                            {item.section || 'Seção Geral'}
                          </div>
                          <div className="font-medium text-white text-xs flex items-center gap-2">
                            <span>
                              {idx + 1}. {item.title}
                            </span>
                            {item.is_critical && (
                              <Badge className="bg-red-950 text-red-400 border border-red-800 text-[10px] px-1.5 py-0">
                                Crítico (Bloqueante)
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Badge
                            variant="outline"
                            className="text-[10px] text-slate-400 border-slate-800"
                          >
                            Tipo: {item.type}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}

                  {templateItems.length === 0 && (
                    <div className="p-6 text-center text-xs text-slate-500">
                      Nenhum item cadastrado neste modelo.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="h-full flex items-center justify-center p-12 bg-slate-900 border border-slate-800 rounded-2xl text-slate-500 text-xs">
              Selecione um modelo à esquerda para ver suas perguntas e regras.
            </div>
          )}
        </div>
      </div>

      {/* Modal: Create / Edit Template */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl bg-slate-900 border-slate-800 text-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white text-base">
              Configurar Modelo de Checklist
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
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

            {/* Template Items builder */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
                  Itens de Verificação ({editItems.length})
                </Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={addItemToEditList}
                  className="border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800 text-xs h-7"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar Pergunta
                </Button>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {editItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Input
                        placeholder="Seção (ex: 1. Cabos e Moitão)"
                        value={item.section || ''}
                        onChange={(e) => {
                          const updated = [...editItems]
                          updated[idx].section = e.target.value
                          setEditItems(updated)
                        }}
                        className="w-1/2 bg-slate-900 border-slate-800 text-white text-xs h-7"
                      />

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
                          onClick={() => removeItemFromEditList(idx)}
                          className="h-7 w-7 text-slate-500 hover:text-red-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>

                    <Input
                      placeholder="Pergunta / Item a ser verificado..."
                      value={item.title || ''}
                      onChange={(e) => {
                        const updated = [...editItems]
                        updated[idx].title = e.target.value
                        setEditItems(updated)
                      }}
                      className="bg-slate-900 border-slate-800 text-white text-xs"
                    />
                  </div>
                ))}
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
              onClick={handleSaveTemplate}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
            >
              Salvar Modelo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
