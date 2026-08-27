import pb from '@/lib/pocketbase/client'
import { dbGetAll, dbGetById, dbPut, dbPutMany, dbDelete, dbGetByIndex } from './db'
import {
  Checklist,
  ChecklistResponse,
  ChecklistTemplate,
  ChecklistTemplateItem,
  Client,
  Company,
  Equipment,
  Material,
  OfflineSyncQueueItem,
  SyncLogEntry,
} from '@/types'

class SyncService {
  private isSyncing = false
  private listeners: Set<() => void> = new Set()
  private syncIntervalId: any = null
  private isOnlineListenerAttached = false

  constructor() {
    this.setupAutoSync()
  }

  public setupAutoSync() {
    if (typeof window === 'undefined') return

    // 1. Online / Network reconnection listener
    if (!this.isOnlineListenerAttached) {
      this.isOnlineListenerAttached = true
      window.addEventListener('online', async () => {
        console.log('[SyncService] Device is now ONLINE — triggering immediate sync and pull')
        try {
          if (pb.authStore.isValid) {
            await this.processSyncQueue()
            await this.pullAllData()
          }
        } catch (err) {
          console.warn('[SyncService] Auto online sync error:', err)
        }
      })
    }

    // 2. Periodic sync interval (runs every 30s)
    if (!this.syncIntervalId) {
      this.syncIntervalId = setInterval(async () => {
        try {
          if (pb.authStore.isValid && (typeof navigator === 'undefined' || navigator.onLine)) {
            const count = await this.getPendingQueueCount()
            if (count > 0) {
              await this.processSyncQueue()
            }
          }
        } catch (err) {
          console.warn('[SyncService] Periodic sync error:', err)
        }
      }, 30000)
    }
  }

  public subscribe(callback: () => void) {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }

  public notify() {
    this.listeners.forEach((cb) => cb())
  }

  public async logSyncEvent(
    type: SyncLogEntry['type'],
    message: string,
    success: boolean,
    details?: any,
  ) {
    try {
      const logItem: SyncLogEntry = {
        id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        timestamp: Date.now(),
        type,
        message,
        success,
        details,
      }
      await dbPut('sync_logs', logItem)
    } catch (e) {
      console.warn('[SyncService] Could not save sync log:', e)
    }
  }

  // Fetch all base operational data from PocketBase and store into IndexedDB
  public async pullAllData(companyId?: string): Promise<{ success: boolean; error?: string }> {
    if (!pb.authStore.isValid) {
      return { success: false, error: 'Usuário não autenticado' }
    }

    try {
      const authUser = pb.authStore.record as any
      const isClientRole = authUser?.role === 'cliente'
      const clientScopeId = isClientRole ? authUser?.client_id : undefined

      const userCompanyId = companyId || authUser?.company_id
      const compFilter = userCompanyId ? `company_id='${userCompanyId}'` : ''

      // 1. Companies
      try {
        const companies = await pb.collection('companies').getFullList<Company>({ sort: 'name' })
        await dbPutMany('companies', companies)
      } catch (err) {
        console.warn('Sync companies failed', err)
      }

      // 2. Clients (filtered strictly by company_id and clientScopeId if client role)
      try {
        const clientFilterParts: string[] = []
        if (compFilter) clientFilterParts.push(compFilter)
        if (clientScopeId) clientFilterParts.push(`id='${clientScopeId}'`)
        const finalClientFilter =
          clientFilterParts.length > 0 ? clientFilterParts.join(' && ') : undefined

        const clients = await pb.collection('clients').getFullList<Client>({
          filter: finalClientFilter,
          sort: 'name',
        })
        await dbPutMany('clients', clients)
      } catch (err) {
        console.warn('Sync clients failed', err)
      }

      // 3. Equipment (filtered strictly by company_id)
      try {
        const equipment = await pb.collection('equipment').getFullList<Equipment>({
          filter: compFilter || undefined,
          sort: 'manufacturer,model',
        })
        await dbPutMany('equipment', equipment)
      } catch (err) {
        console.warn('Sync equipment failed', err)
      }

      // 4. Materials (filtered strictly by company_id)
      try {
        const materials = await pb.collection('materials').getFullList<Material>({
          filter: compFilter || undefined,
          sort: 'tag',
        })
        await dbPutMany('materials', materials)
      } catch (err) {
        console.warn('Sync materials failed', err)
      }

      // 5. Checklist Templates (filtered strictly by company_id)
      try {
        const templates = await pb
          .collection('checklist_templates')
          .getFullList<ChecklistTemplate>({
            filter: compFilter ? `${compFilter} && active=true` : 'active=true',
            sort: 'title',
          })
        await dbPutMany('checklist_templates', templates)
      } catch (err) {
        console.warn('Sync templates failed', err)
      }

      // 5.1 Checklist Item Groups
      try {
        const itemGroups = await pb.collection('checklist_item_groups').getFullList<any>({
          sort: 'sort_order',
        })
        await dbPutMany('checklist_item_groups', itemGroups)
      } catch (err) {
        console.warn('Sync item groups failed', err)
      }

      // 6. Checklist Template Items
      try {
        const templateItems = await pb
          .collection('checklist_template_items')
          .getFullList<ChecklistTemplateItem>({
            sort: 'sort_order,order_num',
          })
        await dbPutMany('checklist_template_items', templateItems)
      } catch (err) {
        console.warn('Sync template items failed', err)
      }

      // 6.1 Users (cache users for inspector assignments and offline profile lookup)
      try {
        const users = await pb.collection('users').getFullList<any>({
          filter: compFilter || undefined,
          sort: 'name',
        })
        await dbPutMany('users', users)
      } catch (err) {
        console.warn('Sync users failed', err)
      }

      // 7. Checklists
      try {
        const chkFilterParts: string[] = []
        if (compFilter) chkFilterParts.push(compFilter)
        if (clientScopeId) chkFilterParts.push(`client_id='${clientScopeId}'`)
        const finalChkFilter = chkFilterParts.length > 0 ? chkFilterParts.join(' && ') : undefined

        const checklists = await pb.collection('checklists').getFullList<Checklist>({
          filter: finalChkFilter,
          sort: '-created',
          expand: 'template_id,client_id,equipment_id,material_id,user_id',
        })
        // Preserve local sync_status if pending or local changes
        const localChecklists = await dbGetAll<Checklist>('checklists')
        const pendingMap = new Map<string, Checklist>()
        localChecklists.forEach((c) => {
          if (c.sync_status === 'pending_sync' || c.id.startsWith('local_')) {
            pendingMap.set(c.id, c)
          }
        })

        const checklistsToStore = checklists.map((c) => {
          // If locally pending, keep local version (Last Write Wins)
          if (pendingMap.has(c.id)) {
            return pendingMap.get(c.id)!
          }
          return { ...c, sync_status: 'synced' as const }
        })

        // Also ensure any purely local checklists (not on server yet) are preserved
        for (const localPending of pendingMap.values()) {
          if (localPending.id.startsWith('local_')) {
            checklistsToStore.push(localPending)
          }
        }

        await dbPutMany('checklists', checklistsToStore)
      } catch (err) {
        console.warn('Sync checklists failed', err)
      }

      // 8. Checklist responses
      try {
        const responses = await pb
          .collection('checklist_responses')
          .getFullList<ChecklistResponse>({
            sort: 'created',
          })
        await dbPutMany('checklist_responses', responses)
      } catch (err) {
        console.warn('Sync responses failed', err)
      }

      // 9. Backup critical offline state to localStorage as secondary fallback
      this.backupToLocalStorage()

      await this.logSyncEvent('pull', 'Dados de referência atualizados com sucesso.', true)
      this.notify()
      return { success: true }
    } catch (err: any) {
      console.error('pullAllData error:', err)
      await this.logSyncEvent('pull', `Erro ao puxar dados: ${err.message}`, false, err)
      return { success: false, error: err.message || 'Erro ao sincronizar dados' }
    }
  }

  // Backup key offline datasets to localStorage for resilience
  private async backupToLocalStorage() {
    try {
      const [tpls, clients, eqs, mats, pendingChk] = await Promise.all([
        dbGetAll('checklist_templates'),
        dbGetAll('clients'),
        dbGetAll('equipment'),
        dbGetAll('materials'),
        dbGetAll<Checklist>('checklists').then((list) =>
          list.filter((c) => c.sync_status === 'pending_sync' || c.id.startsWith('local_')),
        ),
      ])

      localStorage.setItem('offline_backup_templates', JSON.stringify(tpls.slice(0, 50)))
      localStorage.setItem('offline_backup_clients', JSON.stringify(clients.slice(0, 50)))
      localStorage.setItem('offline_backup_equipment', JSON.stringify(eqs.slice(0, 50)))
      localStorage.setItem('offline_backup_materials', JSON.stringify(mats.slice(0, 50)))
      if (pendingChk.length > 0) {
        localStorage.setItem('offline_backup_pending_checklists', JSON.stringify(pendingChk))
      }
    } catch (e) {
      console.warn('[SyncService] LocalStorage backup warning:', e)
    }
  }

  // Fetch all sync logs for auditing and debugging
  public async getSyncLogs(): Promise<SyncLogEntry[]> {
    try {
      const logs = await dbGetAll<SyncLogEntry>('sync_logs')
      return logs.sort((a, b) => b.timestamp - a.timestamp)
    } catch {
      return []
    }
  }

  // Instant response update in IndexedDB without UI latency
  public async updateResponseInstant(
    checklistId: string,
    response: Partial<ChecklistResponse>,
  ): Promise<ChecklistResponse> {
    const respId = response.id || `local_resp_${checklistId}_${response.item_id || Date.now()}`
    const fullResp: ChecklistResponse = {
      id: respId,
      checklist_id: checklistId,
      item_id: response.item_id,
      item_title: response.item_title || '',
      item_section: response.item_section || '',
      status: response.status || 'PENDENTE',
      observation: response.observation || '',
      photo_url: response.photo_url || '',
      value: response.value || '',
      is_critical_fail: response.is_critical_fail || false,
      created: response.created || new Date().toISOString(),
      updated: new Date().toISOString(),
    }

    await dbPut('checklist_responses', fullResp)

    // Mark parent checklist as pending_sync in IndexedDB
    const localChk = await dbGetById<Checklist>('checklists', checklistId)
    if (localChk) {
      await dbPut('checklists', {
        ...localChk,
        sync_status: 'pending_sync',
        updated: new Date().toISOString(),
      })
    }

    // Auto enqueue debounced sync
    this.enqueueSyncDebounced(checklistId)
    return fullResp
  }

  private debounceTimers = new Map<string, any>()
  private enqueueSyncDebounced(checklistId: string) {
    if (this.debounceTimers.has(checklistId)) {
      clearTimeout(this.debounceTimers.get(checklistId))
    }

    const timer = setTimeout(async () => {
      this.debounceTimers.delete(checklistId)
      try {
        const responses = await dbGetByIndex<ChecklistResponse>(
          'checklist_responses',
          'checklist_id',
          checklistId,
        )
        const localChk = await dbGetById<Checklist>('checklists', checklistId)

        // If checklist is already pending or newly created offline
        if (localChk) {
          await this.saveChecklistLocally(localChk, responses, false)
        }
        this.notify()
      } catch (err) {
        console.warn('[SyncService] Debounced sync enqueue warning:', err)
      }
    }, 1500)

    this.debounceTimers.set(checklistId, timer)
  }

  public isLocalId(id?: string): boolean {
    if (!id) return true
    return (
      id.startsWith('queue_') ||
      id.startsWith('local_') ||
      id.startsWith('local_resp_') ||
      id.startsWith('eq_') ||
      id.startsWith('mat_') ||
      id.startsWith('cli_') ||
      id.startsWith('tpl_') ||
      id.startsWith('item_') ||
      id.startsWith('temp_') ||
      id.startsWith('resp_')
    )
  }

  /**
   * Helper method to call /api/batch/save-checklist-responses reliably
   * uses pb.send with explicit headers, fallback to fetch(), and finally sequential upsert fallback
   */
  public async sendBatchChecklistResponses(
    checklistId: string,
    responses: Array<Record<string, any>>,
  ): Promise<{ success: boolean; count?: number; items?: ChecklistResponse[] }> {
    if (!checklistId) throw new Error('checklist_id é obrigatório para batch')

    const payload = {
      checklist_id: checklistId,
      responses: responses.map((r) => ({
        item_id:
          r.item_id &&
          !String(r.item_id).startsWith('item_') &&
          !String(r.item_id).startsWith('local_') &&
          !String(r.item_id).startsWith('temp_')
            ? r.item_id
            : undefined,
        item_title: r.item_title || '',
        item_section: r.item_section || '',
        status: r.status || 'PENDENTE',
        observation: r.observation || '',
        photo_url: r.photo_url || '',
        value: r.value || '',
        is_critical_fail: Boolean(r.is_critical_fail),
      })),
    }

    // 1. Try with pb.send
    try {
      const res = await pb.send<{
        success: boolean
        count?: number
        items?: ChecklistResponse[]
      }>('/api/batch/save-checklist-responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(pb.authStore.token ? { Authorization: pb.authStore.token } : {}),
        },
        body: payload,
      })
      return res
    } catch (pbSendErr) {
      console.warn(
        'pb.send failed for batch responses, attempting direct fetch fallback:',
        pbSendErr,
      )

      // 2. Fallback to direct fetch
      try {
        const baseUrl = pb.baseURL || import.meta.env.VITE_POCKETBASE_URL || ''
        const url = `${baseUrl.replace(/\/+$/, '')}/api/batch/save-checklist-responses`
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        }
        if (pb.authStore.token) {
          headers['Authorization'] = pb.authStore.token
        }

        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        })

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`Batch save failed HTTP ${response.status}: ${errorText}`)
        }

        const json = await response.json()
        return json
      } catch (directFetchErr) {
        console.warn(
          '[sendBatchChecklistResponses] Batch endpoint indisponível (404/erro). Acionando fallback sequencial via PocketBase collections...',
          directFetchErr,
        )
        const sequentialItems = await this.saveResponsesSequentially(
          payload.responses as any[],
          checklistId,
        )
        return {
          success: true,
          count: sequentialItems.length,
          items: sequentialItems,
        }
      }
    }
  }

  /**
   * Fallback sequencial para salvar respostas individualmente via PocketBase Collections API
   * com delay de 200ms entre as requisições para evitar rate limit (429) e upsert para evitar duplicatas.
   */
  public async saveResponsesSequentially(
    responses: Array<{
      item_id?: string
      item_title?: string
      item_section?: string
      status?: any
      observation?: string
      photo_url?: string
      value?: string
      is_critical_fail?: boolean
    }>,
    checklistId: string,
  ): Promise<ChecklistResponse[]> {
    const results: ChecklistResponse[] = []
    console.log(
      `[saveResponsesSequentially] Salvando ${responses.length} respostas sequencialmente para o checklist ${checklistId}...`,
    )

    for (const response of responses) {
      try {
        // Tentar upsert: primeiro buscar se já existe resposta para este checklist_id + item_id (ou item_title se item_id ausente)
        let existing: { items: any[] } = { items: [] }

        if (response.item_id) {
          existing = await pb.collection('checklist_responses').getList(1, 1, {
            filter: `checklist_id="${checklistId}" && item_id="${response.item_id}"`,
          })
        } else if (response.item_title) {
          existing = await pb.collection('checklist_responses').getList(1, 1, {
            filter: `checklist_id="${checklistId}" && item_title="${response.item_title.replace(/"/g, '\\"')}"`,
          })
        }

        if (existing.items.length > 0) {
          // Update
          const updated = await pb
            .collection('checklist_responses')
            .update<ChecklistResponse>(existing.items[0].id, {
              status: response.status || 'PENDENTE',
              observation: response.observation || '',
              value: response.value || '',
              is_critical_fail: response.is_critical_fail || false,
              item_section: response.item_section || '',
              item_title: response.item_title || '',
              photo_url: response.photo_url || '',
            })
          results.push(updated)
        } else {
          // Create
          const created = await pb.collection('checklist_responses').create<ChecklistResponse>({
            checklist_id: checklistId,
            item_id: response.item_id || undefined,
            item_title: response.item_title || '',
            item_section: response.item_section || '',
            status: response.status || 'PENDENTE',
            observation: response.observation || '',
            value: response.value || '',
            photo_url: response.photo_url || '',
            is_critical_fail: response.is_critical_fail || false,
          })
          results.push(created)
        }
      } catch (err) {
        console.warn(
          `Falha ao salvar resposta do item ${response.item_id || response.item_title}:`,
          err,
        )
        // Continua com os próximos — não quebra o loop
      }

      // Delay de 200ms para evitar rate limiting (429)
      await new Promise((resolve) => setTimeout(resolve, 200))
    }

    console.log(
      `[saveResponsesSequentially] Finalizado: ${results.length}/${responses.length} respostas salvas com sucesso no backend.`,
    )
    return results
  }

  /**
   * Substitui todas as referências de um ID local pelo ID real do servidor no IndexedDB e na fila de sync.
   */
  public async replaceLocalChecklistIdEverywhere(localId: string, serverId: string): Promise<void> {
    if (!localId || !serverId || localId === serverId) return

    console.log(
      `[SyncService] Substituindo ID local '${localId}' por '${serverId}' em todo o banco local...`,
    )

    // 1. Atualizar registro do checklist em 'checklists'
    const localChk = await dbGetById<Checklist>('checklists', localId)
    if (localChk) {
      await dbDelete('checklists', localId)
      await dbPut('checklists', {
        ...localChk,
        id: serverId,
        sync_status: 'synced',
        updated: new Date().toISOString(),
      })
    }

    // 2. Atualizar todas as respostas vinculadas ao localId em 'checklist_responses'
    const responses = await dbGetByIndex<ChecklistResponse>(
      'checklist_responses',
      'checklist_id',
      localId,
    )
    for (const r of responses) {
      await dbPut('checklist_responses', {
        ...r,
        checklist_id: serverId,
      })
    }

    // 3. Atualizar itens na fila de sincronização ('sync_queue')
    const queue = await dbGetAll<OfflineSyncQueueItem>('sync_queue')
    for (const item of queue) {
      let modified = false
      if (item.entity === 'checklists') {
        if (item.payload?.id === localId) {
          item.payload.id = serverId
          modified = true
        }
      }
      if (item.action === 'batch_responses' && item.payload?.checklist_id === localId) {
        item.payload.checklist_id = serverId
        modified = true
      }
      if (item.entity === 'checklist_responses' && item.payload?.checklist_id === localId) {
        item.payload.checklist_id = serverId
        modified = true
      }
      if (modified) {
        await dbPut('sync_queue', item)
      }
    }
  }

  /**
   * Push pending queue items to PocketBase
   */
  public async processSyncQueue(): Promise<{ total: number; processed: number; errors: number }> {
    if (this.isSyncing) return { total: 0, processed: 0, errors: 0 }
    if (!pb.authStore.isValid) {
      await this.logSyncEvent('info', 'Sincronização adiada: usuário não autenticado', false)
      return { total: 0, processed: 0, errors: 0 }
    }

    this.isSyncing = true
    this.notify()

    let processed = 0
    let errors = 0
    // In-memory mapping of local IDs to real server IDs for this sync session
    const idMap = new Map<string, string>()

    try {
      const rawQueue = await dbGetAll<OfflineSyncQueueItem>('sync_queue')

      // Pre-process & group individual checklist_responses into batch_responses by checklist_id
      const individualResponses = rawQueue.filter(
        (item) => item.entity === 'checklist_responses' && item.action === 'create',
      )

      if (individualResponses.length > 0) {
        const responsesByChecklist = new Map<string, Array<OfflineSyncQueueItem>>()
        for (const item of individualResponses) {
          const chkId = item.payload?.checklist_id || 'unknown'
          const list = responsesByChecklist.get(chkId) || []
          list.push(item)
          responsesByChecklist.set(chkId, list)
        }

        // For each group, replace with or convert to a batch_responses action
        for (const [chkId, items] of responsesByChecklist.entries()) {
          const combinedResponses = items.map((it) => it.payload)
          const batchQueueItem: OfflineSyncQueueItem = {
            id: `queue_batch_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
            entity: 'checklists',
            action: 'batch_responses',
            payload: {
              checklist_id: chkId,
              responses: combinedResponses,
            },
            timestamp: Math.min(...items.map((it) => it.timestamp)),
            attempts: 0,
          }
          await dbPut('sync_queue', batchQueueItem)

          for (const it of items) {
            await dbDelete('sync_queue', it.id)
          }
        }
      }

      // Re-read queue after consolidation
      const queue = await dbGetAll<OfflineSyncQueueItem>('sync_queue')

      /**
       * Prioridade de Sincronização:
       * 1: Entidades mestres (clientes, equipamentos, materiais, etc.)
       * 2: Criação de checklists (com status inicial ou intermediário)
       * 3: Batch responses / respostas dos checklists (DEVEM subir ANTES da finalização!)
       * 4: Atualização / Finalização do checklist (mudança de status para Concluído/Reprovado)
       * 5: Exclusões
       */
      const getItemPriority = (item: OfflineSyncQueueItem): number => {
        if (
          item.entity === 'clients' ||
          item.entity === 'equipment' ||
          item.entity === 'materials' ||
          item.entity === 'templates' ||
          item.entity === 'checklist_item_groups'
        ) {
          return 1
        }
        if (item.entity === 'checklists' && item.action === 'create') {
          return 2
        }
        if (item.action === 'batch_responses' || item.entity === 'checklist_responses') {
          return 3
        }
        if (item.entity === 'checklists' && item.action === 'update') {
          return 4
        }
        if (item.action === 'delete') {
          return 5
        }
        return 99
      }

      const sortedQueue = queue.sort((a, b) => {
        const priorityA = getItemPriority(a)
        const priorityB = getItemPriority(b)
        if (priorityA !== priorityB) {
          return priorityA - priorityB
        }
        return a.timestamp - b.timestamp
      })

      for (const item of sortedQueue) {
        try {
          const targetLocalId = item.payload?.id || item.id

          if (item.action === 'create') {
            const {
              id: _ignoredId,
              local_id: _ignoredLocalId,
              expand: _ignoredExpand,
              sync_status: _ignoredSyncStatus,
              created: _ignoredCreated,
              updated: _ignoredUpdated,
              collectionId: _ignoredCollectionId,
              collectionName: _ignoredCollectionName,
              ...rawPayloadData
            } = item.payload || {}

            const payloadData: Record<string, any> = { ...rawPayloadData }

            // Se for criação de checklist que já vem marcado como finalizado,
            // criamos primeiro como "Em Andamento" se houver respostas a serem sincronizadas
            const originalTargetStatus = payloadData.status
            const hasPendingResponses = sortedQueue.some(
              (q) =>
                (q.action === 'batch_responses' &&
                  (q.payload?.checklist_id === targetLocalId ||
                    q.payload?.checklist_id === item.id)) ||
                (q.entity === 'checklist_responses' &&
                  (q.payload?.checklist_id === targetLocalId ||
                    q.payload?.checklist_id === item.id)),
            )

            if (item.entity === 'checklists' && hasPendingResponses) {
              payloadData.status = 'Em Andamento'
            }

            // Clean item_id relation if local or invalid
            if (payloadData.item_id && this.isLocalId(payloadData.item_id)) {
              delete payloadData.item_id
            }

            // Clean empty string relation fields
            for (const relField of [
              'client_id',
              'equipment_id',
              'material_id',
              'item_id',
              'template_id',
              'user_id',
              'company_id',
              'checklist_id',
            ]) {
              if (payloadData[relField] === '') {
                delete payloadData[relField]
              }
            }

            // Resolve local IDs in relation fields (e.g. checklist_id)
            if (payloadData.checklist_id) {
              if (idMap.has(payloadData.checklist_id)) {
                payloadData.checklist_id = idMap.get(payloadData.checklist_id)
              } else if (this.isLocalId(payloadData.checklist_id)) {
                const localChk = await dbGetById<Checklist>('checklists', payloadData.checklist_id)
                if (localChk && localChk.sync_status === 'synced' && !this.isLocalId(localChk.id)) {
                  payloadData.checklist_id = localChk.id
                  idMap.set(payloadData.checklist_id, localChk.id)
                } else {
                  console.warn(
                    `Skipping sync for item ${item.id} (${item.entity}): checklist '${payloadData.checklist_id}' is pending sync or not found`,
                  )
                  continue
                }
              }
            }

            const res = await pb.collection(item.entity).create(payloadData)

            // Save mapping localId -> serverId
            if (targetLocalId) {
              idMap.set(targetLocalId, res.id)
            }
            if (item.id && item.id !== targetLocalId) {
              idMap.set(item.id, res.id)
            }

            // Se for checklist, substituir imediatamente o ID em todos os lugares
            if (item.entity === 'checklists') {
              await this.replaceLocalChecklistIdEverywhere(targetLocalId, res.id)
              if (item.id && item.id !== targetLocalId) {
                await this.replaceLocalChecklistIdEverywhere(item.id, res.id)
              }

              // Se o status original era finalizado ("Concluído"/"Reprovado"), agendar/garantir a atualização de status para depois das respostas
              if (
                originalTargetStatus &&
                originalTargetStatus !== 'Em Andamento' &&
                originalTargetStatus !== 'Pendente'
              ) {
                const updateStatusItem: OfflineSyncQueueItem = {
                  id: `queue_status_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
                  entity: 'checklists',
                  action: 'update',
                  payload: {
                    id: res.id,
                    status: originalTargetStatus,
                    completed_at: item.payload?.completed_at || new Date().toISOString(),
                    signature_data: item.payload?.signature_data,
                    filled_by_name: item.payload?.filled_by_name,
                    filled_by_signature: item.payload?.filled_by_signature,
                  },
                  timestamp: Date.now() + 1000,
                  attempts: 0,
                }
                await dbPut('sync_queue', updateStatusItem)
              }
            } else if (item.entity === 'checklist_responses') {
              await dbDelete('checklist_responses', targetLocalId)
              if (item.id !== targetLocalId) {
                await dbDelete('checklist_responses', item.id)
              }
              await dbPut('checklist_responses', { ...item.payload, id: res.id })
            }
          } else if (item.action === 'update') {
            const {
              id: _ignoredId,
              local_id: _ignoredLocalId,
              expand: _ignoredExpand,
              sync_status: _ignoredSyncStatus,
              created: _ignoredCreated,
              updated: _ignoredUpdated,
              collectionId: _ignoredCollectionId,
              collectionName: _ignoredCollectionName,
              ...rawUpdatePayloadData
            } = item.payload || {}

            const updatePayloadData: Record<string, any> = { ...rawUpdatePayloadData }

            // Clean empty string relation fields
            for (const relField of [
              'client_id',
              'equipment_id',
              'material_id',
              'item_id',
              'template_id',
              'user_id',
              'company_id',
            ]) {
              if (updatePayloadData[relField] === '') {
                delete updatePayloadData[relField]
              }
            }

            let serverId = idMap.get(targetLocalId) || idMap.get(item.id) || targetLocalId

            if (this.isLocalId(serverId)) {
              // Se ainda é ID local, tentar resolver no IndexedDB
              const localChk = await dbGetById<Checklist>('checklists', serverId)
              if (localChk && !this.isLocalId(localChk.id)) {
                serverId = localChk.id
                idMap.set(targetLocalId, serverId)
              }
            }

            if (this.isLocalId(serverId)) {
              // Create first (POST) then record mapping
              const res = await pb.collection(item.entity).create(updatePayloadData)
              serverId = res.id
              idMap.set(targetLocalId, res.id)
              if (item.id) idMap.set(item.id, res.id)

              if (item.entity === 'checklists') {
                await this.replaceLocalChecklistIdEverywhere(targetLocalId, res.id)
              }
            } else {
              // Real server ID is known, perform update (PATCH)
              await pb.collection(item.entity).update(serverId, updatePayloadData)
              if (item.entity === 'checklists') {
                const localChk = await dbGetById<Checklist>('checklists', serverId)
                if (localChk) {
                  await dbPut('checklists', { ...localChk, sync_status: 'synced' })
                }
              }
            }
          } else if (item.action === 'delete') {
            const targetId = idMap.get(targetLocalId) || idMap.get(item.id) || targetLocalId
            if (!this.isLocalId(targetId)) {
              await pb.collection(item.entity).delete(targetId)
            }
          } else if (item.action === 'batch_responses') {
            const batchPayload = item.payload
            if (
              batchPayload &&
              batchPayload.checklist_id &&
              Array.isArray(batchPayload.responses)
            ) {
              let targetChecklistId =
                idMap.get(batchPayload.checklist_id) || batchPayload.checklist_id

              if (this.isLocalId(targetChecklistId)) {
                const localChk = await dbGetById<Checklist>('checklists', targetChecklistId)
                if (localChk && localChk.sync_status === 'synced' && !this.isLocalId(localChk.id)) {
                  targetChecklistId = localChk.id
                  idMap.set(batchPayload.checklist_id, localChk.id)
                } else {
                  console.warn(
                    `Skipping batch_responses for local checklist '${targetChecklistId}' — waiting for checklist creation to complete`,
                  )
                  continue
                }
              }

              // Atualiza o checklist_id de cada resposta no payload para o ID real do servidor
              const resolvedResponses = batchPayload.responses.map((r: any) => ({
                ...r,
                checklist_id: targetChecklistId,
              }))

              const res = await this.sendBatchChecklistResponses(
                targetChecklistId,
                resolvedResponses,
              )
              if (res && Array.isArray(res.items)) {
                await dbPutMany('checklist_responses', res.items)
              }
            }
          }

          // Remove successfully processed item from queue
          await dbDelete('sync_queue', item.id)
          processed++
        } catch (queueErr: any) {
          console.error(`Error processing queue item ${item.id}:`, queueErr)
          errors++
          item.attempts = (item.attempts || 0) + 1
          item.error = queueErr.message
          await dbPut('sync_queue', item)
        }
      }

      if (processed > 0 || errors > 0) {
        await this.logSyncEvent(
          errors > 0 ? 'error' : 'push',
          `Sincronização da fila: ${processed} processados, ${errors} erros`,
          errors === 0,
          { processed, errors },
        )
      }
    } catch (globalSyncErr: any) {
      console.error('[SyncService] Global sync queue process error:', globalSyncErr)
      await this.logSyncEvent(
        'error',
        `Falha global na sincronização: ${globalSyncErr.message}`,
        false,
      )
    } finally {
      this.isSyncing = false
      this.notify()
    }

    return { total: processed + errors, processed, errors }
  }

  /**
   * Salva checklist e respostas no IndexedDB e sincroniza/enfileira na ORDEM CORRETA:
   * 1. Criar checklist (se novo)
   * 2. Salvar TODAS as respostas (batch)
   * 3. Atualizar status para Concluído/Reprovado (se finalizado)
   */
  public async saveChecklistLocally(
    checklist: Partial<Checklist>,
    responses: Partial<ChecklistResponse>[],
    isOnline: boolean,
  ): Promise<{ checklist: Checklist; responses: ChecklistResponse[] }> {
    const isNew = !checklist.id || checklist.id.startsWith('local_')
    const checklistId =
      checklist.id || `local_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`

    const userCompanyId = checklist.company_id || (pb.authStore.record as any)?.company_id || ''
    const targetFinalStatus = checklist.status || 'Em Andamento'
    const isFinalizing = targetFinalStatus === 'Concluído' || targetFinalStatus === 'Reprovado'

    const fullChecklist: Checklist = {
      id: checklistId,
      company_id: userCompanyId,
      template_id: checklist.template_id || '',
      client_id: checklist.client_id,
      equipment_id: checklist.equipment_id,
      material_id: checklist.material_id,
      user_id: checklist.user_id || pb.authStore.record?.id || '',
      code:
        checklist.code ||
        `CHK-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
      title: checklist.title || 'Checklist de Içamento',
      location: checklist.location || '',
      operation_type: checklist.operation_type || '',
      scheduled_date: checklist.scheduled_date || new Date().toISOString(),
      started_at: checklist.started_at || new Date().toISOString(),
      completed_at: checklist.completed_at,
      status: targetFinalStatus,
      risk_level: checklist.risk_level || 'Médio',
      notes: checklist.notes || '',
      inspector_name: checklist.inspector_name || (pb.authStore.record as any)?.name || 'Inspetor',
      signature_data: checklist.signature_data,
      filled_by_name: checklist.filled_by_name || '',
      filled_by_signature: checklist.filled_by_signature || '',
      sync_status: isOnline ? 'synced' : 'pending_sync',
      created: checklist.created || new Date().toISOString(),
      updated: new Date().toISOString(),
      expand: checklist.expand,
    }

    // 1. Salvar checklist no IndexedDB local
    await dbPut('checklists', fullChecklist)

    // 2. Salvar respostas no IndexedDB local
    const savedResponses: ChecklistResponse[] = []
    for (const r of responses) {
      const respId =
        r.id || `local_resp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
      const fullResp: ChecklistResponse = {
        id: respId,
        checklist_id: checklistId,
        item_id: r.item_id,
        item_title: r.item_title || '',
        item_section: r.item_section || '',
        status: r.status || 'PENDENTE',
        observation: r.observation || '',
        photo_url: r.photo_url || '',
        value: r.value || '',
        is_critical_fail: r.is_critical_fail || false,
        created: r.created || new Date().toISOString(),
        updated: new Date().toISOString(),
      }
      await dbPut('checklist_responses', fullResp)
      savedResponses.push(fullResp)
    }

    if (isOnline && pb.authStore.isValid) {
      let serverChkId: string | null = null
      try {
        // FLUXO CORRETO DE SINCRONIZAÇÃO ONLINE:
        // Passo 1: Criar o cabeçalho no servidor (com status inicial "Em Andamento" se for novo para garantir que não haja bloqueio)
        if (isNew) {
          const {
            id: _ignoredId,
            expand: _ignoredExpand,
            sync_status: _ignoredSyncStatus,
            created: _ignoredCreated,
            updated: _ignoredUpdated,
            collectionId: _ignoredCollectionId,
            collectionName: _ignoredCollectionName,
            ...rawCreatePayload
          } = fullChecklist as any
          const createPayload: Record<string, any> = { ...rawCreatePayload }
          if (createPayload.client_id === '') delete createPayload.client_id
          if (createPayload.equipment_id === '') delete createPayload.equipment_id
          if (createPayload.material_id === '') delete createPayload.material_id

          // Criar inicialmente como "Em Andamento" para que o checklist_id passe a existir
          createPayload.status = isFinalizing ? 'Em Andamento' : targetFinalStatus

          const createdChk = await pb.collection('checklists').create(createPayload)
          serverChkId = createdChk.id

          // Atualizar o ID local para o ID do servidor em todo o IndexedDB e no objeto em memória
          await this.replaceLocalChecklistIdEverywhere(checklistId, createdChk.id)
          fullChecklist.id = createdChk.id
          fullChecklist.sync_status = 'synced'
        } else {
          serverChkId = checklistId
        }

        // Passo 2: Salvar TODAS as respostas ANTES de mudar o status para Concluído/Reprovado
        const batchResponsesPayload = savedResponses.map((resp) => {
          const rObj: Record<string, any> = {
            item_title: resp.item_title,
            item_section: resp.item_section,
            status: resp.status,
            observation: resp.observation,
            photo_url: resp.photo_url,
            value: resp.value,
            is_critical_fail: resp.is_critical_fail,
          }
          if (
            resp.item_id &&
            !resp.item_id.startsWith('item_') &&
            !resp.item_id.startsWith('local_') &&
            !resp.item_id.startsWith('temp_')
          ) {
            rObj.item_id = resp.item_id
          }
          return rObj
        })

        const batchRes = await this.sendBatchChecklistResponses(serverChkId, batchResponsesPayload)

        // Limpar respostas temporárias e persistir respostas reais do servidor
        for (const resp of savedResponses) {
          await dbDelete('checklist_responses', resp.id)
        }
        if (batchRes && Array.isArray(batchRes.items) && batchRes.items.length > 0) {
          await dbPutMany('checklist_responses', batchRes.items)
          for (let i = 0; i < batchRes.items.length; i++) {
            savedResponses[i] = batchRes.items[i]
          }
        }

        // Passo 3: Atualizar o status e assinaturas do checklist para o status final (Concluído/Reprovado)
        const {
          id: _ignoredId,
          expand: _ignoredExpand,
          sync_status: _ignoredSyncStatus,
          created: _ignoredCreated,
          updated: _ignoredUpdated,
          collectionId: _ignoredCollectionId,
          collectionName: _ignoredCollectionName,
          ...rawUpdatePayload
        } = fullChecklist as any
        const updatePayload: Record<string, any> = {
          ...rawUpdatePayload,
          status: targetFinalStatus,
        }
        if (updatePayload.client_id === '') delete updatePayload.client_id
        if (updatePayload.equipment_id === '') delete updatePayload.equipment_id
        if (updatePayload.material_id === '') delete updatePayload.material_id

        await pb.collection('checklists').update(serverChkId, updatePayload)
        fullChecklist.status = targetFinalStatus
        fullChecklist.sync_status = 'synced'
        await dbPut('checklists', fullChecklist)
      } catch (uploadErr) {
        console.warn(
          'Online sync failed during save, enqueuing for offline retry in correct order',
          uploadErr,
        )

        const targetChkId = serverChkId || checklistId
        fullChecklist.id = targetChkId
        fullChecklist.sync_status = 'pending_sync'
        await dbPut('checklists', fullChecklist)

        // Enfileirar na ordem correta:
        // 1. Checklist create/update (com status intermediário se novo)
        if (!serverChkId) {
          await this.enqueueSync('checklists', 'create', {
            ...fullChecklist,
            id: checklistId,
            status: isFinalizing ? 'Em Andamento' : targetFinalStatus,
          })
        }

        // 2. Batch responses
        await this.enqueueSync('checklists', 'batch_responses', {
          checklist_id: targetChkId,
          responses: savedResponses.map((r) => ({
            ...r,
            checklist_id: targetChkId,
            item_id: r.item_id && this.isLocalId(r.item_id) ? undefined : r.item_id,
          })),
        })

        // 3. Final status update (se finalizado)
        if (isFinalizing) {
          await this.enqueueSync('checklists', 'update', {
            id: targetChkId,
            status: targetFinalStatus,
            completed_at: fullChecklist.completed_at || new Date().toISOString(),
            signature_data: fullChecklist.signature_data,
            filled_by_name: fullChecklist.filled_by_name,
            filled_by_signature: fullChecklist.filled_by_signature,
          })
        }
      }
    } else {
      // OFFLINE MODE:
      // Enfileirar na ordem rigorosamente correta para quando a conexão retornar:
      // 1. Criar/atualizar checklist
      fullChecklist.sync_status = 'pending_sync'
      await dbPut('checklists', fullChecklist)

      if (isNew) {
        await this.enqueueSync('checklists', 'create', {
          ...fullChecklist,
          id: checklistId,
          status: isFinalizing ? 'Em Andamento' : targetFinalStatus,
        })
      } else {
        await this.enqueueSync('checklists', 'update', {
          ...fullChecklist,
          id: checklistId,
          status: isFinalizing ? 'Em Andamento' : targetFinalStatus,
        })
      }

      // 2. Batch responses
      await this.enqueueSync('checklists', 'batch_responses', {
        checklist_id: checklistId,
        responses: savedResponses.map((r) => ({
          ...r,
          checklist_id: checklistId,
          item_id: r.item_id && this.isLocalId(r.item_id) ? undefined : r.item_id,
        })),
      })

      // 3. Final status update
      if (isFinalizing) {
        await this.enqueueSync('checklists', 'update', {
          id: checklistId,
          status: targetFinalStatus,
          completed_at: fullChecklist.completed_at || new Date().toISOString(),
          signature_data: fullChecklist.signature_data,
          filled_by_name: fullChecklist.filled_by_name,
          filled_by_signature: fullChecklist.filled_by_signature,
        })
      }
    }

    this.notify()
    return { checklist: fullChecklist, responses: savedResponses }
  }

  // Queue helper
  private async enqueueSync(
    entity: OfflineSyncQueueItem['entity'],
    action: OfflineSyncQueueItem['action'],
    payload: any,
  ) {
    const queueItem: OfflineSyncQueueItem = {
      id: `queue_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      entity,
      action,
      payload,
      timestamp: Date.now(),
      attempts: 0,
    }
    await dbPut('sync_queue', queueItem)
  }

  public async getPendingQueueCount(): Promise<number> {
    const queue = await dbGetAll<OfflineSyncQueueItem>('sync_queue')
    return queue.length
  }
}

export const syncService = new SyncService()
