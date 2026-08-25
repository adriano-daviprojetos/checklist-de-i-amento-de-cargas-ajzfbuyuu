migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    if (!users.fields.getByName('username')) {
      users.fields.add(
        new TextField({
          name: 'username',
          required: false,
          max: 100,
        }),
      )
    }

    // Add unique index on username for non-empty values if not already present
    const indexSql =
      "CREATE UNIQUE INDEX `idx_username_users` ON `users` (`username`) WHERE `username` != ''"
    const hasIndex = (users.indexes || []).some((idx) => idx.includes('idx_username_users'))
    if (!hasIndex) {
      users.indexes = [...(users.indexes || []), indexSql]
    }

    app.save(users)
  },
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    if (users.fields.getByName('username')) {
      users.fields.removeByName('username')
    }
    users.indexes = (users.indexes || []).filter((idx) => !idx.includes('idx_username_users'))
    app.save(users)
  },
)
