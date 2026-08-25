migrate(
  (app) => {
    const companies = app.findCollectionByNameOrId('companies')
    const checklistTemplates = app.findCollectionByNameOrId('checklist_templates')

    // 1. Create checklist_item_groups collection
    let itemGroups
    try {
      itemGroups = app.findCollectionByNameOrId('checklist_item_groups')
    } catch (_) {
      itemGroups = new Collection({
        name: 'checklist_item_groups',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [
          {
            name: 'company',
            type: 'relation',
            collectionId: companies.id,
            maxSelect: 1,
            required: false,
          },
          {
            name: 'template',
            type: 'relation',
            collectionId: checklistTemplates.id,
            maxSelect: 1,
            required: true,
            cascadeDelete: true,
          },
          { name: 'name', type: 'text', required: true },
          { name: 'sort_order', type: 'number' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_groups_template ON checklist_item_groups (template)',
          'CREATE INDEX idx_groups_sort ON checklist_item_groups (template, sort_order)',
        ],
      })
      app.save(itemGroups)
    }

    // 2. Add group and sort_order fields to checklist_template_items
    const checklistTemplateItems = app.findCollectionByNameOrId('checklist_template_items')

    if (!checklistTemplateItems.fields.getByName('group')) {
      checklistTemplateItems.fields.add(
        new RelationField({
          name: 'group',
          collectionId: itemGroups.id,
          maxSelect: 1,
          required: false,
          cascadeDelete: false,
        }),
      )
    }

    if (!checklistTemplateItems.fields.getByName('sort_order')) {
      checklistTemplateItems.fields.add(
        new NumberField({
          name: 'sort_order',
        }),
      )
    }

    app.save(checklistTemplateItems)

    // Also migrate existing items: copy order_num to sort_order if sort_order is null/empty
    try {
      app
        .db()
        .newQuery(`
        UPDATE checklist_template_items 
        SET sort_order = order_num 
        WHERE sort_order IS NULL OR sort_order = 0
      `)
        .execute()
    } catch (e) {
      console.log('Error migrating order_num to sort_order:', e)
    }
  },
  (app) => {
    try {
      const checklistTemplateItems = app.findCollectionByNameOrId('checklist_template_items')
      if (checklistTemplateItems.fields.getByName('group')) {
        checklistTemplateItems.fields.removeByName('group')
      }
      if (checklistTemplateItems.fields.getByName('sort_order')) {
        checklistTemplateItems.fields.removeByName('sort_order')
      }
      app.save(checklistTemplateItems)
    } catch (_) {}

    try {
      const itemGroups = app.findCollectionByNameOrId('checklist_item_groups')
      app.delete(itemGroups)
    } catch (_) {}
  },
)
