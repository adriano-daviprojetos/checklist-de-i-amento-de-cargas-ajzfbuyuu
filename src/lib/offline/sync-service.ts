import pb from '@/lib/pocketbase/client'
import { dbGetAll, dbGetById, dbPut, dbPutMany, dbDelete, dbGetByIndex, dbClearStore } from './db'
import {
  Checklist,
  ChecklistResponse,
  ChecklistTemplate,
  ChecklistTemplateItem,
  Equipment,
  Material,
  Client,
  Company,
  OfflineSyncQueueItem,
} from '@/types'

class SyncService {
  private isSyncing = false
  private listeners: Set<() => void> = new Set()

  public subscribe(callback: () => void) {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }

  private notify() {
    this.listeners.forEach((cb) => cb())
  }

  // Fetch all base operational data from PocketBase and store into IndexedDB
  public async pullAllData(companyId?: string): Promise<{ success: boolean; error?: string }> {
    if (!pb.authStore.isValid) {
      return { success: false, error: 'Usuário não autenticado' }
    }

    try {
      const userCompanyId = companyId || (pb.authStore.record as any)?.company_id
      const compFilter = userCompanyId ? `company_id='${userCompanyId}'` : ''

      // 1. Companies
      try {
        const companies = await pb.collection('companies').getFullList<Company>({ sort: 'name' })
        await dbPutMany('companies', companies)
      } catch (err) {
        console.warn('Sync companies failed', err)
      }

      // 2. Clients (filtered strictly by company_id)
      try {
        const clients = await pb.collection('clients').getFullList<Client>({
          filter: compFilter || undefined,
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

      // 6. Checklist Template Items
      try {
        const templateItems = await pb
          .collection('checklist_template_items')
          .getFullList<ChecklistTemplateItem>({
            sort: 'order_num',
          })
        await dbPutMany('checklist_template_items', templateItems)
      } catch (err) {
        console.warn('Sync template items failed', err)
      }

      // 7. Checklists
      try {
        const checklists = await pb.collection('checklists').getFullList<Checklist>({
          filter: compFilter || undefined,
          sort: '-created',
          expand: 'template_id,client_id,equipment_id,material_id,user_id',
        })
        // Preserve local sync_status if pending
        const localChecklists = await dbGetAll<Checklist>('checklists')
        const pendingIds = new Set(
          localChecklists.filter((c) => c.sync_status === 'pending_sync').map((c) => c.id),
        )

        const checklistsToStore = checklists.map((c) => {
          if (pendingIds.has(c.id)) {
            return { ...c, sync_status: 'pending_sync' as const }
          }
          return { ...c, sync_status: 'synced' as const }
        })

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

      this.notify()
      return { success: true }
    } catch (err: any) {
      console.error('pullAllData error:', err)
      return { success: false, error: err.message || 'Erro ao sincronizar dados' }
    }
  }

  // Push pending queue items to PocketBase
  public async processSyncQueue(): Promise<{ total: number; processed: number; errors: number }> {
    if (this.isSyncing) return { total: 0, processed: 0, errors: 0 }
    if (!pb.authStore.isValid) return { total: 0, processed: 0, errors: 0 }

    this.isSyncing = true
    this.notify()

    let processed = 0
    let errors = 0
    // In-memory mapping of local IDs to real server IDs for this sync batch
    const idMap = new Map<string, string>()

    const isLocalId = (id?: string) => {
      if (!id) return true
      return (
        id.startsWith('queue_') ||
        id.startsWith('local_') ||
        id.startsWith('eq_') ||
        id.startsWith('mat_') ||
        id.startsWith('cli_') ||
        id.startsWith('tpl_') ||
        id.startsWith('item_')
      )
    }

    try {
      const queue = await dbGetAll<OfflineSyncQueueItem>('sync_queue')
      const sortedQueue = queue.sort((a, b) => a.timestamp - b.timestamp)

      for (const item of sortedQueue) {
        try {
          // Determine the target entity ID (using item.payload.id or item.id fallback)
          const targetLocalId = item.payload?.id || item.id

          if (item.action === 'create') {
            const {
              id: _ignoredId,
              local_id,
              expand,
              sync_status,
              ...payloadData
            } = item.payload || {}

            // If payload has checklist_id that was created locally, remap it to server ID
            if (payloadData.checklist_id && idMap.has(payloadData.checklist_id)) {
              payloadData.checklist_id = idMap.get(payloadData.checklist_id)
            }

            // Clean item_id relation if local or invalid
            if (payloadData.item_id && isLocalId(payloadData.item_id)) {
              delete payloadData.item_id
            }

            const res = await pb.collection(item.entity).create(payloadData)

            // Save mapping localId -> serverId
            if (targetLocalId) {
              idMap.set(targetLocalId, res.id)
            }
            if (item.id && item.id !== targetLocalId) {
              idMap.set(item.id, res.id)
            }

            // If it was a checklist, update references and responses with server id
            if (item.entity === 'checklists') {
              const localChk =
                (await dbGetById<Checklist>('checklists', targetLocalId)) ||
                (await dbGetById<Checklist>('checklists', item.id))
              if (localChk) {
                await dbDelete('checklists', localChk.id)
                await dbPut('checklists', { ...localChk, id: res.id, sync_status: 'synced' })
              }
              // Update responses pointing to this local checklist id
              const localResponses = await dbGetByIndex<ChecklistResponse>(
                'checklist_responses',
                'checklist_id',
                targetLocalId,
              )
              for (const r of localResponses) {
                await dbPut('checklist_responses', { ...r, checklist_id: res.id })
              }
            } else if (item.entity === 'checklist_responses') {
              await dbDelete('checklist_responses', targetLocalId)
              if (item.id !== targetLocalId) {
                await dbDelete('checklist_responses', item.id)
              }
              await dbPut('checklist_responses', { ...item.payload, id: res.id })
            }
          } else if (item.action === 'update') {
            const { id: _ignoredId, expand, sync_status, ...updatePayloadData } = item.payload || {}

            // Resolve real server ID: check idMap, targetLocalId, or item.id
            let serverId = idMap.get(targetLocalId) || idMap.get(item.id) || targetLocalId

            // If the ID is still a local ID (queue_, local_, etc.), it wasn't yet created on server
            if (isLocalId(serverId)) {
              // Create first (POST) then record mapping
              const res = await pb.collection(item.entity).create(updatePayloadData)
              serverId = res.id
              idMap.set(targetLocalId, res.id)
              if (item.id) idMap.set(item.id, res.id)

              if (item.entity === 'checklists') {
                const localChk =
                  (await dbGetById<Checklist>('checklists', targetLocalId)) ||
                  (await dbGetById<Checklist>('checklists', item.id))
                if (localChk) {
                  await dbDelete('checklists', localChk.id)
                  await dbPut('checklists', { ...localChk, id: res.id, sync_status: 'synced' })
                }
              }
            } else {
              // Real server ID is known, perform update (PATCH/PUT)
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
            if (!isLocalId(targetId)) {
              await pb.collection(item.entity).delete(targetId)
            }
          }

          // Remove successfully processed item from queue
          await dbDelete('sync_queue', item.id)
          processed++
        } catch (queueErr: any) {
          console.error(`Error processing queue item ${item.id}:`, queueErr)
          errors++
          // update attempts
          item.attempts = (item.attempts || 0) + 1
          item.error = queueErr.message
          await dbPut('sync_queue', item)
        }
      }
    } finally {
      this.isSyncing = false
      this.notify()
    }

    return { total: processed + errors, processed, errors }
  }

  // Save checklist locally and enqueue for sync
  public async saveChecklistLocally(
    checklist: Partial<Checklist>,
    responses: Partial<ChecklistResponse>[],
    isOnline: boolean,
  ): Promise<{ checklist: Checklist; responses: ChecklistResponse[] }> {
    const isNew = !checklist.id || checklist.id.startsWith('local_')
    const checklistId =
      checklist.id || `local_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`

    const userCompanyId = checklist.company_id || (pb.authStore.record as any)?.company_id || ''

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
      status: checklist.status || 'Em Andamento',
      risk_level: checklist.risk_level || 'Médio',
      notes: checklist.notes || '',
      inspector_name: checklist.inspector_name || (pb.authStore.record as any)?.name || 'Inspetor',
      signature_data: checklist.signature_data,
      sync_status: isOnline ? 'synced' : 'pending_sync',
      created: checklist.created || new Date().toISOString(),
      updated: new Date().toISOString(),
      expand: checklist.expand,
    }

    // Save checklist to local IndexedDB
    await dbPut('checklists', fullChecklist)

    // Save responses to local IndexedDB
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

    if (isOnline) {
      try {
        // Attempt direct PocketBase upload
        let serverChkId = checklistId
        if (isNew) {
          const { id: _ignoredId, expand, sync_status, ...createPayload } = fullChecklist
          const createdChk = await pb.collection('checklists').create(createPayload)
          serverChkId = createdChk.id
          fullChecklist.id = createdChk.id
          fullChecklist.sync_status = 'synced'
          await dbDelete('checklists', checklistId)
          await dbPut('checklists', fullChecklist)
        } else {
          const { id: _ignoredId, expand, sync_status, ...updatePayload } = fullChecklist
          await pb.collection('checklists').update(checklistId, updatePayload)
        }

        // Save responses online
        for (let i = 0; i < savedResponses.length; i++) {
          const resp = savedResponses[i]
          const isRespNew = !resp.id || resp.id.startsWith('local_')
          const respPayload: Record<string, any> = {
            checklist_id: serverChkId,
            item_title: resp.item_title,
            item_section: resp.item_section,
            status: resp.status,
            observation: resp.observation,
            photo_url: resp.photo_url,
            value: resp.value,
            is_critical_fail: resp.is_critical_fail,
          }
          // PocketBase relation item_id: only send if it's a valid remote ID, not a local one
          if (
            resp.item_id &&
            !resp.item_id.startsWith('item_') &&
            !resp.item_id.startsWith('local_')
          ) {
            respPayload.item_id = resp.item_id
          }

          if (isRespNew) {
            const createdResp = await pb.collection('checklist_responses').create(respPayload)
            await dbDelete('checklist_responses', resp.id)
            savedResponses[i] = { ...resp, id: createdResp.id, checklist_id: serverChkId }
            await dbPut('checklist_responses', savedResponses[i])
          } else {
            await pb.collection('checklist_responses').update(resp.id, respPayload)
          }
        }
      } catch (uploadErr) {
        console.warn('Online sync failed during save, enqueuing for offline retry', uploadErr)
        fullChecklist.sync_status = 'pending_sync'
        await dbPut('checklists', fullChecklist)
        await this.enqueueSync('checklists', isNew ? 'create' : 'update', fullChecklist)
        for (const r of savedResponses) {
          await this.enqueueSync('checklist_responses', 'create', r)
        }
      }
    } else {
      // Offline mode: Enqueue all actions
      fullChecklist.sync_status = 'pending_sync'
      await dbPut('checklists', fullChecklist)
      await this.enqueueSync('checklists', isNew ? 'create' : 'update', fullChecklist)
      for (const r of savedResponses) {
        await this.enqueueSync('checklist_responses', 'create', r)
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
