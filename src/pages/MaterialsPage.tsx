import React, { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { AppDataService } from '@/services/appDataService'
import { Material, MaterialType, MaterialStatus } from '@/types'
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
  Anchor,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Edit2,
  Calendar,
  ShieldCheck,
} from 'lucide-react'
import { toast } from 'sonner'

export const MaterialsPage: React.FC = () => {
  const { company, canManageAssets } = useAuth()
  const { isOnline } = useOnlineStatus()

  const [materials, setMaterials] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<string>('todos')

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [type, setType] = useState<MaterialType>('Cinta')
  const [tag, setTag] = useState('')
  const [manufacturer, setManufacturer] = useState('')
  const [model, setModel] = useState('')
  const [capacity, setCapacity] = useState('')
  const [diameterOrLength, setDiameterOrLength] = useState('')
  const [status, setStatus] = useState<MaterialStatus>('Disponível')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    loadMaterials()
  }, [company?.id, isOnline])

  const loadMaterials = async () => {
    setLoading(true)
    try {
      const data = await AppDataService.getMaterials(company?.id, isOnline)
      setMaterials(data)
    } catch (err) {
      console.error('Error loading materials:', err)
    } finally {
      setLoading(false)
    }
  }

  const openNewModal = () => {
    setEditingId(null)
    setType('Cinta')
    setTag(`CIN-${Math.floor(100 + Math.random() * 900)}-10T`)
    setManufacturer('')
    setModel('')
    setCapacity('10 Toneladas (WLL)')
    setDiameterOrLength('6.0 metros')
    setStatus('Disponível')
    setNotes('')
    setIsModalOpen(true)
  }

  const openEditModal = (mat: Material) => {
    setEditingId(mat.id)
    setType(mat.type)
    setTag(mat.tag)
    setManufacturer(mat.manufacturer || '')
    setModel(mat.model || '')
    setCapacity(mat.capacity)
    setDiameterOrLength(mat.diameter_or_length || '')
    setStatus(mat.status || 'Disponível')
    setNotes(mat.notes || '')
    setIsModalOpen(true)
  }

  const handleSave = async () => {
    if (!tag.trim() || !capacity.trim()) {
      toast.warning('Preencha a TAG e a Capacidade (WLL).')
      return
    }

    try {
      const item: Partial<Material> = {
        id: editingId || undefined,
        company_id: company?.id || '',
        type,
        tag,
        manufacturer,
        model,
        capacity,
        diameter_or_length: diameterOrLength,
        status,
        notes,
      }

      await AppDataService.saveMaterial(item, isOnline)
      toast.success('Material de içamento salvo com sucesso!')
      setIsModalOpen(false)
      await loadMaterials()
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + err.message)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir este acessório de amarração?')) return
    try {
      await AppDataService.deleteMaterial(id, isOnline)
      setMaterials((prev) => prev.filter((m) => m.id !== id))
      toast.success('Material removido.')
    } catch (err: any) {
      toast.error('Erro ao remover: ' + err.message)
    }
  }

  const filtered = materials.filter((mat) => {
    const matchesSearch =
      mat.tag.toLowerCase().includes(search.toLowerCase()) ||
      mat.type.toLowerCase().includes(search.toLowerCase()) ||
      mat.manufacturer?.toLowerCase().includes(search.toLowerCase()) ||
      mat.model?.toLowerCase().includes(search.toLowerCase())
    const matchesType = filterType === 'todos' || mat.type === filterType
    return matchesSearch && matchesType
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Anchor className="w-6 h-6 text-blue-500" />
            Materiais & Acessórios de Rigging
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Controle de TAGs de cintas sintéticas, cabos de aço, manilhas, estropos, balancins e
            olhais.
          </p>
        </div>

        {canManageAssets && (
          <Button
            onClick={openNewModal}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-md shadow-blue-500/20 text-xs"
          >
            <Plus className="w-4 h-4 mr-1.5" /> Nova TAG de Rigging
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 bg-slate-900 p-4 rounded-xl border border-slate-800">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            placeholder="Buscar por TAG, tipo ou fabricante..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-slate-950 border-slate-800 text-white text-xs"
          />
        </div>

        <div className="w-full sm:w-56">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200 text-xs">
              <SelectValue placeholder="Tipo de Material" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
              <SelectItem value="todos">Todos os Tipos</SelectItem>
              <SelectItem value="Cinta">Cinta Tubular / Plana</SelectItem>
              <SelectItem value="Cabos de Aço">Cabos de Aço / Lingadas</SelectItem>
              <SelectItem value="Manilhas">Manilhas</SelectItem>
              <SelectItem value="Ganchos">Ganchos</SelectItem>
              <SelectItem value="Olhais">Olhais de Suspensão</SelectItem>
              <SelectItem value="Moitões">Moitões</SelectItem>
              <SelectItem value="Estropos">Estropos</SelectItem>
              <SelectItem value="Balancim">Balancim de Carga</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((mat) => (
          <Card
            key={mat.id}
            className="bg-slate-900 border-slate-800 hover:border-slate-700 transition"
          >
            <CardContent className="p-5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="font-mono text-xs font-bold text-blue-400 px-2 py-0.5 rounded bg-blue-950/60 border border-blue-900/40 inline-block">
                    TAG: {mat.tag}
                  </div>
                  <h3 className="font-bold text-white text-base leading-tight mt-1">
                    {mat.type} {mat.manufacturer ? `- ${mat.manufacturer}` : ''}
                  </h3>
                </div>
                <Badge
                  variant="outline"
                  className={`text-xs ${
                    mat.status === 'Disponível'
                      ? 'border-emerald-500/50 text-emerald-400 bg-emerald-950/30'
                      : 'border-amber-500/50 text-amber-400 bg-amber-950/30'
                  }`}
                >
                  {mat.status || 'Disponível'}
                </Badge>
              </div>

              <div className="space-y-1.5 text-xs text-slate-300 pt-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Capacidade (WLL):</span>
                  <span className="font-semibold text-emerald-400">{mat.capacity}</span>
                </div>
                {mat.diameter_or_length && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Dimensão / Comprimento:</span>
                    <span>{mat.diameter_or_length}</span>
                  </div>
                )}
                {mat.model && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Especificação:</span>
                    <span className="text-slate-300 truncate max-w-[150px]">{mat.model}</span>
                  </div>
                )}
              </div>

              {mat.notes && (
                <p className="text-[11px] text-slate-400 bg-slate-950 p-2 rounded border border-slate-800 line-clamp-2">
                  {mat.notes}
                </p>
              )}

              {canManageAssets && (
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openEditModal(mat)}
                    className="h-7 text-xs text-slate-300 hover:text-white"
                  >
                    <Edit2 className="w-3.5 h-3.5 mr-1" /> Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(mat.id)}
                    className="h-7 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/20"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {filtered.length === 0 && (
          <div className="col-span-full p-12 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-xl text-xs">
            Nenhum material de rigging cadastrado.
          </div>
        )}
      </div>

      {/* Modal: Add / Edit Material */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white text-base">
              {editingId ? 'Editar Material de Içamento' : 'Cadastrar Acessório / TAG de Rigging'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">Tipo de Acessório *</Label>
                <Select value={type} onValueChange={(val: any) => setType(val)}>
                  <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                    <SelectItem value="Cinta">Cinta</SelectItem>
                    <SelectItem value="Cabos de Aço">Cabos de Aço</SelectItem>
                    <SelectItem value="Manilhas">Manilhas</SelectItem>
                    <SelectItem value="Ganchos">Ganchos</SelectItem>
                    <SelectItem value="Olhais">Olhais</SelectItem>
                    <SelectItem value="Moitões">Moitões</SelectItem>
                    <SelectItem value="Estropos">Estropos</SelectItem>
                    <SelectItem value="Balancim">Balancim</SelectItem>
                    <SelectItem value="Outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">TAG / Identificador Físico *</Label>
                <Input
                  value={tag}
                  onChange={(e) => setTag(e.target.value)}
                  placeholder="Ex: CIN-014-10T"
                  className="bg-slate-950 border-slate-800 text-white text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">Capacidade Limite (WLL) *</Label>
                <Input
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  placeholder="Ex: 10 Toneladas (Fator 7:1)"
                  className="bg-slate-950 border-slate-800 text-white text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">Status *</Label>
                <Select value={status} onValueChange={(val: any) => setStatus(val)}>
                  <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                    <SelectItem value="Disponível">Disponível</SelectItem>
                    <SelectItem value="Em Uso">Em Uso</SelectItem>
                    <SelectItem value="Em Inspeção">Em Inspeção</SelectItem>
                    <SelectItem value="Danificado / Descarte">Danificado / Descarte</SelectItem>
                    <SelectItem value="Quarentena">Quarentena</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">Fabricante</Label>
                <Input
                  value={manufacturer}
                  onChange={(e) => setManufacturer(e.target.value)}
                  placeholder="Ex: Crosby, Gunnebo, Tecnotextil"
                  className="bg-slate-950 border-slate-800 text-white text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">Dimensão / Comprimento</Label>
                <Input
                  value={diameterOrLength}
                  onChange={(e) => setDiameterOrLength(e.target.value)}
                  placeholder="Ex: 6.0m ou 1.1/2 pol"
                  className="bg-slate-950 border-slate-800 text-white text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300">Modelo / Especificação Técnica</Label>
              <Input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="Ex: Manilha Curva com Porca e Cupilha G-2130"
                className="bg-slate-950 border-slate-800 text-white text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300">Observações / Certificado</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Certificado emitido em 02/2025."
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
              Salvar Acessório
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
