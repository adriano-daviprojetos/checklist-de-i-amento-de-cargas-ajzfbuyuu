import { useEffect, useRef } from 'react'
import pb from '@/lib/pocketbase/client'
import { syncService } from '@/lib/offline/sync-service'
import { dbPut, dbDelete, dbGetById, dbGetAll, type DBStoreSchema } from '@/lib/offline/db'
import type { RecordSubscription } from 'pocketbase'

interface RealtimeSyncOptions {
  isOnline: boolean
  companyId?: string
  autoSyncQueueIntervalMs?: number // Default: 30 seconds
  pullIntervalMs?: number // Default: 120 seconds
}

// Map PocketBase collection names to local IndexedDB store names
type MonitoredStoreName = keyof Omit<DBStoreSchema, 'sync_queue'>

const COLLECTION_TO_STORE: Record<string, MonitoredStoreName> = {
  checklists: 'checklists',
  checklist_responses: 'checklist_responses',
  checklist_templates: 'checklist_templates',
  checklist_template_items: 'checklist_template_items',
  checklist_item_groups: 'checklist_item_groups',
  equipment: 'equipment',
  materials: 'materials',
  clients: 'clients',
  companies: 'companies',
  users: 'users',
}

const MONITORED_COLLECTIONS = Object.keys(COLLECTION_TO_STORE)

/**
 * useRealtimeSync Hook
 *
 * Responsibilities:
 * - Subscribes to PocketBase collections via SSE (Server-Sent Events) when online and authenticated.
 * - Updates local IndexedDB immediately when create/update/delete events arrive from remote clients.
 * - Notifies application subscribers so UI components react in real time.
 * - Automatically drains the offline sync queue every 30s when online.
 * - Periodically performs a full data pull (every 120s) as a safety fallback.
 */
export function useRealtimeSync({
  isOnline,
  companyId,
  autoSyncQueueIntervalMs = 30000,
  pullIntervalMs = 120000,
}: RealtimeSyncOptions) {
  const isOnlineRef = useRef(isOnline)
  isOnlineRef.current = isOnline

  const companyIdRef = useRef(companyId)
  companyIdRef.current = companyId

  // 1. Setup PocketBase SSE Real-time Subscriptions
  useEffect(() => {
    // Only subscribe if online and authenticated
    if (!isOnline || !pb.authStore.isValid) {
      return
    }

    let isCancelled = false
    const unsubscribers: Array<() => Promise<void>> = []

    const handleRecordEvent = async (collectionName: string, e: RecordSubscription<any>) => {
      const storeName = COLLECTION_TO_STORE[collectionName]
      if (!storeName) return

      try {
        const { action, record } = e
        if (!record || !record.id) return

        if (action === 'delete') {
          await dbDelete(storeName, record.id)
          syncService.notify()
        } else if (action === 'create' || action === 'update') {
          // If this is a checklist, make sure we preserve local pending status if currently syncing
          if (storeName === 'checklists') {
            const existing = await dbGetById<any>('checklists', record.id)
            if (existing && existing.sync_status === 'pending_sync') {
              // Local changes haven't synced yet, do not overwrite with stale remote state
              return
            }
          }

          // If this is a response, check if the parent checklist exists
          if (storeName === 'checklist_responses') {
            const existing = await dbGetById<any>('checklist_responses', record.id)
            if (existing && existing.sync_status === 'pending_sync') {
              return
            }
          }

          // Write updated record to IndexedDB
          await dbPut(storeName, { ...record, sync_status: 'synced' })
          syncService.notify()
        }
      } catch (err) {
        console.warn(`[RealtimeSync] Error processing event for ${collectionName}:`, err)
      }
    }

    // Subscribe to each monitored collection
    for (const colName of MONITORED_COLLECTIONS) {
      pb.collection(colName)
        .subscribe('*', (e) => {
          handleRecordEvent(colName, e)
        })
        .then((unsub) => {
          if (isCancelled) {
            unsub().catch(() => {})
          } else {
            unsubscribers.push(unsub)
          }
        })
        .catch((err) => {
          console.warn(`[RealtimeSync] Could not subscribe to collection '${colName}':`, err)
        })
    }

    // Cleanup when unmounting or when offline/auth changes
    return () => {
      isCancelled = true
      for (const unsub of unsubscribers) {
        unsub().catch(() => {})
      }
    }
  }, [isOnline])

  // 2. Automatic Sync Queue Processing Interval (every 30s when online)
  useEffect(() => {
    if (!isOnline) return

    const checkAndProcessQueue = async () => {
      if (!isOnlineRef.current || !pb.authStore.isValid) return
      try {
        const pendingCount = await syncService.getPendingQueueCount()
        if (pendingCount > 0) {
          await syncService.processSyncQueue()
        }
      } catch (err) {
        console.warn('[RealtimeSync] Error auto-processing sync queue:', err)
      }
    }

    // Trigger immediate check when coming online
    checkAndProcessQueue()

    const queueTimer = setInterval(checkAndProcessQueue, autoSyncQueueIntervalMs)

    return () => {
      clearInterval(queueTimer)
    }
  }, [isOnline, autoSyncQueueIntervalMs])

  // 3. Periodic Full Data Pull (every 120s when online as fallback)
  useEffect(() => {
    if (!isOnline) return

    const performPeriodicPull = async () => {
      if (!isOnlineRef.current || !pb.authStore.isValid) return
      try {
        await syncService.pullAllData(companyIdRef.current)
      } catch (err) {
        console.warn('[RealtimeSync] Periodic pull error:', err)
      }
    }

    const pullTimer = setInterval(performPeriodicPull, pullIntervalMs)

    return () => {
      clearInterval(pullTimer)
    }
  }, [isOnline, pullIntervalMs])
}

export default useRealtimeSync
