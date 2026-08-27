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
