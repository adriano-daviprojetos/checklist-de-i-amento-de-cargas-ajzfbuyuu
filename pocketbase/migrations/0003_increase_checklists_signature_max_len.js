migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('checklists')
    const signatureField = collection.fields.getByName('signature_data')
    if (signatureField) {
      signatureField.max = 0
    } else {
      collection.fields.add(
        new TextField({
          name: 'signature_data',
          max: 0,
        }),
      )
    }
    app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('checklists')
    const signatureField = collection.fields.getByName('signature_data')
    if (signatureField) {
      signatureField.max = 5000
      app.save(collection)
    }
  },
)
