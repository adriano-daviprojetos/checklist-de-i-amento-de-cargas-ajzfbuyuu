migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')

    // Find company to link user, default to first available
    let companyId = ''
    try {
      const company = app.findFirstRecordByData('companies', 'active', true)
      companyId = company.id
    } catch (_) {}

    // Check if user with username Daviuniao001 or email daviuniao001@daviprojetos.com.br or cpf 999.999.999-99 exists
    let testUser = null
    try {
      testUser = app.findFirstRecordByFilter('users', 'username = {:u}', { u: 'Daviuniao001' })
    } catch (_) {}

    if (!testUser) {
      try {
        testUser = app.findFirstRecordByFilter('users', 'cpf = {:c}', { c: '999.999.999-99' })
      } catch (_) {}
    }

    if (!testUser) {
      try {
        testUser = app.findAuthRecordByEmail('_pb_users_auth_', 'daviuniao001@daviprojetos.com.br')
      } catch (_) {}
    }

    if (testUser) {
      testUser.set('username', 'Daviuniao001')
      testUser.set('cpf', '999.999.999-99')
      testUser.setPassword('Daviuniao001')
      testUser.setVerified(true)
      testUser.set('active', true)
      if (!testUser.get('company_id') && companyId) {
        testUser.set('company_id', companyId)
      }
      app.save(testUser)
    } else {
      const newUser = new Record(users)
      newUser.setEmail('daviuniao001@daviprojetos.com.br')
      newUser.setPassword('Daviuniao001')
      newUser.setVerified(true)
      newUser.set('name', 'Davi União')
      newUser.set('username', 'Daviuniao001')
      newUser.set('cpf', '999.999.999-99')
      newUser.set('role', 'gestor')
      newUser.set('active', true)
      if (companyId) {
        newUser.set('company_id', companyId)
      }
      app.save(newUser)
    }
  },
  (app) => {
    // down logic
  },
)
