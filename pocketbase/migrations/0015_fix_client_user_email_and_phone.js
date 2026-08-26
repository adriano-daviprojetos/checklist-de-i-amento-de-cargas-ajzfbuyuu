migrate(
  (app) => {
    // 1. Fix user '9427qo6d22piz2d' (CLIENTETESTE):
    // Clear wrongly assigned email in phone field and set a valid email.
    try {
      const record = app.findFirstRecordByData('users', 'id', '9427qo6d22piz2d')
      // If phone contains an email address (contains @), move it or clear it.
      const phoneVal = record.get('phone') || ''
      if (phoneVal.includes('@')) {
        record.setEmail(phoneVal.trim())
        record.set('phone', '')
      } else {
        record.setEmail('cliente_teste@cliente.local')
      }
      app.save(record)
    } catch (_) {
      // Fallback via direct DB query if needed
      try {
        app
          .db()
          .newQuery(`
          UPDATE users
          SET email = CASE
            WHEN phone LIKE '%@%' THEN phone
            ELSE 'cliente_teste@cliente.local'
          END,
          phone = ''
          WHERE id = '9427qo6d22piz2d'
        `)
          .execute()
      } catch (__) {}
    }

    // 2. Fix any other users that might have an empty email string by generating a valid fallback email
    // PocketBase identityFields with email requires every record to have a valid email format to authenticate
    try {
      const recordsWithEmptyEmail = app.findRecordsByFilter(
        'users',
        "email = '' || email = null",
        '-created',
        100,
        0,
      )
      for (const rec of recordsWithEmptyEmail) {
        const uName = rec.get('username') || 'user_' + rec.id
        rec.setEmail(uName + '@cliente.local')
        app.save(rec)
      }
    } catch (_) {
      try {
        app
          .db()
          .newQuery(`
          UPDATE users
          SET email = (CASE WHEN username IS NOT NULL AND username != '' THEN username ELSE 'user_' || id END) || '@cliente.local'
          WHERE email IS NULL OR email = ''
        `)
          .execute()
      } catch (__) {}
    }
  },
  (app) => {
    // Revert is a no-op as fixing invalid email data is non-destructive
  },
)
