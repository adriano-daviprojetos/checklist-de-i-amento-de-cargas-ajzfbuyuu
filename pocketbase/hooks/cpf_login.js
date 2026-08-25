// Hook to allow universal login by username or CPF in addition to email.
// When identity does not contain '@', searches for the matching user record:
// 1. Exact username match
// 2. Exact CPF match (as typed, e.g. "135.365.528-89")
// 3. Exact CPF match using digits only (e.g. "13536552889")
// If found, replaces e.identity with the record's email before authentication.

onRecordAuthRequest('users', (e) => {
  const identity = (e.identity || '').trim()

  if (identity && !identity.includes('@')) {
    console.log('[username_login] Tentando login por username ou CPF:', identity)

    let userRecord = null

    // 1. Busca por username exato
    try {
      userRecord = $app.findFirstRecordByFilter('users', 'username = {:username}', {
        username: identity,
      })
      console.log(
        '[username_login] Busca 1 (username exato):',
        userRecord ? 'encontrado' : 'não encontrado',
      )
    } catch (err) {
      console.log('[username_login] Erro na busca 1 (username):', String(err))
    }

    // 2. Se não encontrou por username, busca por CPF exato como digitado
    if (!userRecord) {
      try {
        userRecord = $app.findFirstRecordByFilter('users', 'cpf = {:cpf}', { cpf: identity })
        console.log(
          '[username_login] Busca 2 (cpf exato):',
          userRecord ? 'encontrado' : 'não encontrado',
        )
      } catch (err) {
        console.log('[username_login] Erro na busca 2 (cpf exato):', String(err))
      }
    }

    // 3. Se ainda não encontrou, tenta buscar por CPF somente com dígitos
    if (!userRecord) {
      const digitsOnly = identity.replace(/\D/g, '')
      if (digitsOnly.length >= 10 && digitsOnly !== identity) {
        try {
          userRecord = $app.findFirstRecordByFilter('users', 'cpf = {:cpf}', { cpf: digitsOnly })
          console.log(
            '[username_login] Busca 3 (cpf apenas dígitos):',
            userRecord ? 'encontrado' : 'não encontrado',
          )
        } catch (err) {
          console.log('[username_login] Erro na busca 3 (cpf dígitos):', String(err))
        }
      }
    }

    if (userRecord) {
      const email = userRecord.get('email')
      if (email) {
        console.log(
          '[username_login] Usuário localizado com sucesso, substituindo identity por email:',
          email,
        )
        e.identity = email
      } else {
        console.log('[username_login] Registro encontrado mas sem email cadastrado')
      }
    } else {
      console.log('[username_login] Usuário/CPF não encontrado na base')
    }
  }

  e.next()
})
