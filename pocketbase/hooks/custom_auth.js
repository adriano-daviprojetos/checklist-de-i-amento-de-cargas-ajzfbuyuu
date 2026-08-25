/// <reference path="../pb_data/types.d.ts" />

routerAdd('POST', '/api/custom-auth', (c) => {
  let body = {}
  try {
    const info = c.requestInfo()
    body = info.body || {}
  } catch (err) {
    console.log('[custom-auth] Erro ao obter body da requisição:', String(err))
    return c.json(400, { message: 'Requisição inválida.' })
  }

  const identity = (body.identity || '').trim()
  const password = body.password || ''

  if (!identity || !password) {
    console.log('[custom-auth] Identificador ou senha em branco')
    return c.json(400, { message: 'Identificador e senha são obrigatórios.' })
  }

  console.log('[custom-auth] Iniciando autenticação para identity:', identity)

  let email = identity

  // 1. Se identity não contém @ (não é email)
  if (!identity.includes('@')) {
    let userRecord = null

    // Busca 1: por username exato
    try {
      userRecord = $app.findFirstRecordByFilter('users', 'username = {:username}', {
        username: identity,
      })
      console.log(
        '[custom-auth] Busca 1 (username):',
        userRecord ? 'encontrado: ' + userRecord.get('id') : 'não encontrado',
      )
    } catch (err) {
      console.log('[custom-auth] Busca 1 (username) não encontrou:', String(err))
    }

    // Busca 2: por CPF exato como digitado
    if (!userRecord) {
      try {
        userRecord = $app.findFirstRecordByFilter('users', 'cpf = {:cpf}', {
          cpf: identity,
        })
        console.log(
          '[custom-auth] Busca 2 (cpf exato):',
          userRecord ? 'encontrado: ' + userRecord.get('id') : 'não encontrado',
        )
      } catch (err) {
        console.log('[custom-auth] Busca 2 (cpf exato) não encontrou:', String(err))
      }
    }

    // Busca 3: por CPF somente dígitos (se tiver >= 10 dígitos e for diferente)
    if (!userRecord) {
      const digitsOnly = identity
        .split('')
        .filter((char) => char >= '0' && char <= '9')
        .join('')

      if (digitsOnly.length >= 10 && digitsOnly !== identity) {
        try {
          userRecord = $app.findFirstRecordByFilter('users', 'cpf = {:cpf}', {
            cpf: digitsOnly,
          })
          console.log(
            '[custom-auth] Busca 3 (cpf apenas dígitos):',
            userRecord ? 'encontrado: ' + userRecord.get('id') : 'não encontrado',
          )
        } catch (err) {
          console.log('[custom-auth] Busca 3 (cpf apenas dígitos) não encontrou:', String(err))
        }
      }
    }

    if (!userRecord) {
      console.log('[custom-auth] Usuário não encontrado para identity:', identity)
      return c.json(400, { message: 'Usuário não encontrado.' })
    }

    email = userRecord.get('email')
    console.log('[custom-auth] Email correspondente encontrado:', email)

    if (!email) {
      console.log('[custom-auth] Registro localizado porém sem e-mail cadastrado')
      return c.json(400, { message: 'Usuário sem e-mail vinculado.' })
    }
  }

  // 2. Autentica usando PocketBase internamente
  let authRecord = null
  try {
    authRecord = $app.findAuthRecordByEmail('users', email)
    console.log(
      '[custom-auth] Registro de auth encontrado para:',
      email,
      'ID:',
      authRecord ? authRecord.get('id') : 'null',
    )
  } catch (err) {
    console.log('[custom-auth] Erro ao buscar authRecord por email:', String(err))
    return c.json(400, { message: 'Usuário não encontrado.' })
  }

  if (!authRecord) {
    console.log('[custom-auth] authRecord é nulo')
    return c.json(400, { message: 'Usuário não encontrado.' })
  }

  const isValidPassword = authRecord.validatePassword(password)
  console.log('[custom-auth] Validação de senha:', isValidPassword ? 'VÁLIDA' : 'INVÁLIDA')

  if (!isValidPassword) {
    return c.json(400, { message: 'Credenciais inválidas.' })
  }

  // 3. Gera token e retorna
  try {
    const token = $tokens.recordAuth(authRecord)
    console.log('[custom-auth] Autenticação bem-sucedida para:', email)
    return c.json(200, {
      token: token,
      record: authRecord,
    })
  } catch (err) {
    console.log('[custom-auth] Erro ao gerar token:', String(err))
    return c.json(500, { message: 'Erro interno ao gerar autenticação.' })
  }
})
