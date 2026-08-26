migrate(
  (app) => {
    // 1. Fix user '9427qo6d22piz2d' (CLIENTETESTE):
    // Clear wrongly assigned email in phone field and ensure proper email is set.
    try {
      app
        .db()
        .newQuery(`
        UPDATE users
        SET email = 'cliente_teste@cliente.local',
            phone = ''
        WHERE id = '9427qo6d22piz2d'
      `)
        .execute()
    } catch (_) {}

    // 2. Clean any remaining users with empty email or invalid email format
    try {
      app
        .db()
        .newQuery(`
        UPDATE users
        SET email = (CASE WHEN username IS NOT NULL AND username != '' THEN username ELSE 'user_' || id END) || '@cliente.local'
        WHERE email IS NULL OR email = ''
      `)
        .execute()
    } catch (_) {}
  },
  (app) => {},
)
