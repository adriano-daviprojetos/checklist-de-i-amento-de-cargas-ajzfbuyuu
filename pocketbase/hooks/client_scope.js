/// <reference path="../pb_data/types.d.ts" />

/**
 * Client Scope Hook
 * For authenticated users with role 'cliente':
 * 1. Filter checklists, equipment, materials, clients by the user's linked client_id
 * 2. Block create, update, delete operations on these collections and other system modules
 */

// 1. Intercept Record List Requests for 'cliente' role
onRecordListRequest(
  (e) => {
    if (e.auth && e.auth.get('role') === 'cliente') {
      const clientId = e.auth.get('client_id')
      if (!clientId) {
        // If client user has no client_id assigned, prevent access
        e.error = new ForbiddenError('Perfil cliente sem cliente/obra vinculado.')
        return
      }

      const collectionName = e.collection.name

      // Checklists: filter by client_id
      if (collectionName === 'checklists') {
        const clientFilter = `client_id = '${clientId}'`
        if (e.filter) {
          e.filter = `(${e.filter}) && (${clientFilter})`
        } else {
          e.filter = clientFilter
        }
      }

      // Clients: allow listing only their own client record
      if (collectionName === 'clients') {
        const clientFilter = `id = '${clientId}'`
        if (e.filter) {
          e.filter = `(${e.filter}) && (${clientFilter})`
        } else {
          e.filter = clientFilter
        }
      }
    }

    e.next()
  },
  'checklists',
  'clients',
)

// 2. Intercept Record View Requests for 'cliente' role
onRecordViewRequest(
  (e) => {
    if (e.auth && e.auth.get('role') === 'cliente') {
      const clientId = e.auth.get('client_id')
      if (!clientId) {
        throw new ForbiddenError('Perfil cliente sem cliente/obra vinculado.')
      }

      const collectionName = e.collection.name

      if (collectionName === 'checklists') {
        const recordClientId = e.record.get('client_id')
        if (recordClientId !== clientId) {
          throw new ForbiddenError('Acesso não autorizado a este checklist.')
        }
      }

      if (collectionName === 'clients') {
        if (e.record.id !== clientId) {
          throw new ForbiddenError('Acesso não autorizado a este cliente.')
        }
      }
    }

    e.next()
  },
  'checklists',
  'clients',
)

// 3. Block Create, Update, Delete for 'cliente' role
onRecordCreateRequest(
  (e) => {
    if (e.auth && e.auth.get('role') === 'cliente') {
      throw new ForbiddenError('Usuários com perfil cliente possuem acesso apenas de leitura.')
    }
    e.next()
  },
  'checklists',
  'checklist_responses',
  'checklist_templates',
  'checklist_template_items',
  'checklist_item_groups',
  'equipment',
  'materials',
  'clients',
  'companies',
  'users',
)

onRecordUpdateRequest(
  (e) => {
    if (e.auth && e.auth.get('role') === 'cliente') {
      // Allow updating own user profile (except role/company_id/client_id) if on users collection
      if (e.collection.name === 'users' && e.record.id === e.auth.id) {
        // Prevent changing own role, company_id or client_id
        if (e.record.get('role') !== 'cliente') {
          throw new ForbiddenError('Não é permitido alterar seu próprio perfil de acesso.')
        }
        if (e.record.get('client_id') !== e.auth.get('client_id')) {
          throw new ForbiddenError('Não é permitido alterar o cliente vinculado.')
        }
        e.next()
        return
      }

      throw new ForbiddenError('Usuários com perfil cliente possuem acesso apenas de leitura.')
    }
    e.next()
  },
  'checklists',
  'checklist_responses',
  'checklist_templates',
  'checklist_template_items',
  'checklist_item_groups',
  'equipment',
  'materials',
  'clients',
  'companies',
  'users',
)

onRecordDeleteRequest(
  (e) => {
    if (e.auth && e.auth.get('role') === 'cliente') {
      throw new ForbiddenError('Usuários com perfil cliente não possuem permissão de exclusão.')
    }
    e.next()
  },
  'checklists',
  'checklist_responses',
  'checklist_templates',
  'checklist_template_items',
  'checklist_item_groups',
  'equipment',
  'materials',
  'clients',
  'companies',
  'users',
)
