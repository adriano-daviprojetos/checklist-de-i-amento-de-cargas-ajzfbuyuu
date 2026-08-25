migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')

    if (!users.fields.getByName('permissions')) {
      users.fields.add(
        new JSONField({
          name: 'permissions',
          maxSize: 2000000,
        }),
      )
    }

    app.save(users)
  },
  (app) => {
    try {
      const users = app.findCollectionByNameOrId('_pb_users_auth_')
      const field = users.fields.getByName('permissions')
      if (field) {
        users.fields.remove(field)
        app.save(users)
      }
    } catch (_) {}
  },
)
