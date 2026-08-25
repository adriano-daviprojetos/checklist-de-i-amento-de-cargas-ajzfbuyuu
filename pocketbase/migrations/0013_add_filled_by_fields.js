migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('checklists')

    if (!collection.fields.getByName('filled_by_name')) {
      collection.fields.add(
        new TextField({
          name: 'filled_by_name',
        }),
      )
    }

    if (!collection.fields.getByName('filled_by_signature')) {
      collection.fields.add(
        new TextField({
          name: 'filled_by_signature',
          max: 10000000,
        }),
      )
    }

    app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('checklists')

    collection.fields.removeByName('filled_by_name')
    collection.fields.removeByName('filled_by_signature')

    app.save(collection)
  },
)
