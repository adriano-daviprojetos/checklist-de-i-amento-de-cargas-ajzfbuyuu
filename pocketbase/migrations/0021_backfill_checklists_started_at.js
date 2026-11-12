migrate(
  (app) => {
    // Backfill idempotente: para checklists sem started_at, usa o timestamp de criação (created).
    // Em banco vazio é no-op. Nunca sobrescreve um started_at já existente.
    try {
      const records = app.findRecordsByFilter(
        'checklists',
        "started_at = '' || started_at = null",
        '',
        0,
        0,
      )
      for (let i = 0; i < records.length; i++) {
        const record = records[i]
        const created = record.getString('created')
        if (created) {
          record.set('started_at', created)
          app.save(record)
        }
      }
    } catch (e) {
      console.warn('Backfill started_at (0021) ignorado/não aplicável:', e)
    }
  },
  (app) => {},
)
