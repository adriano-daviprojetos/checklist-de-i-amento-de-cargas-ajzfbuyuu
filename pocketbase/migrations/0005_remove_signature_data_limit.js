migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('checklists')

    // Remove existing signature_data field
    collection.fields.removeByName('signature_data')

    // Recreate signature_data with explicit high max (10 million characters) to accommodate large base64 signatures
    collection.fields.add(
      new TextField({
        name: 'signature_data',
        max: 10000000,
      }),
    )

    app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('checklists')

    collection.fields.removeByName('signature_data')

    collection.fields.add(
      new TextField({
        name: 'signature_data',
        max: 10000000,
      }),
    )

    app.save(collection)
  },
)
