migrate(
  (app) => {
    try {
      const records = app.findRecordsByFilter('checklists', '', 'created', 100, 0)
      let seqByYear = {}

      for (let i = 0; i < records.length; i++) {
        const record = records[i]
        let year = 2026
        const createdStr = record.getString('created') || record.getString('scheduled_date')
        if (createdStr) {
          const d = new Date(createdStr)
          if (!isNaN(d.getFullYear())) {
            year = d.getFullYear()
          }
        }

        if (!seqByYear[year]) {
          seqByYear[year] = 1
        }

        const seqStr = String(seqByYear[year]).padStart(6, '0')
        const newCode = 'chk-' + year + '-' + seqStr
        seqByYear[year]++

        record.set('code', newCode)
        app.save(record)
      }
    } catch (e) {
      console.warn('Error formatting existing checklist codes in 0020:', e)
    }
  },
  (app) => {},
)
