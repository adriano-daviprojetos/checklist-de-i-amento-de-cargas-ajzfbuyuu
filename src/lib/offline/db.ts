// Native IndexedDB wrapper for full Offline-First persistence
const DB_NAME = 'RiggingChecklistDB'
const DB_VERSION = 2

export interface DBStoreSchema {
  companies: string // key: id
  clients: string
  equipment: string
  materials: string
  checklist_templates: string
  checklist_item_groups: string
  checklist_template_items: string
  checklists: string
  checklist_responses: string
  users: string
  sync_logs: string
  sync_queue: string // key: id
}

let dbInstance: IDBDatabase | null = null

export async function getDB(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 3)

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result

      const createStore = (
        name: string,
        keyPath = 'id',
        indexes: { name: string; keyPath: string; unique?: boolean }[] = [],
      ) => {
        if (!db.objectStoreNames.contains(name)) {
          const store = db.createObjectStore(name, { keyPath })
          indexes.forEach((idx) =>
            store.createIndex(idx.name, idx.keyPath, { unique: idx.unique || false }),
          )
        }
      }

      createStore('companies', 'id')
      createStore('clients', 'id', [{ name: 'company_id', keyPath: 'company_id' }])
      createStore('equipment', 'id', [{ name: 'company_id', keyPath: 'company_id' }])
      createStore('materials', 'id', [{ name: 'company_id', keyPath: 'company_id' }])
      createStore('checklist_templates', 'id', [{ name: 'company_id', keyPath: 'company_id' }])
      createStore('checklist_item_groups', 'id', [
        { name: 'template', keyPath: 'template' },
        { name: 'company', keyPath: 'company' },
      ])
      createStore('checklist_template_items', 'id', [
        { name: 'template_id', keyPath: 'template_id' },
        { name: 'group', keyPath: 'group' },
      ])
      createStore('checklists', 'id', [
        { name: 'company_id', keyPath: 'company_id' },
        { name: 'status', keyPath: 'status' },
        { name: 'sync_status', keyPath: 'sync_status' },
      ])
      createStore('checklist_responses', 'id', [{ name: 'checklist_id', keyPath: 'checklist_id' }])
      createStore('users', 'id', [{ name: 'company_id', keyPath: 'company_id' }])
      createStore('sync_logs', 'id', [{ name: 'timestamp', keyPath: 'timestamp' }])
      createStore('sync_queue', 'id', [{ name: 'timestamp', keyPath: 'timestamp' }])
    }

    request.onsuccess = () => {
      dbInstance = request.result
      resolve(dbInstance)
    }

    request.onerror = () => {
      reject(request.error)
    }
  })
}

// Generic CRUD operations
export async function dbGetAll<T>(storeName: string): Promise<T[]> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)
    const req = store.getAll()
    req.onsuccess = () => resolve(req.result || [])
    req.onerror = () => reject(req.error)
  })
}

export async function dbGetById<T>(storeName: string, id: string): Promise<T | null> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)
    const req = store.get(id)
    req.onsuccess = () => resolve(req.result || null)
    req.onerror = () => reject(req.error)
  })
}

export async function dbPut<T extends { id: string }>(storeName: string, item: T): Promise<T> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    const store = tx.objectStore(storeName)
    const req = store.put(item)
    req.onsuccess = () => resolve(item)
    req.onerror = () => reject(req.error)
  })
}

export async function dbPutMany<T extends { id: string }>(
  storeName: string,
  items: T[],
): Promise<void> {
  if (!items || items.length === 0) return
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    const store = tx.objectStore(storeName)
    for (const it of items) {
      store.put(it)
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function dbDelete(storeName: string, id: string): Promise<void> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    const store = tx.objectStore(storeName)
    const req = store.delete(id)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

export async function dbClearStore(storeName: string): Promise<void> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    const store = tx.objectStore(storeName)
    const req = store.clear()
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

export async function dbGetByIndex<T>(
  storeName: string,
  indexName: string,
  key: any,
): Promise<T[]> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)
    const index = store.index(indexName)
    const req = index.getAll(key)
    req.onsuccess = () => resolve(req.result || [])
    req.onerror = () => reject(req.error)
  })
}
