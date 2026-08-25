migrate(
  (app) => {
    // 1. Backfill any empty username or cpf in existing users so setting required: true succeeds without validation issues.
    // Ensure all users have a valid unique username
    try {
      app
        .db()
        .newQuery(
          "UPDATE users SET username = 'gestor.geb' WHERE id = '3f6t73papahq1ku' AND (username IS NULL OR username = '')",
        )
        .execute()
      app
        .db()
        .newQuery(
          "UPDATE users SET username = 'supervisor.geb' WHERE id = 'y7fxkppgq1ld7pn' AND (username IS NULL OR username = '')",
        )
        .execute()
      app
        .db()
        .newQuery(
          "UPDATE users SET username = 'rigger.geb' WHERE id = 'tisjwcp08hjyee8' AND (username IS NULL OR username = '')",
        )
        .execute()
      app
        .db()
        .newQuery(
          "UPDATE users SET username = 'operador.geb' WHERE id = 'z5j4bpfn109lsf4' AND (username IS NULL OR username = '')",
        )
        .execute()
      app
        .db()
        .newQuery(
          "UPDATE users SET username = 'sinaleiro.geb' WHERE id = 'iiq0kc2u4bpbrlm' AND (username IS NULL OR username = '')",
        )
        .execute()
      app
        .db()
        .newQuery(
          "UPDATE users SET username = 'kevin.davi' WHERE id = 'zqjdyjf18oavpfs' AND (username IS NULL OR username = '')",
        )
        .execute()
      app
        .db()
        .newQuery(
          "UPDATE users SET username = 'luis.davi' WHERE id = 'rtof23wp5khiclb' AND (username IS NULL OR username = '')",
        )
        .execute()
      app
        .db()
        .newQuery(
          "UPDATE users SET username = 'adriano.ferrari' WHERE id = '6v8x90kpbtip6e6' AND (username IS NULL OR username = '')",
        )
        .execute()
      // Generic fallback for any other record with empty username
      app
        .db()
        .newQuery(
          "UPDATE users SET username = 'user_' || substr(id, 1, 8) WHERE username IS NULL OR username = ''",
        )
        .execute()

      // Ensure all users have a valid non-empty CPF
      app
        .db()
        .newQuery(
          "UPDATE users SET cpf = '135.365.528-90' WHERE id = 'b4h3klincpotnxk' AND (cpf IS NULL OR cpf = '')",
        )
        .execute()
      app
        .db()
        .newQuery(
          "UPDATE users SET cpf = '123.456.789-01' WHERE id = 'jmss0jdfrm0ifn8' AND (cpf IS NULL OR cpf = '')",
        )
        .execute()
      // Generic fallback for any other record with empty cpf
      app
        .db()
        .newQuery(
          "UPDATE users SET cpf = '000.000.000-' || substr(id, 1, 2) WHERE cpf IS NULL OR cpf = ''",
        )
        .execute()
    } catch (_) {}

    // 2. Modify _pb_users_auth_ fields
    const users = app.findCollectionByNameOrId('_pb_users_auth_')

    const emailField = users.fields.getByName('email')
    if (emailField) {
      emailField.required = false
    }

    const usernameField = users.fields.getByName('username')
    if (usernameField) {
      usernameField.required = true
    }

    const cpfField = users.fields.getByName('cpf')
    if (cpfField) {
      cpfField.required = true
    }

    app.save(users)
  },
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')

    const emailField = users.fields.getByName('email')
    if (emailField) {
      emailField.required = true
    }

    const usernameField = users.fields.getByName('username')
    if (usernameField) {
      usernameField.required = false
    }

    const cpfField = users.fields.getByName('cpf')
    if (cpfField) {
      cpfField.required = false
    }

    app.save(users)
  },
)
