/// <reference path="../pb_data/types.d.ts" />

/**
 * Batch Endpoint: Save Checklist Responses in a single atomic transaction
 * POST /api/batch/save-checklist-responses
 * Payload: {
 *   checklist_id: string,
 *   responses: Array<{
 *     item_id?: string,
 *     item_title?: string,
 *     item_section?: string,
 *     status: string,
 *     observation?: string,
 *     photo_url?: string,
 *     value?: string,
 *     is_critical_fail?: boolean
 *   }>
 * }
 */
routerAdd(
  'POST',
  '/api/batch/save-checklist-responses',
  (e) => {
    let body = {}
    try {
      const rawData = $apis.requestInfo(e).data
      body = typeof rawData === 'object' && rawData !== null ? rawData : {}
    } catch (_) {
      body = {}
    }

    const checklistId = body.checklist_id
    if (!checklistId || typeof checklistId !== 'string') {
      return e.json(400, { error: 'checklist_id é obrigatório' })
    }

    const responses = Array.isArray(body.responses) ? body.responses : []

    // 1. Verify checklist exists and user has permission
    let chk
    try {
      chk = $app.findRecordById('checklists', checklistId)
    } catch (_) {
      return e.json(404, { error: 'Checklist não encontrado' })
    }

    // Role check: if client, forbid write
    if (e.auth) {
      const userRole = (e.auth.get('role') || 'operador').toLowerCase().trim()
      if (userRole === 'cliente') {
        return e.json(403, {
          error: 'Usuários com perfil cliente possuem acesso apenas de leitura',
        })
      }

      // If finalized, only admin / superadmin can update
      const restrictedRoles = ['operador', 'rigger', 'sinaleiro', 'supervisor', 'gestor']
      if (restrictedRoles.includes(userRole)) {
        const s = String(chk.get('status') || '')
          .toLowerCase()
          .trim()
        const isFinalized =
          s === 'concluído' ||
          s === 'concluido' ||
          s === 'completed' ||
          s === 'concluded' ||
          s === 'reprovado' ||
          s === 'rejected' ||
          s === 'finalizado'

        if (isFinalized) {
          return e.json(403, {
            error: 'Não é permitido alterar respostas de um checklist já finalizado e assinado.',
          })
        }
      }
    }

    try {
      const responsesCollection = $app.findCollectionByNameOrId('checklist_responses')
      const createdRecords = []

      // Run deletion and recreation atomically inside a transaction
      $app.runInTransaction((txApp) => {
        // Delete all existing responses for this checklist
        const existingRecords = txApp.findRecordsByFilter(
          'checklist_responses',
          `checklist_id = '${checklistId}'`,
          '',
          0,
          0,
        )

        for (let i = 0; i < existingRecords.length; i++) {
          txApp.delete(existingRecords[i])
        }

        // Insert new responses
        for (let i = 0; i < responses.length; i++) {
          const r = responses[i]
          if (!r) continue

          const record = new Record(responsesCollection)
          record.set('checklist_id', checklistId)

          // Only set item_id if valid remote ID (not empty, not starting with local prefixes)
          const itemId = r.item_id || ''
          if (
            itemId &&
            !itemId.startsWith('item_') &&
            !itemId.startsWith('local_') &&
            !itemId.startsWith('temp_')
          ) {
            try {
              // Verify item exists to prevent relation foreign key failure
              const itemRec = txApp.findRecordById('checklist_template_items', itemId)
              if (itemRec) {
                record.set('item_id', itemId)
              }
            } catch (_) {
              // If item doesn't exist on server, omit item_id relation
            }
          }

          record.set('item_title', r.item_title || '')
          record.set('item_section', r.item_section || '')
          record.set('status', r.status || 'PENDENTE')
          record.set('observation', r.observation || '')
          record.set('photo_url', r.photo_url || '')
          record.set('value', r.value || '')
          record.set('is_critical_fail', Boolean(r.is_critical_fail))

          txApp.save(record)
          createdRecords.push(record)
        }
      })

      return e.json(200, {
        success: true,
        count: createdRecords.length,
        items: createdRecords,
      })
    } catch (err) {
      console.error('Error saving batch checklist responses:', err)
      return e.json(500, { error: 'Erro ao salvar respostas em lote: ' + (err ? err.message : '') })
    }
  },
  $apis.requireAuth(),
)
