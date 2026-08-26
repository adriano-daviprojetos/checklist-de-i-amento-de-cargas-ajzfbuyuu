migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    const clients = app.findCollectionByNameOrId('clients')

    // 1. Update role select field to include 'cliente'
    const roleField = users.fields.getByName('role')
    if (roleField) {
      const currentValues = roleField.values || []
      if (!currentValues.includes('cliente')) {
        roleField.values = [...currentValues, 'cliente']
      }
    }

    // 2. Add client_id relation field pointing to clients collection
    if (!users.fields.getByName('client_id')) {
      users.fields.add(
        new RelationField({
          name: 'client_id',
          collectionId: clients.id,
          maxSelect: 1,
          required: false,
        }),
      )
    }

    // 3. Add idx_users_client index
    users.addIndex('idx_users_client', false, 'client_id', '')

    app.save(users)
  },
  (app) => {
    try {
      const users = app.findCollectionByNameOrId('_pb_users_auth_')
      users.removeIndex('idx_users_client')

      const clientField = users.fields.getByName('client_id')
      if (clientField) {
        users.fields.remove(clientField)
      }

      const roleField = users.fields.getByName('role')
      if (roleField) {
        roleField.values = (roleField.values || []).filter((v) => v !== 'cliente')
      }

      app.save(users)
    } catch (_) {}
  },
)
