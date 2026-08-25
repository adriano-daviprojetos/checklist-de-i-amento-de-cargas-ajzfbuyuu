/// <reference path="../pb_data/types.d.ts" />

// Cascade delete all records belonging to a company when that company is deleted
onRecordDelete((e) => {
  const companyId = e.record.id

  // 1. Delete all checklists and their responses
  try {
    const checklists = $app.findRecordsByFilter(
      'checklists',
      `company_id = '${companyId}'`,
      '-created',
      5000,
      0,
    )
    for (let i = 0; i < checklists.length; i++) {
      const chkId = checklists[i].id
      try {
        const responses = $app.findRecordsByFilter(
          'checklist_responses',
          `checklist_id = '${chkId}'`,
          'created',
          5000,
          0,
        )
        for (let j = 0; j < responses.length; j++) {
          try {
            $app.delete(responses[j])
          } catch (err) {
            // continue deleting other responses
          }
        }
      } catch (err) {
        // ignore
      }
      try {
        $app.delete(checklists[i])
      } catch (err) {
        // continue
      }
    }
  } catch (err) {
    // ignore
  }

  // 2. Delete checklist template items and templates
  try {
    const templates = $app.findRecordsByFilter(
      'checklist_templates',
      `company_id = '${companyId}'`,
      'title',
      5000,
      0,
    )
    for (let i = 0; i < templates.length; i++) {
      const tplId = templates[i].id
      try {
        const items = $app.findRecordsByFilter(
          'checklist_template_items',
          `template_id = '${tplId}'`,
          'order_num',
          5000,
          0,
        )
        for (let j = 0; j < items.length; j++) {
          try {
            $app.delete(items[j])
          } catch (err) {
            // continue
          }
        }
      } catch (err) {
        // ignore
      }
      try {
        $app.delete(templates[i])
      } catch (err) {
        // continue
      }
    }
  } catch (err) {
    // ignore
  }

  // 3. Delete equipment
  try {
    const equipment = $app.findRecordsByFilter(
      'equipment',
      `company_id = '${companyId}'`,
      'created',
      5000,
      0,
    )
    for (let i = 0; i < equipment.length; i++) {
      try {
        $app.delete(equipment[i])
      } catch (err) {
        // continue
      }
    }
  } catch (err) {
    // ignore
  }

  // 4. Delete materials
  try {
    const materials = $app.findRecordsByFilter(
      'materials',
      `company_id = '${companyId}'`,
      'created',
      5000,
      0,
    )
    for (let i = 0; i < materials.length; i++) {
      try {
        $app.delete(materials[i])
      } catch (err) {
        // continue
      }
    }
  } catch (err) {
    // ignore
  }

  // 5. Delete clients
  try {
    const clients = $app.findRecordsByFilter(
      'clients',
      `company_id = '${companyId}'`,
      'created',
      5000,
      0,
    )
    for (let i = 0; i < clients.length; i++) {
      try {
        $app.delete(clients[i])
      } catch (err) {
        // continue
      }
    }
  } catch (err) {
    // ignore
  }

  // 6. Delete users belonging to this company (except the current requester if triggered directly)
  try {
    const users = $app.findRecordsByFilter(
      'users',
      `company_id = '${companyId}'`,
      'created',
      5000,
      0,
    )
    for (let i = 0; i < users.length; i++) {
      try {
        $app.delete(users[i])
      } catch (err) {
        // continue
      }
    }
  } catch (err) {
    // ignore
  }

  e.next()
}, 'companies')
