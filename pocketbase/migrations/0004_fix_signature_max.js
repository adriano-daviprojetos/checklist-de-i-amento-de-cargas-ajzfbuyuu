migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('checklists')

    // 1. Remove existing signature_data field (if it exists)
    collection.fields.removeByName('signature_data')

    // 2. Recreate signature_data as TextField without max property
    collection.fields.add(
      new TextField({
        name: 'signature_data',
      }),
    )

    // 3. Save the collection
    app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('checklists')

    collection.fields.removeByName('signature_data')

    collection.fields.add(
      new TextField({
        name: 'signature_data',
      }),
    )

    app.save(collection)
  },
)
