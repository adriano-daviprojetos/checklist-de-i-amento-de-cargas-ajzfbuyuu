/// <reference path="../pb_data/types.d.ts" />

onRecordAuthRequest((e) => {
  const identity = (e.identity || '').trim()

  if (identity && !identity.includes('@')) {
    let email = ''

    // 1. Tenta buscar pelo CPF exato como digitado
    const query1 = $app
      .dao()
      .db()
      .newQuery('SELECT email FROM users WHERE cpf = {:cpf} LIMIT 1')
      .bind({ cpf: identity })

    const row1 = {}
    const err1 = query1.one(row1)
    if (!err1 && row1.email) {
      email = row1.email
    }

    // 2. Se não encontrar e o CPF tiver caracteres não-dígitos, tenta apenas com dígitos
    if (!email) {
      const digitsOnly = identity.replace(/[^0-9]/g, '')
      if (digitsOnly && digitsOnly !== identity) {
        const query2 = $app
          .dao()
          .db()
          .newQuery(
            "SELECT email FROM users WHERE REPLACE(REPLACE(cpf, '.', ''), '-', '') = {:cpf} LIMIT 1",
          )
          .bind({ cpf: digitsOnly })

        const row2 = {}
        const err2 = query2.one(row2)
        if (!err2 && row2.email) {
          email = row2.email
        }
      }
    }

    if (email) {
      e.identity = email
    }
  }

  return e.next()
}, 'users')
