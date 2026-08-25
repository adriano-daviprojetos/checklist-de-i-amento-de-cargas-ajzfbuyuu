import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { auditLogService } from '@/services/auditLogService'
import { AuditLog, AuditAction } from '@/types'
import {
  ScrollText,
  Search,
  Filter,
  Calendar,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  KeyRound,
  Trash2,
  UserPlus,
  UserCheck,
  AlertTriangle,
  Info,
  Clock,
  User,
  Building,
  CheckCircle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export const AuditLogPage: React.FC = () => {
  const { company } = useAuth()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [page, setPage] = useState<number>(1)
  const [totalPages, setTotalPages] = useState<number>(1)
  const [totalItems, setTotalItems] = useState<number>(0)

  // Filters
  const [actionFilter, setActionFilter] = useState<string>('all')
  const [moduleFilter, setModuleFilter] = useState<string>('all')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState<string>('')

  // Detail Modal
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)

  const loadLogs = useCallback(
    async (currentPage = page) => {
      setLoading(true)
      try {
        const result = await auditLogService.fetchAuditLogs(
          company?.id,
          {
            action: actionFilter,
            module: moduleFilter,
            startDate: startDate || undefined,
            endDate: endDate || undefined,
          },
          currentPage,
          20,
        )

        setLogs(result.items)
        setTotalPages(result.totalPages)
        setTotalItems(result.totalItems)
        setPage(result.page)
      } catch (err) {
        console.error('Error fetching audit logs:', err)
      } finally {
        setLoading(false)
      }
    },
    [company?.id, actionFilter, moduleFilter, startDate, endDate, page],
  )

  useEffect(() => {
    loadLogs(1)
  }, [actionFilter, moduleFilter, startDate, endDate, company?.id])

  const handleRefresh = () => {
    loadLogs(page)
  }

  const handleClearFilters = () => {
    setActionFilter('all')
    setModuleFilter('all')
    setStartDate('')
    setEndDate('')
    setSearchTerm('')
  }

  // Filter in-memory for the optional search input across details/user_name
  const displayedLogs = logs.filter((log) => {
    if (!searchTerm.trim()) return true
    const term = searchTerm.toLowerCase()
    const matchUser = log.user_name?.toLowerCase().includes(term)
    const matchDetails = log.details?.toLowerCase().includes(term)
    const matchAction = log.action.toLowerCase().includes(term)
    const matchModule = log.module?.toLowerCase().includes(term)
    return matchUser || matchDetails || matchAction || matchModule
  })

  // Badge helpers
  const getActionBadge = (action: AuditAction) => {
    switch (action) {
      case 'access_denied':
        return (
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30 font-medium flex items-center gap-1">
            <ShieldAlert className="w-3 h-3" />
            Acesso Negado
          </Badge>
        )
      case 'permission_changed':
        return (
          <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 hover:bg-blue-500/30 font-medium flex items-center gap-1">
            <KeyRound className="w-3 h-3" />
            Permissão Alterada
          </Badge>
        )
      case 'user_created':
        return (
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30 font-medium flex items-center gap-1">
            <UserPlus className="w-3 h-3" />
            Usuário Criado
          </Badge>
        )
      case 'user_updated':
        return (
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30 font-medium flex items-center gap-1">
            <UserCheck className="w-3 h-3" />
            Usuário Atualizado
          </Badge>
        )
      case 'user_deleted':
      case 'company_deleted':
      case 'checklist_deleted':
      case 'equipment_deleted':
      case 'material_deleted':
      case 'client_deleted':
      case 'template_deleted':
        return (
          <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 hover:bg-orange-500/30 font-medium flex items-center gap-1">
            <Trash2 className="w-3 h-3" />
            {getActionLabel(action)}
          </Badge>
        )
      default:
        if (action.endsWith('_deleted')) {
          return (
            <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 hover:bg-orange-500/30 font-medium flex items-center gap-1">
              <Trash2 className="w-3 h-3" />
              Exclusão
            </Badge>
          )
        }
        return (
          <Badge className="bg-slate-700/50 text-slate-300 border-slate-600 font-medium">
            {action}
          </Badge>
        )
    }
  }

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'access_denied':
        return 'Acesso Negado'
      case 'permission_changed':
        return 'Permissão Alterada'
      case 'user_deleted':
        return 'Usuário Excluído'
      case 'company_deleted':
        return 'Empresa Excluída'
      case 'checklist_deleted':
        return 'Checklist Excluído'
      case 'equipment_deleted':
        return 'Equipamento Excluído'
      case 'material_deleted':
        return 'Material Excluído'
      case 'client_deleted':
        return 'Cliente Excluído'
      case 'template_deleted':
        return 'Modelo Excluído'
      case 'user_created':
        return 'Usuário Criado'
      case 'user_updated':
        return 'Usuário Atualizado'
      default:
        return action
    }
  }

  const getModuleLabel = (moduleName?: string) => {
    if (!moduleName) return 'Geral'
    switch (moduleName) {
      case 'checklists':
        return 'Checklists'
      case 'templates':
        return 'Modelos'
      case 'equipment':
        return 'Equipamentos'
      case 'materials':
        return 'Materiais'
      case 'clients':
        return 'Clientes'
      case 'users':
        return 'Usuários'
      case 'companies':
      case 'company':
        return 'Empresa'
      case 'audit':
        return 'Auditoria'
      case 'access':
        return 'Acesso / Rotas'
      default:
        return moduleName
    }
  }

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr)
      return format(date, "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })
    } catch {
      return dateStr
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <ScrollText className="w-6 h-6 text-blue-500" />
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">
              Log de Auditoria e Segurança
            </h1>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Rastreamento de acessos negados, modificações de permissão e exclusões de recursos.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
            className="border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white text-xs h-9"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin text-blue-400' : ''}`}
            />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Filters Card */}
      <Card className="bg-slate-900 border-slate-800 text-slate-100 shadow-sm">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-200">
            <Filter className="w-4 h-4 text-blue-400" />
            Filtros de Busca
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {/* Quick search */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-400">Buscar por termo</label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
                <Input
                  placeholder="Usuário, detalhes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 bg-slate-950 border-slate-800 text-xs h-8 text-slate-200 placeholder:text-slate-600"
                />
              </div>
            </div>

            {/* Action Type */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-400">Tipo de Ação</label>
              <Select value={actionFilter} onValueChange={(val) => setActionFilter(val)}>
                <SelectTrigger className="bg-slate-950 border-slate-800 text-xs h-8 text-slate-200">
                  <SelectValue placeholder="Todas as ações" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-slate-200 text-xs">
                  <SelectItem value="all">Todas as ações</SelectItem>
                  <SelectItem value="access_denied">Acesso Negado</SelectItem>
                  <SelectItem value="permission_changed">Permissão Alterada</SelectItem>
                  <SelectItem value="checklist_deleted">Checklist Excluído</SelectItem>
                  <SelectItem value="equipment_deleted">Equipamento Excluído</SelectItem>
                  <SelectItem value="material_deleted">Material Excluído</SelectItem>
                  <SelectItem value="client_deleted">Cliente Excluído</SelectItem>
                  <SelectItem value="template_deleted">Modelo Excluído</SelectItem>
                  <SelectItem value="user_deleted">Usuário Excluído</SelectItem>
                  <SelectItem value="company_deleted">Empresa Excluída</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Module Filter */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-400">Módulo</label>
              <Select value={moduleFilter} onValueChange={(val) => setModuleFilter(val)}>
                <SelectTrigger className="bg-slate-950 border-slate-800 text-xs h-8 text-slate-200">
                  <SelectValue placeholder="Todos os módulos" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-slate-200 text-xs">
                  <SelectItem value="all">Todos os módulos</SelectItem>
                  <SelectItem value="checklists">Checklists</SelectItem>
                  <SelectItem value="templates">Modelos de Inspeção</SelectItem>
                  <SelectItem value="equipment">Equipamentos</SelectItem>
                  <SelectItem value="materials">Materiais & Acessórios</SelectItem>
                  <SelectItem value="clients">Clientes & Obras</SelectItem>
                  <SelectItem value="users">Usuários & Perfis</SelectItem>
                  <SelectItem value="companies">Empresas</SelectItem>
                  <SelectItem value="audit">Auditoria</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date Range */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-400">Período (De - Até)</label>
              <div className="flex items-center gap-1.5">
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-[11px] h-8 text-slate-200 px-2"
                />
                <span className="text-slate-500 text-xs">-</span>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-[11px] h-8 text-slate-200 px-2"
                />
              </div>
            </div>
          </div>

          {(actionFilter !== 'all' ||
            moduleFilter !== 'all' ||
            startDate !== '' ||
            endDate !== '' ||
            searchTerm !== '') && (
            <div className="flex justify-end pt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="text-xs h-7 text-slate-400 hover:text-slate-200"
              >
                Limpar filtros
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Logs Table Card */}
      <Card className="bg-slate-900 border-slate-800 text-slate-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            Exibindo <span className="font-semibold text-slate-200">{displayedLogs.length}</span> de{' '}
            <span className="font-semibold text-slate-200">{totalItems}</span> registros encontrados
          </div>
          {totalPages > 1 && (
            <div className="text-xs text-slate-400">
              Página <span className="font-semibold text-slate-200">{page}</span> de{' '}
              <span className="font-semibold text-slate-200">{totalPages}</span>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-950/60 border-b border-slate-800">
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-slate-400 text-xs font-semibold py-3 w-[180px]">
                  Data / Hora
                </TableHead>
                <TableHead className="text-slate-400 text-xs font-semibold py-3 w-[180px]">
                  Usuário
                </TableHead>
                <TableHead className="text-slate-400 text-xs font-semibold py-3 w-[190px]">
                  Ação
                </TableHead>
                <TableHead className="text-slate-400 text-xs font-semibold py-3 w-[140px]">
                  Módulo
                </TableHead>
                <TableHead className="text-slate-400 text-xs font-semibold py-3">
                  Detalhes do Evento
                </TableHead>
                <TableHead className="text-slate-400 text-xs font-semibold py-3 text-right w-[80px]">
                  Info
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
                      <span className="text-xs">Carregando registros de auditoria...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : displayedLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <ScrollText className="w-8 h-8 text-slate-600" />
                      <span className="text-sm font-medium text-slate-400">
                        Nenhum registro de auditoria encontrado
                      </span>
                      <span className="text-xs text-slate-600">
                        Os eventos operacionais e tentativas de acesso negado aparecerão aqui.
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                displayedLogs.map((log) => (
                  <TableRow
                    key={log.id}
                    className="border-slate-800 hover:bg-slate-800/40 transition-colors cursor-pointer group text-xs"
                    onClick={() => setSelectedLog(log)}
                  >
                    <TableCell className="text-slate-400 py-3 font-mono whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        {formatDate(log.created)}
                      </div>
                    </TableCell>

                    <TableCell className="py-3">
                      <div className="flex items-center gap-1.5 font-medium text-slate-200">
                        <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate max-w-[150px]">{log.user_name || 'Sistema'}</span>
                      </div>
                    </TableCell>

                    <TableCell className="py-3">{getActionBadge(log.action)}</TableCell>

                    <TableCell className="py-3">
                      <Badge
                        variant="outline"
                        className="bg-slate-950 text-slate-300 border-slate-700 text-[10px]"
                      >
                        {getModuleLabel(log.module)}
                      </Badge>
                    </TableCell>

                    <TableCell className="py-3 text-slate-300">
                      <span className="line-clamp-2">
                        {log.details || 'Sem detalhes informados'}
                      </span>
                    </TableCell>

                    <TableCell className="py-3 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-400 hover:text-white group-hover:bg-slate-700/50"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedLog(log)
                        }}
                      >
                        <Info className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-slate-950/40">
            <div className="text-xs text-slate-400">
              Página {page} de {totalPages} ({totalItems} total)
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadLogs(page - 1)}
                disabled={page <= 1 || loading}
                className="h-8 border-slate-800 bg-slate-900 text-xs text-slate-300 hover:bg-slate-800 hover:text-white"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadLogs(page + 1)}
                disabled={page >= totalPages || loading}
                className="h-8 border-slate-800 bg-slate-900 text-xs text-slate-300 hover:bg-slate-800 hover:text-white"
              >
                Próximo
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold text-white">
              <ScrollText className="w-5 h-5 text-blue-400" />
              Detalhes do Registro de Auditoria
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              ID do Log: <span className="font-mono text-slate-300">{selectedLog?.id}</span>
            </DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-4 pt-2 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950 rounded-lg border border-slate-800/80">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">
                    Data e Hora
                  </span>
                  <span className="font-mono text-slate-200">
                    {formatDate(selectedLog.created)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">
                    Ação Executada
                  </span>
                  <div className="mt-0.5">{getActionBadge(selectedLog.action)}</div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">
                    Usuário
                  </span>
                  <span className="text-slate-200 font-medium">
                    {selectedLog.user_name || 'Sistema'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">
                    Módulo Afetado
                  </span>
                  <span className="text-slate-200 font-medium">
                    {getModuleLabel(selectedLog.module)}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-slate-400 block mb-1">
                  Descrição Completa
                </span>
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-slate-200 leading-relaxed">
                  {selectedLog.details || 'Sem descrição'}
                </div>
              </div>

              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 block mb-1">
                    Metadados Estruturados (JSON)
                  </span>
                  <pre className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-slate-300 font-mono text-[11px] overflow-x-auto max-h-60">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedLog(null)}
                  className="bg-slate-800 border-slate-700 text-white hover:bg-slate-700 text-xs"
                >
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
export default AuditLogPage
