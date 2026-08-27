/// <reference path="../pb_data/types.d.ts" />

// Ensure newly created operational records inherit company_id from authenticated user if omitted
onRecordCreate(
  (e) => {
    const collectionName = e.record.collection().name
    const tenantCollections = [
      'checklists',
      'checklist_templates',
      'equipment',
      'materials',
      'clients',
      'users',
    ]

    if (tenantCollections.includes(collectionName)) {
      if (!e.record.get('company_id') && e.auth) {
        const userCompanyId = e.auth.get('company_id')
        if (userCompanyId) {
          e.record.set('company_id', userCompanyId)
        }
      }
    }

    e.next()
  },
  'checklists',
  'checklist_templates',
  'equipment',
  'materials',
  'clients',
  'users',
)
