/**
 * Audit Log Hooks
 * 1. POST /api/audit/access-denied route
 * 2. onRecordAfterUpdateSuccess for 'users' (permission changes)
 * 3. onRecordAfterDeleteSuccess for users, companies, checklists, equipment, materials, clients, checklist_templates
 */

// 1. Endpoint for logging access denied attempts
routerAdd(
  'POST',
  '/api/audit/access-denied',
  (e) => {
    let body = {}
    try {
      const info = e.requestInfo()
      body = info && info.body ? info.body : {}
    } catch (_) {
      body = {}
    }

    const moduleName = body.module || ''
    const path = body.path || ''

    let userId = ''
    let userName = 'Usuário Não Autenticado'
    let companyId = ''

    if (e.auth) {
      userId = e.auth.id
      userName = e.auth.get('name') || e.auth.get('username') || e.auth.get('email') || 'Usuário'
      companyId = e.auth.get('company_id') || ''
    }

    const moduleDisplayMap = {
      checklists: 'Checklists de Inspeção',
      templates: 'Modelos de Inspeção',
      equipment: 'Equipamentos',
      materials: 'Materiais & Acessórios',
      clients: 'Clientes & Obras',
      users: 'Usuários & Perfis',
      company: 'Dados da Empresa',
      companies: 'Dados da Empresa',
      audit: 'Log de Auditoria',
    }

    const friendlyModuleName = moduleDisplayMap[moduleName] || moduleName || 'Geral'
    const details = `Tentativa de acesso negado ao módulo ${friendlyModuleName}${path ? ` (${path})` : ''}`

    try {
      const auditLogsCollection = $app.findCollectionByNameOrId('audit_logs')
      const record = new Record(auditLogsCollection)

      if (companyId) {
        record.set('company', companyId)
      }
      if (userId) {
        record.set('user', userId)
      }
      record.set('user_name', userName)
      record.set('action', 'access_denied')
      record.set('module', moduleName || 'access')
      record.set('details', details)
      record.set('metadata', {
        path: path,
        module: moduleName,
        timestamp: new Date().toISOString(),
      })

      $app.save(record)

      return e.json(200, { success: true, message: 'Access denied logged' })
    } catch (err) {
      console.error('Error recording access_denied audit log:', err)
      return e.json(500, { error: 'Failed to record audit log' })
    }
  },
  $apis.requireAuth(),
)

// 1.1 Endpoint for recording custom audit events (e.g. checklist_reopened)
routerAdd(
  'POST',
  '/api/audit/custom-event',
  (e) => {
    let body = {}
    try {
      const info = e.requestInfo()
      body = info && info.body ? info.body : {}
    } catch (_) {
      body = {}
    }

    const action = body.action || ''
    const moduleName = body.module || 'checklists'
    const details = body.details || ''
    const metadata = body.metadata || {}

    if (!action) {
      return e.json(400, { error: 'action é obrigatória' })
    }

    let userId = ''
    let userName = 'Usuário'
    let companyId = body.company || ''

    if (e.auth) {
      userId = e.auth.id
      userName = e.auth.get('name') || e.auth.get('username') || e.auth.get('email') || 'Usuário'
      if (!companyId) {
        companyId = e.auth.get('company_id') || ''
      }
    }

    try {
      const auditLogsCollection = $app.findCollectionByNameOrId('audit_logs')
      const record = new Record(auditLogsCollection)

      if (companyId) {
        record.set('company', companyId)
      }
      if (userId) {
        record.set('user', userId)
      }
      record.set('user_name', userName)
      record.set('action', action)
      record.set('module', moduleName)
      record.set('details', details)
      record.set('metadata', {
        ...metadata,
        timestamp: new Date().toISOString(),
      })

      $app.save(record)

      return e.json(200, { success: true, id: record.id })
    } catch (err) {
      console.error('Error recording custom audit log:', err)
      return e.json(500, { error: 'Failed to record audit log: ' + (err ? err.message : '') })
    }
  },
  $apis.requireAuth(),
)
// 2. Hook on checklists update to detect reopen events and log audit automatically
onRecordAfterUpdateSuccess((e) => {
  try {
    const originalRec = e.record.original()
    if (!originalRec) return

    const prevStatus = String(originalRec.get('status') || '')
      .toLowerCase()
      .trim()
    const newStatus = String(e.record.get('status') || '')
      .toLowerCase()
      .trim()

    const wasFinalized =
      prevStatus === 'concluído' ||
      prevStatus === 'concluido' ||
      prevStatus === 'completed' ||
      prevStatus === 'concluded' ||
      prevStatus === 'reprovado' ||
      prevStatus === 'rejected' ||
      prevStatus === 'finalizado'

    const isNowInProgress = newStatus === 'em andamento' || newStatus === 'pendente'

    // Se passou de finalizado para em andamento / pendente => evento de Reabertura
    if (wasFinalized && isNowInProgress) {
      const checklistCode = e.record.get('code') || e.record.id
      const checklistTitle = e.record.get('title') || 'Checklist'
      const companyId = e.record.get('company_id') || ''

      // Tentar obter dados do usuário que executou a ação
      let userId = ''
      let userName = 'Administrador'
      try {
        const info = e.requestInfo()
        if (info && info.auth) {
          userId = info.auth.id
          userName =
            info.auth.get('name') ||
            info.auth.get('username') ||
            info.auth.get('email') ||
            'Administrador'
        }
      } catch (_) {
        // Sem request info (execução direta ou transação)
      }

      const details = `Checklist ${checklistCode} ("${checklistTitle}") foi reaberto para edição pelo Admin`

      const auditLogsCollection = $app.findCollectionByNameOrId('audit_logs')
      const logRecord = new Record(auditLogsCollection)

      if (companyId) {
        logRecord.set('company', companyId)
      }
      if (userId) {
        logRecord.set('user', userId)
      }
      logRecord.set('user_name', userName)
      logRecord.set('action', 'checklist_reopened')
      logRecord.set('module', 'checklists')
      logRecord.set('details', details)
      logRecord.set('metadata', {
        checklist_id: e.record.id,
        checklist_code: checklistCode,
        checklist_title: checklistTitle,
        previous_status: originalRec.get('status'),
        new_status: e.record.get('status'),
        reopened_at: new Date().toISOString(),
      })

      $app.save(logRecord)
    }
  } catch (err) {
    console.error('Error logging checklist_reopened audit log:', err)
  }

  e.next()
}, 'checklists')

// 3. Hook on users update to detect permission changes
onRecordAfterUpdateSuccess((e) => {
  try {
    const originalPermissions = e.record.original().get('permissions')
    const newPermissions = e.record.get('permissions')

    const originalJson = JSON.stringify(originalPermissions || null)
    const newJson = JSON.stringify(newPermissions || null)

    if (originalJson !== newJson) {
      const targetUserName =
        e.record.get('name') || e.record.get('username') || e.record.get('email') || e.record.id
      const targetUserId = e.record.id
      const companyId = e.record.get('company_id') || ''

      const details = `Permissões do usuário "${targetUserName}" foram alteradas`

      const auditLogsCollection = $app.findCollectionByNameOrId('audit_logs')
      const logRecord = new Record(auditLogsCollection)

      if (companyId) {
        logRecord.set('company', companyId)
      }
      logRecord.set('user', targetUserId)
      logRecord.set('user_name', targetUserName)
      logRecord.set('action', 'permission_changed')
      logRecord.set('module', 'users')
      logRecord.set('details', details)
      logRecord.set('metadata', {
        target_user_id: targetUserId,
        target_user_name: targetUserName,
        previous_permissions: originalPermissions,
        new_permissions: newPermissions,
        updated_at: new Date().toISOString(),
      })

      $app.save(logRecord)
    }
  } catch (err) {
    console.error('Error logging permission_changed:', err)
  }

  e.next()
}, 'users')

// 4. Hooks on deletion for key collections
onRecordAfterDeleteSuccess(
  (e) => {
    try {
      const collectionName = e.record.collection().name
      let action = ''
      let moduleName = ''
      let resourceName = ''
      let companyId = e.record.get('company_id') || ''
      let userId = ''
      let userName = 'Sistema'

      switch (collectionName) {
        case 'users':
          action = 'user_deleted'
          moduleName = 'users'
          resourceName = e.record.get('name') || e.record.get('username') || e.record.id
          break
        case 'companies':
          action = 'company_deleted'
          moduleName = 'companies'
          resourceName = e.record.get('name') || e.record.get('trade_name') || e.record.id
          companyId = e.record.id
          break
        case 'checklists':
          action = 'checklist_deleted'
          moduleName = 'checklists'
          resourceName = e.record.get('title') || e.record.get('code') || e.record.id
          break
        case 'equipment':
          action = 'equipment_deleted'
          moduleName = 'equipment'
          resourceName =
            `${e.record.get('type') || 'Equipamento'} ${e.record.get('manufacturer') || ''} ${e.record.get('model') || ''}`.trim()
          break
        case 'materials':
          action = 'material_deleted'
          moduleName = 'materials'
          resourceName = `${e.record.get('type') || 'Material'} (Tag: ${e.record.get('tag') || e.record.id})`
          break
        case 'clients':
          action = 'client_deleted'
          moduleName = 'clients'
          resourceName = e.record.get('name') || e.record.get('trade_name') || e.record.id
          break
        case 'checklist_templates':
          action = 'template_deleted'
          moduleName = 'templates'
          resourceName = e.record.get('title') || e.record.id
          break
        default:
          action = `${collectionName}_deleted`
          moduleName = collectionName
          resourceName = e.record.id
          break
      }

      const details = `Registro excluído no módulo ${moduleName}: "${resourceName}" (ID: ${e.record.id})`

      const auditLogsCollection = $app.findCollectionByNameOrId('audit_logs')
      const logRecord = new Record(auditLogsCollection)

      if (companyId) {
        logRecord.set('company', companyId)
      }
      if (userId) {
        logRecord.set('user', userId)
      }
      logRecord.set('user_name', userName)
      logRecord.set('action', action)
      logRecord.set('module', moduleName)
      logRecord.set('details', details)
      logRecord.set('metadata', {
        deleted_record_id: e.record.id,
        collection: collectionName,
        resource_name: resourceName,
        deleted_at: new Date().toISOString(),
      })

      $app.save(logRecord)
    } catch (err) {
      console.error('Error logging deletion audit log:', err)
    }

    e.next()
  },
  'users',
  'companies',
  'checklists',
  'equipment',
  'materials',
  'clients',
  'checklist_templates',
)
