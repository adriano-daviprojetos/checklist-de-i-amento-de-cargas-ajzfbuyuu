/// <reference path="../pb_data/types.d.ts" />

onRecordAuthRequest((e) => {
  const identity = (e.identity || '').trim()

  // Só intercepta se não for e-mail (não contém @)
  if (identity && !identity.includes('@')) {
    console.log('[cpf_login] Tentando login por CPF:', identity)

    let userRecord = null

    // 1. Busca exata pelo CPF como digitado (ex: "135.365.528-89")
    try {
      userRecord = $app.dao().findFirstRecordByFilter('users', 'cpf = {:cpf}', { cpf: identity })
      console.log('[cpf_login] Busca 1 (cpf exato):', userRecord ? 'encontrado' : 'não encontrado')
    } catch (err) {
      console.log('[cpf_login] Erro na busca 1:', String(err))
    }

    // 2. Se não encontrou, tenta só com dígitos (ex: "13536552889")
    if (!userRecord) {
      const digitsOnly = identity.replace(/[^0-9]/g, '')
      if (digitsOnly && digitsOnly !== identity) {
        try {
          userRecord = $app
            .dao()
            .findFirstRecordByFilter('users', 'cpf = {:cpf}', { cpf: digitsOnly })
          console.log(
            '[cpf_login] Busca 2 (apenas dígitos):',
            userRecord ? 'encontrado' : 'não encontrado',
          )
        } catch (err) {
          console.log('[cpf_login] Erro na busca 2:', String(err))
        }
      }
    }

    // 3. Se encontrou o usuário, substitui identity pelo email
    if (userRecord) {
      const email = userRecord.get('email')
      console.log('[cpf_login] CPF encontrado, email:', email)
      if (email) {
        e.identity = email
      }
    } else {
      console.log('[cpf_login] CPF não encontrado na base')
    }
  }

  e.next()
}, 'users')
