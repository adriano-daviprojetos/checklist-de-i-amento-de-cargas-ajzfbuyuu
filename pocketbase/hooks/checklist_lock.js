/**
 * Checklist Permission & Immutability Hook
 *
 * Regra de Negócio:
 * A edição direta de campos do cabeçalho do checklist (status, dados da operação, etc.)
 * NÃO pode ser permitida para usuários com perfil Operador, Rigger, Sinaleiro, Supervisor ou Gestor
 * após o checklist ter sido concluído e assinado (status 'Concluído' ou 'Reprovado').
 *
 * Apenas usuários com perfil Administrador (Admin/Superadmin) podem alterar o checklist após finalização.
 *
 * IMPORTANTE: Respostas filhas (checklist_responses) e sincronizações de respostas
 * NÃO são bloqueadas por esta trava, garantindo que itens preenchidos offline
 * sejam sempre persistidos com integridade, independentemente da ordem de finalização.
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
      const isOriginalFinalized =
        s === 'concluído' ||
        s === 'concluido' ||
        s === 'completed' ||
        s === 'concluded' ||
        s === 'reprovado' ||
        s === 'rejected' ||
        s === 'finalizado'

      // Se o checklist no banco JÁ estava finalizado:
      if (isOriginalFinalized) {
        const authUserId = e.auth.id
        const recordUserId =
          (originalRec ? originalRec.get('user_id') : e.record.get('user_id')) || ''
        const authUserName = (e.auth.get('name') || '').toLowerCase().trim()
        const inspectorName = String(
          (originalRec ? originalRec.get('inspector_name') : e.record.get('inspector_name')) || '',
        )
          .toLowerCase()
          .trim()
        const filledByName = String(
          (originalRec ? originalRec.get('filled_by_name') : e.record.get('filled_by_name')) || '',
        )
          .toLowerCase()
          .trim()

        const isAuthor =
          (authUserId && recordUserId && authUserId === recordUserId) ||
          (authUserName && inspectorName && authUserName === inspectorName) ||
          (authUserName && filledByName && authUserName === filledByName)

        // Se NÃO for o próprio autor, bloqueia a edição de checklist alheio já finalizado
        if (!isAuthor) {
          throw new ForbiddenError(
            'Checklists finalizados e assinados não podem ser alterados por Operador, Rigger, Sinaleiro, Supervisor ou Gestor. Apenas Administradores possuem permissão de edição.',
          )
        }

        // Se for o próprio autor sincronizando (ex.: retry de sync de assinatura, preenchimento, status final):
        // Permitir a sincronização legítima de conclusão/atualização do seu próprio checklist.
      }
    }
  }

  e.next()
}, 'checklists')
