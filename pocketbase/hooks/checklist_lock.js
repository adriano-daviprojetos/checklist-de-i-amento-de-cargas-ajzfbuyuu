/**
 * Checklist Permission & Immutability Hook
 *
 * Regra de Negócio:
 * A edição de checklist NÃO pode ser permitida para usuários com perfil
 * Operador, Rigger, Sinaleiro, Supervisor ou Gestor após o checklist ter sido concluído e assinado
 * (status 'Concluído' ou 'Reprovado').
 *
 * Apenas usuários com perfil Administrador (Admin/Superadmin) podem editar um checklist já finalizado/assinado.
 */

// 1. Intercept Record Update on 'checklists'
onRecordUpdateRequest((e) => {
  if (e.auth) {
    const userRole = (e.auth.get('role') || 'operador').toLowerCase().trim()
    const restrictedRoles = ['operador', 'rigger', 'sinaleiro', 'supervisor', 'gestor']

    if (restrictedRoles.includes(userRole)) {
      const originalRec = e.record.original()
      const originalStatus =
        (originalRec ? originalRec.get('status') : e.record.get('status')) || ''
      const s = String(originalStatus).toLowerCase().trim()
      const isFinalized =
        s === 'concluído' ||
        s === 'concluido' ||
        s === 'completed' ||
        s === 'concluded' ||
        s === 'reprovado' ||
        s === 'rejected' ||
        s === 'finalizado'

      if (isFinalized) {
        throw new ForbiddenError(
          'Checklists finalizados e assinados não podem ser alterados por Operador, Rigger, Sinaleiro, Supervisor ou Gestor. Apenas Administradores possuem permissão de edição.',
        )
      }
    }
  }

  e.next()
}, 'checklists')

// 2. Intercept Record Create on 'checklist_responses'
onRecordCreateRequest((e) => {
  if (e.auth) {
    const userRole = (e.auth.get('role') || 'operador').toLowerCase().trim()
    const restrictedRoles = ['operador', 'rigger', 'sinaleiro', 'supervisor', 'gestor']

    if (restrictedRoles.includes(userRole)) {
      const checklistId = e.record.get('checklist_id')
      if (checklistId) {
        try {
          const chk = $app.findRecordById('checklists', checklistId)
          if (chk) {
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
              throw new ForbiddenError(
                'Não é permitido adicionar respostas a um checklist já finalizado e assinado.',
              )
            }
          }
        } catch (err) {
          if (err instanceof ForbiddenError) throw err
        }
      }
    }
  }

  e.next()
}, 'checklist_responses')

// 3. Intercept Record Update on 'checklist_responses'
onRecordUpdateRequest((e) => {
  if (e.auth) {
    const userRole = (e.auth.get('role') || 'operador').toLowerCase().trim()
    const restrictedRoles = ['operador', 'rigger', 'sinaleiro', 'supervisor', 'gestor']

    if (restrictedRoles.includes(userRole)) {
      const checklistId = e.record.get('checklist_id')
      if (checklistId) {
        try {
          const chk = $app.findRecordById('checklists', checklistId)
          if (chk) {
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
              throw new ForbiddenError(
                'Não é permitido alterar respostas de um checklist já finalizado e assinado.',
              )
            }
          }
        } catch (err) {
          if (err instanceof ForbiddenError) throw err
        }
      }
    }
  }

  e.next()
}, 'checklist_responses')

// 4. Intercept Record Delete on 'checklist_responses'
onRecordDeleteRequest((e) => {
  if (e.auth) {
    const userRole = (e.auth.get('role') || 'operador').toLowerCase().trim()
    const restrictedRoles = ['operador', 'rigger', 'sinaleiro', 'supervisor', 'gestor']

    if (restrictedRoles.includes(userRole)) {
      const checklistId = e.record.get('checklist_id')
      if (checklistId) {
        try {
          const chk = $app.findRecordById('checklists', checklistId)
          if (chk) {
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
              throw new ForbiddenError(
                'Não é permitido excluir respostas de um checklist já finalizado e assinado.',
              )
            }
          }
        } catch (err) {
          if (err instanceof ForbiddenError) throw err
        }
      }
    }
  }

  e.next()
}, 'checklist_responses')
