/// <reference path="../pb_data/types.d.ts" />

onRecordAuthRequest((e) => {
  const identity = e.identity || ''
  if (!identity.includes('@')) {
    const cleaned = identity.replace(/[^0-9]/g, '')
    let user = null

    // 1. Tenta buscar pelo CPF exato como digitado pelo usuário
    if (identity.trim().length > 0) {
      try {
        const users = $app.findRecordsByFilter('users', `cpf = '${identity.trim()}'`, '', 1, 0)
        if (users && users.length > 0) {
          user = users[0]
        }
      } catch (_) {}
    }

    // 2. Se não encontrou e o limpo é diferente, tenta buscar pelo CPF limpo (apenas dígitos)
    if (!user && cleaned.length > 0) {
      try {
        const users = $app.findRecordsByFilter('users', `cpf = '${cleaned}'`, '', 1, 0)
        if (users && users.length > 0) {
          user = users[0]
        }
      } catch (_) {}
    }

    if (user && user.get('email')) {
      e.identity = user.get('email')
    }
  }

  // Always let PocketBase process normally
  e.next()
}, 'users')
