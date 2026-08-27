import React, { useState, useEffect } from 'react'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { syncService } from '@/lib/offline/sync-service'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Wifi, WifiOff, RefreshCw, CheckCircle2, AlertCircle, Database } from 'lucide-react'
import { toast } from 'sonner'

export const OfflineSyncBar: React.FC = () => {
  const { isOnline, simulatedOffline, toggleSimulateOffline } = useOnlineStatus()
  const [pendingCount, setPendingCount] = useState<number>(0)
  const [isSyncing, setIsSyncing] = useState<boolean>(false)
  const [syncProgress, setSyncProgress] = useState<{ processed: number; total: number } | null>(
    null,
  )

  const updateStatus = async () => {
    const count = await syncService.getPendingQueueCount()
    setPendingCount(count)
  }

  useEffect(() => {
    updateStatus()
    const unsub = syncService.subscribe(() => {
      updateStatus()
    })
    return () => {
      unsub()
    }
  }, [])

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && pendingCount > 0 && !isSyncing) {
      handleManualSync()
    }
  }, [isOnline, pendingCount])

  const handleManualSync = async () => {
    if (!isOnline) {
      toast.warning('Dispositivo offline. Conecte-se à internet para sincronizar com o servidor.')
      return
    }

    setIsSyncing(true)
    setSyncProgress({ processed: 0, total: pendingCount })
    toast.info('Sincronizando dados com o servidor PocketBase...')
    try {
      const res = await syncService.processSyncQueue()
      await syncService.pullAllData()
      await updateStatus()
      if (res.errors > 0) {
        toast.error(`Sincronização concluída com ${res.errors} erros de validação.`)
      } else {
        toast.success(
          `Tudo atualizado! ${res.processed > 0 ? res.processed : 'Todos os'} registros sincronizados com sucesso.`,
        )
      }
    } catch (err: any) {
      console.warn('Erro na sincronização:', err)
      toast.error('Erro na sincronização: ' + err.message)
    } finally {
      setIsSyncing(false)
      setSyncProgress(null)
    }
  }

  return (
    <div className="flex items-center gap-2">
      {/* Simulation Toggle Button for field testing */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            onClick={toggleSimulateOffline}
            className={`h-8 text-xs font-normal border transition-all active:scale-95 ${
              simulatedOffline || !isOnline
                ? 'bg-amber-950/40 text-amber-400 border-amber-800/80 hover:bg-amber-900/50'
                : 'bg-slate-900/60 text-slate-300 border-slate-800 hover:bg-slate-800'
            }`}
          >
            {simulatedOffline || !isOnline ? (
              <>
                <WifiOff className="w-3.5 h-3.5 mr-1.5 text-amber-400 shrink-0" />
                <span className="hidden sm:inline">
                  {simulatedOffline ? 'Modo Campo (Offline Forçado)' : 'Offline (Sem Sinal)'}
                </span>
                <span className="sm:hidden">Offline</span>
              </>
            ) : (
              <>
                <Wifi className="w-3.5 h-3.5 mr-1.5 text-emerald-400 shrink-0" />
                <span className="hidden sm:inline">Online (Conectado)</span>
                <span className="sm:hidden">Online</span>
              </>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs max-w-xs">
          {simulatedOffline
            ? 'Modo Offline Ativo: todos os checklists serão gravados localmente no IndexedDB e sincronizados depois.'
            : 'Clique para simular perda de sinal no campo e testar o funcionamento 100% offline.'}
        </TooltipContent>
      </Tooltip>

      {/* Sync Status Badge / Action */}
      {pendingCount > 0 ? (
        <Button
          variant="secondary"
          size="sm"
          onClick={handleManualSync}
          disabled={isSyncing || !isOnline}
          className="h-8 text-xs bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>
            {isSyncing
              ? 'Sincronizando...'
              : `${pendingCount} pendente${pendingCount > 1 ? 's' : ''}`}
          </span>
        </Button>
      ) : (
        <div className="hidden md:flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950/30 border border-emerald-800/40 px-2.5 py-1 rounded-md">
          <Database className="w-3.5 h-3.5" />
          <span>Dados Salvos Localmente</span>
        </div>
      )}
    </div>
  )
}
