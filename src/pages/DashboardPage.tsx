import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { AppDataService } from '@/services/appDataService'
import { syncService } from '@/lib/offline/sync-service'
import { Checklist, Equipment, Material, ChecklistTemplate } from '@/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ClipboardCheck,
  Plus,
  Truck,
  Anchor,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  TrendingUp,
  FileSpreadsheet,
  ArrowRight,
  ShieldAlert,
  Calendar,
} from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

export const DashboardPage: React.FC = () => {
  const { company, user } = useAuth()
  const { isOnline } = useOnlineStatus()
  const navigate = useNavigate()

  const [checklists, setChecklists] = useState<Checklist[]>([])
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboardData()
    const unsubscribe = syncService.subscribe(() => {
      loadDashboardData()
    })
    return () => {
      unsubscribe()
    }
  }, [company?.id, isOnline])

  const loadDashboardData = async () => {
    setLoading(true)
    try {
      const [chkList, eqList, matList, tplList] = await Promise.all([
        AppDataService.getChecklists(company?.id, isOnline),
        AppDataService.getEquipment(company?.id, isOnline),
        AppDataService.getMaterials(company?.id, isOnline),
        AppDataService.getTemplates(company?.id, isOnline),
      ])
      setChecklists(chkList)
      setEquipment(eqList)
      setMaterials(matList)
      setTemplates(tplList)
    } catch (err) {
      console.error('Error loading dashboard:', err)
    } finally {
      setLoading(false)
    }
  }

  const scopedChecklists = company?.id
    ? checklists.filter((c) => c.company_id === company.id)
    : checklists
  const scopedEquipment = company?.id
    ? equipment.filter((e) => e.company_id === company.id)
    : equipment
  const scopedMaterials = company?.id
    ? materials.filter((m) => m.company_id === company.id)
    : materials
  const scopedTemplates = company?.id
    ? templates.filter((t) => t.company_id === company.id)
    : templates

  const completedCount = scopedChecklists.filter((c) => c.status === 'Concluído').length
  const inProgressCount = scopedChecklists.filter((c) => c.status === 'Em Andamento').length
  const pendingCount = scopedChecklists.filter((c) => c.status === 'Pendente').length
  const rejectedCount = scopedChecklists.filter((c) => c.status === 'Reprovado').length

  const pieData = [
    { name: 'Concluído', value: completedCount, color: '#10b981' },
    { name: 'Em Andamento', value: inProgressCount, color: '#3b82f6' },
    { name: 'Pendente', value: pendingCount, color: '#f59e0b' },
    { name: 'Reprovado', value: rejectedCount, color: '#ef4444' },
  ].filter((item) => item.value > 0)

  const categoryBarData = [
    { name: 'Guindastes', total: scopedEquipment.filter((e) => e.type === 'Guindaste').length },
    { name: 'Muncks', total: scopedEquipment.filter((e) => e.type === 'Munck').length },
    {
      name: 'Cintas/Cabos',
      total: scopedMaterials.filter((m) => m.type === 'Cinta' || m.type === 'Cabos de Aço').length,
    },
    { name: 'Manilhas', total: scopedMaterials.filter((m) => m.type === 'Manilhas').length },
    { name: 'Ganchos', total: scopedMaterials.filter((m) => m.type === 'Ganchos').length },
  ]

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-blue-950/40 via-slate-900 to-slate-900 p-6 rounded-2xl border border-blue-900/30">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-400">
              Operações de Rigging & Içamento
            </span>
            {!isOnline && (
              <Badge variant="outline" className="text-amber-400 border-amber-500/40 text-[10px]">
                Offline Ativo
              </Badge>
            )}
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Painel de Controle e Inspeção
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Gestão de conformidade NR-11/NR-12, patolamento, cabos, lingadas e liberação de carga.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={() => navigate('/checklists/novo')}
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20"
          >
            <Plus className="w-4 h-4 mr-2" />
            Iniciar Novo Checklist
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate('/checklists')}
            className="border-slate-800 bg-slate-900 text-slate-200 hover:bg-slate-800"
          >
            Ver Histórico
          </Button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-medium text-slate-400">Total de Inspeções</span>
              <div className="text-2xl font-bold text-white">{scopedChecklists.length}</div>
              <span className="text-[11px] text-slate-500">Içamentos registrados</span>
            </div>
            <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400 border border-blue-500/20">
              <ClipboardCheck className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-medium text-emerald-400">Aprovados / Concluídos</span>
              <div className="text-2xl font-bold text-white">{completedCount}</div>
              <span className="text-[11px] text-emerald-500/80">Liberados para içamento</span>
            </div>
            <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-medium text-amber-400">Em Andamento / Campo</span>
              <div className="text-2xl font-bold text-white">{inProgressCount + pendingCount}</div>
              <span className="text-[11px] text-amber-500/80">Inspeções ativas</span>
            </div>
            <div className="p-3 bg-amber-500/10 rounded-xl text-amber-400 border border-amber-500/20">
              <Clock className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-medium text-red-400">Reprovados / Críticos</span>
              <div className="text-2xl font-bold text-white">{rejectedCount}</div>
              <span className="text-[11px] text-red-500/80">Não conformidades críticas</span>
            </div>
            <div className="p-3 bg-red-500/10 rounded-xl text-red-400 border border-red-500/20">
              <XCircle className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts & Quick Asset Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status Distribution */}
        <Card className="bg-slate-900 border-slate-800 lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-white font-semibold">
              Status das Operações
            </CardTitle>
            <CardDescription className="text-slate-400 text-xs">
              Distribuição percentual das verificações
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <div className="h-56 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: 8,
                      }}
                      itemStyle={{ color: '#f8fafc' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-56 flex items-center justify-center text-xs text-slate-500">
                Nenhum checklist registrado ainda.
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-800 text-xs">
              <div className="flex items-center gap-1.5 text-slate-300">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>Concluídos ({completedCount})</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-300">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <span>Em Andamento ({inProgressCount})</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-300">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span>Pendentes ({pendingCount})</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-300">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <span>Reprovados ({rejectedCount})</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Fleet & Rigging Inventory */}
        <Card className="bg-slate-900 border-slate-800 lg:col-span-2">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base text-white font-semibold">
                Frota e Acessórios Cadastrados
              </CardTitle>
              <CardDescription className="text-slate-400 text-xs">
                Guindastes, Muncks, Cintas de amarração e Manilhas ativas
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/equipamentos')}
              className="text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-950/30"
            >
              Ver Equipamentos <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={categoryBarData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} allowDecimals={false} />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: 8,
                    }}
                    itemStyle={{ color: '#f8fafc' }}
                  />
                  <Bar dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-400 mt-2 pt-2 border-t border-slate-800">
              <span>
                Total de Equipamentos:{' '}
                <strong className="text-white">{scopedEquipment.length}</strong>
              </span>
              <span>
                Total de Materiais/TAGs:{' '}
                <strong className="text-white">{scopedMaterials.length}</strong>
              </span>
              <span>
                Modelos de Inspeção:{' '}
                <strong className="text-white">{scopedTemplates.length}</strong>
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Checklists Table */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base text-white font-semibold">
              Últimas Operações de Içamento Inspecionadas
            </CardTitle>
            <CardDescription className="text-slate-400 text-xs">
              Status em tempo real das inspeções pré e pós-operacionais
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/checklists')}
            className="text-xs border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800"
          >
            Ver Todos
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-y border-slate-800">
                <tr>
                  <th className="px-4 py-3">Código / Título</th>
                  <th className="px-4 py-3">Local / Obra</th>
                  <th className="px-4 py-3">Equipamento / TAG</th>
                  <th className="px-4 py-3">Inspetor</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {scopedChecklists.slice(0, 5).map((chk) => {
                  const getStatusBadge = (s: string) => {
                    switch (s) {
                      case 'Concluído':
                        return (
                          <Badge className="bg-emerald-950/80 text-emerald-400 border border-emerald-800/80">
                            Concluído
                          </Badge>
                        )
                      case 'Em Andamento':
                        return (
                          <Badge className="bg-blue-950/80 text-blue-400 border border-blue-800/80">
                            Em Andamento
                          </Badge>
                        )
                      case 'Reprovado':
                        return (
                          <Badge className="bg-red-950/80 text-red-400 border border-red-800/80">
                            Reprovado
                          </Badge>
                        )
                      default:
                        return (
                          <Badge className="bg-amber-950/80 text-amber-400 border border-amber-800/80">
                            Pendente
                          </Badge>
                        )
                    }
                  }

                  return (
                    <tr key={chk.id} className="hover:bg-slate-850 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-white">{chk.code || 'CHK-NOVO'}</div>
                        <div className="text-slate-400 truncate max-w-xs">{chk.title}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-slate-300">{chk.location || 'Não especificado'}</div>
                        <div className="text-[11px] text-slate-500">
                          {chk.operation_type || 'Içamento'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-slate-300">
                          {chk.expand?.equipment_id
                            ? `${chk.expand.equipment_id.type} ${chk.expand.equipment_id.model}`
                            : chk.expand?.material_id
                              ? `TAG: ${chk.expand.material_id.tag}`
                              : 'Geral'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-slate-300">{chk.inspector_name || 'Inspetor'}</div>
                      </td>
                      <td className="px-4 py-3">{getStatusBadge(chk.status)}</td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => navigate(`/checklists/${chk.id}`)}
                          className="text-blue-400 hover:text-white hover:bg-blue-600/20 text-xs h-7 px-2"
                        >
                          Abrir
                        </Button>
                      </td>
                    </tr>
                  )
                })}
                {scopedChecklists.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-500">
                      Nenhum checklist registrado nesta empresa. Clique em &quot;Iniciar Novo
                      Checklist&quot;.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
