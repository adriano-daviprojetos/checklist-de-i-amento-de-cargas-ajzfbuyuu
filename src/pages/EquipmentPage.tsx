import React, { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { AppDataService } from '@/services/appDataService'
import { Equipment, EquipmentType, EquipmentStatus } from '@/types'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Truck,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Trash2,
  Edit2,
  ShieldCheck,
  Calendar,
} from 'lucide-react'
import { toast } from 'sonner'

export const EquipmentPage: React.FC = () => {
  const { company, companies, canManageAssets } = useAuth()
  const { isOnline } = useOnlineStatus()

  const [equipmentList, setEquipmentList] = useState<Equipment[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<string>('todos')

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(company?.id || '')
  const [type, setType] = useState<EquipmentType>('Guindaste')
  const [manufacturer, setManufacturer] = useState('')
  const [model, setModel] = useState('')
  const [capacity, setCapacity] = useState('')
  const [licensePlate, setLicensePlate] = useState('')
  const [serialNumber, setSerialNumber] = useState('')
  const [year, setYear] = useState<number>(2023)
  const [status, setStatus] = useState<EquipmentStatus>('Operacional')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    loadEquipment()
  }, [company?.id, isOnline])

  const loadEquipment = async () => {
    setLoading(true)
    try {
      const data = await AppDataService.getEquipment(company?.id, isOnline)
      setEquipmentList(data)
    } catch (err) {
      console.error('Error loading equipment:', err)
    } finally {
      setLoading(false)
    }
  }

  const openNewModal = () => {
    setEditingId(null)
    setSelectedCompanyId(company?.id || companies[0]?.id || '')
    setType('Guindaste')
    setManufacturer('')
    setModel('')
    setCapacity('70 Toneladas')
    setLicensePlate('')
    setSerialNumber('')
    setYear(2023)
    setStatus('Operacional')
    setNotes('')
    setIsModalOpen(true)
  }

  const openEditModal = (eq: Equipment) => {
    setEditingId(eq.id)
    setSelectedCompanyId(eq.company_id || company?.id || companies[0]?.id || '')
    setType(eq.type)
    setManufacturer(eq.manufacturer)
    setModel(eq.model)
    setCapacity(eq.capacity)
    setLicensePlate(eq.license_plate || '')
    setSerialNumber(eq.serial_number || '')
    setYear(eq.year || 2023)
    setStatus(eq.status || 'Operacional')
    setNotes(eq.notes || '')
    setIsModalOpen(true)
  }

  const handleSave = async () => {
    if (!selectedCompanyId) {
      toast.warning('A seleção da empresa é obrigatória.')
      return
    }

    if (!manufacturer.trim() || !model.trim() || !capacity.trim()) {
      toast.warning('Preencha fabricante, modelo e capacidade.')
      return
    }

    try {
      const item: Partial<Equipment> = {
        id: editingId || undefined,
        company_id: selectedCompanyId,
        type,
        manufacturer,
        model,
        capacity,
        license_plate: licensePlate,
        serial_number: serialNumber,
        year: Number(year) || undefined,
        status,
        notes,
      }

      await AppDataService.saveEquipment(item, isOnline)
      toast.success('Equipamento salvo com sucesso!')
      setIsModalOpen(false)
      await loadEquipment()
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + err.message)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente remover este equipamento?')) return
    try {
      await AppDataService.deleteEquipment(id, isOnline)
      setEquipmentList((prev) => prev.filter((e) => e.id !== id))
      toast.success('Equipamento removido com sucesso.')
    } catch (err: any) {
      toast.error('Erro ao remover: ' + err.message)
    }
  }

  const filtered = equipmentList
    .filter((eq) => (company?.id ? eq.company_id === company.id : true))
    .filter((eq) => {
      const matchesSearch =
        eq.model.toLowerCase().includes(search.toLowerCase()) ||
        eq.manufacturer.toLowerCase().includes(search.toLowerCase()) ||
        eq.license_plate?.toLowerCase().includes(search.toLowerCase())
      const matchesType = filterType === 'todos' || eq.type === filterType
      return matchesSearch && matchesType
    })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Truck className="w-6 h-6 text-blue-500" />
            Equipamentos de Içamento
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Cadastro de guindastes telescópicos, muncks (guindautos), empilhadeiras e caminhões.
          </p>
        </div>

        {canManageAssets && (
          <Button
            onClick={openNewModal}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-md shadow-blue-500/20 text-xs"
          >
            <Plus className="w-4 h-4 mr-1.5" /> Novo Equipamento
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 bg-slate-900 p-4 rounded-xl border border-slate-800">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            placeholder="Buscar por modelo, fabricante ou placa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-slate-950 border-slate-800 text-white text-xs"
          />
        </div>

        <div className="w-full sm:w-52">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200 text-xs">
              <SelectValue placeholder="Tipo de Equipamento" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
              <SelectItem value="todos">Todos os Tipos</SelectItem>
              <SelectItem value="Guindaste">Guindaste</SelectItem>
              <SelectItem value="Munck">Munck</SelectItem>
              <SelectItem value="Caminhão">Caminhão</SelectItem>
              <SelectItem value="Empilhadeira">Empilhadeira</SelectItem>
              <SelectItem value="Plataforma Elevatória">Plataforma Elevatória</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Equipment Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((eq) => (
          <Card
            key={eq.id}
            className="bg-slate-900 border-slate-800 hover:border-slate-700 transition"
          >
            <CardContent className="p-5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <Badge className="bg-blue-950 text-blue-400 border border-blue-800 text-[10px]">
                    {eq.type}
                  </Badge>
                  <h3 className="font-bold text-white text-base leading-tight">
                    {eq.manufacturer} {eq.model}
                  </h3>
                </div>
                <Badge
                  variant="outline"
                  className={`text-xs ${
                    eq.status === 'Operacional'
                      ? 'border-emerald-500/50 text-emerald-400 bg-emerald-950/30'
                      : 'border-amber-500/50 text-amber-400 bg-amber-950/30'
                  }`}
                >
                  {eq.status || 'Operacional'}
                </Badge>
              </div>

              <div className="space-y-1.5 text-xs text-slate-300 pt-1">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Empresa:</span>
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-slate-950 border-slate-800 text-slate-300 font-normal"
                  >
                    {companies.find((c) => c.id === eq.company_id)?.trade_name ||
                      companies.find((c) => c.id === eq.company_id)?.name ||
                      company?.name ||
                      'Empresa Padrão'}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Capacidade Máxima:</span>
                  <span className="font-semibold text-blue-400">{eq.capacity}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Placa / Prefixo:</span>
                  <span className="font-mono text-slate-200">{eq.license_plate || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Ano de Fabricação:</span>
                  <span>{eq.year || 'N/A'}</span>
                </div>
                {eq.serial_number && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Nº de Série:</span>
                    <span className="font-mono text-slate-400">{eq.serial_number}</span>
                  </div>
                )}
              </div>

              {eq.notes && (
                <p className="text-[11px] text-slate-400 bg-slate-950 p-2 rounded border border-slate-800 line-clamp-2">
                  {eq.notes}
                </p>
              )}

              {canManageAssets && (
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openEditModal(eq)}
                    className="h-7 text-xs text-slate-300 hover:text-white"
                  >
                    <Edit2 className="w-3.5 h-3.5 mr-1" /> Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(eq.id)}
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
            Nenhum equipamento cadastrado.
          </div>
        )}
      </div>

      {/* Modal: Add / Edit Equipment */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white text-base">
              {editingId ? 'Editar Equipamento' : 'Cadastrar Equipamento de Içamento'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Empresa Selector */}
            <CompanySelect
              value={selectedCompanyId}
              onChange={setSelectedCompanyId}
              required
              label="Empresa Proprietária / Operadora"
            />

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">Tipo de Equipamento *</Label>
                <Select value={type} onValueChange={(val: any) => setType(val)}>
                  <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                    <SelectItem value="Guindaste">Guindaste</SelectItem>
                    <SelectItem value="Munck">Munck</SelectItem>
                    <SelectItem value="Caminhão">Caminhão</SelectItem>
                    <SelectItem value="Empilhadeira">Empilhadeira</SelectItem>
                    <SelectItem value="Plataforma Elevatória">Plataforma Elevatória</SelectItem>
                    <SelectItem value="Outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">Status Operacional *</Label>
                <Select value={status} onValueChange={(val: any) => setStatus(val)}>
                  <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                    <SelectItem value="Operacional">Operacional</SelectItem>
                    <SelectItem value="Em Manutenção">Em Manutenção</SelectItem>
                    <SelectItem value="Inativo">Inativo</SelectItem>
                    <SelectItem value="Aguardando Inspeção">Aguardando Inspeção</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">Fabricante *</Label>
                <Input
                  value={manufacturer}
                  onChange={(e) => setManufacturer(e.target.value)}
                  placeholder="Ex: Liebherr, Palfinger, Madal"
                  className="bg-slate-950 border-slate-800 text-white text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">Modelo *</Label>
                <Input
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="Ex: LTM 1100-5.2"
                  className="bg-slate-950 border-slate-800 text-white text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">Capacidade *</Label>
                <Input
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  placeholder="Ex: 70 Toneladas"
                  className="bg-slate-950 border-slate-800 text-white text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">Placa / ID</Label>
                <Input
                  value={licensePlate}
                  onChange={(e) => setLicensePlate(e.target.value)}
                  placeholder="Ex: GEB-1001"
                  className="bg-slate-950 border-slate-800 text-white text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">Ano</Label>
                <Input
                  type="number"
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className="bg-slate-950 border-slate-800 text-white text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300">Número de Série / Chassi</Label>
              <Input
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                placeholder="Ex: LBH-998821"
                className="bg-slate-950 border-slate-800 text-white text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300">
                Observações / Especificações da Lança
              </Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Lança de 52m, Jib de 19m, tabela de carga calibrada."
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
              Salvar Equipamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
