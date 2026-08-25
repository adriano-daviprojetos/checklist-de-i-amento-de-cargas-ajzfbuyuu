/// <reference path="../pb_data/types.d.ts" />

onRecordAuthRequest((e) => {
  const identity = e.identity || ''
  if (!identity.includes('@')) {
    // CPF login — remove non-digits
    const cleaned = identity.replace(/[^0-9]/g, '')
    try {
      // Search with formatted string or cleaned digits
      const filter =
        cleaned !== identity && identity.length > 0
          ? `cpf ~ '${cleaned}' || cpf ~ '${identity}'`
          : `cpf ~ '${cleaned}'`
      const users = $app.findRecordsByFilter('users', filter, '', 1, 0)
      if (users && users.length > 0 && users[0].get('email')) {
        e.identity = users[0].get('email')
      }
    } catch (err) {
      // Lookup failed or no records found, let auth proceed with original identity
    }
  }

  // Always let PocketBase process normally
  e.next()
}, 'users')
