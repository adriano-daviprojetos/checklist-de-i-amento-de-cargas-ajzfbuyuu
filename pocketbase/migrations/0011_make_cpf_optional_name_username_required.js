migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')

    // 1. Ensure CPF is optional
    const cpfField = users.fields.getByName('cpf')
    if (cpfField) {
      cpfField.required = false
    }

    // 2. Ensure Name and Username are required
    const nameField = users.fields.getByName('name')
    if (nameField) {
      nameField.required = true
    }

    const usernameField = users.fields.getByName('username')
    if (usernameField) {
      usernameField.required = true
    }

    // 3. Keep passwordAuth.identityFields = ['email', 'username', 'cpf']
    users.passwordAuth.identityFields = ['email', 'username', 'cpf']

    app.save(users)
  },
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')

    const cpfField = users.fields.getByName('cpf')
    if (cpfField) {
      cpfField.required = true
    }

    const nameField = users.fields.getByName('name')
    if (nameField) {
      nameField.required = false
    }

    const usernameField = users.fields.getByName('username')
    if (usernameField) {
      usernameField.required = true
    }

    users.passwordAuth.identityFields = ['email', 'username', 'cpf']

    app.save(users)
  },
)
