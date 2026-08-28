migrate(
  (app) => {
    // Normalizar códigos existentes para o padrão chk-YYYY-NNNNNN se aplicável
    try {
      const rows = app
        .db()
        .newQuery('SELECT id, code, created FROM checklists ORDER BY created ASC')
        .all()

      let seqByYear = {}

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        let year = new Date().getFullYear()
        if (row.created) {
          const d = new Date(row.created)
          if (!isNaN(d.getFullYear())) {
            year = d.getFullYear()
          }
        }

        const currentCode = String(row.code || '')
          .trim()
          .toLowerCase()
        const officialPattern = /^chk-\d{4}-\d{6}$/i

        if (!seqByYear[year]) {
          seqByYear[year] = 1
        }

        if (!officialPattern.test(currentCode)) {
          const seqStr = String(seqByYear[year]).padStart(6, '0')
          const newCode = 'chk-' + year + '-' + seqStr
          seqByYear[year]++

          app
            .db()
            .newQuery('UPDATE checklists SET code = {:newCode} WHERE id = {:id}')
            .bind({
              newCode: newCode,
              id: row.id,
            })
            .execute()
        } else {
          // Extrair número para atualizar o contador daquele ano
          const parts = currentCode.split('-')
          if (parts.length === 3) {
            const num = parseInt(parts[2], 10)
            if (!isNaN(num) && num >= seqByYear[year]) {
              seqByYear[year] = num + 1
            }
          }
        }
      }
    } catch (e) {
      console.warn('Error standardizing checklist codes:', e)
    }
  },
  (app) => {},
)
