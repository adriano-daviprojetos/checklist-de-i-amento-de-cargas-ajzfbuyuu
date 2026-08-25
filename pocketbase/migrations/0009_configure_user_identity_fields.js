migrate(
  (app) => {
    // 1. Resolve any duplicate CPFs before creating UNIQUE index
    // For id 'b4h3klincpotnxk' (Adriano-Rigger) which has duplicate CPF 135.365.528-89 with row 6v8x90kpbtip6e6
    try {
      app.db().newQuery("UPDATE users SET cpf = '' WHERE id = 'b4h3klincpotnxk'").execute()
    } catch (_) {}

    // 2. Add unique index for CPF on users
    const users = app.findCollectionByNameOrId('_pb_users_auth_')

    const cpfIndexSql = "CREATE UNIQUE INDEX `idx_cpf_users` ON `users` (`cpf`) WHERE `cpf` != ''"
    const hasCpfIndex = (users.indexes || []).some((idx) => idx.includes('idx_cpf_users'))
    if (!hasCpfIndex) {
      users.indexes = [...(users.indexes || []), cpfIndexSql]
    }

    // 3. Configure native identityFields for multi-field authentication
    if (!users.passwordAuth) {
      users.passwordAuth = {
        enabled: true,
        identityFields: ['email', 'username', 'cpf'],
      }
    } else {
      users.passwordAuth.enabled = true
      users.passwordAuth.identityFields = ['email', 'username', 'cpf']
    }

    app.save(users)
  },
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    if (users.passwordAuth) {
      users.passwordAuth.identityFields = ['email']
    }
    users.indexes = (users.indexes || []).filter((idx) => !idx.includes('idx_cpf_users'))
    app.save(users)
  },
)
