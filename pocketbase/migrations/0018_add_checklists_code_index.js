migrate(
  (app) => {
    // 1. Create unique index on checklists (code) if not exists (handling null/empty safely)
    const checklists = app.findCollectionByNameOrId('checklists')
    checklists.addIndex('idx_checklists_code', false, 'code', '')
    app.save(checklists)
  },
  (app) => {
    try {
      const checklists = app.findCollectionByNameOrId('checklists')
      checklists.removeIndex('idx_checklists_code')
      app.save(checklists)
    } catch (_) {}
  },
)
