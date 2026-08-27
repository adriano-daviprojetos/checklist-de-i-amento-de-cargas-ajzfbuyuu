onRecordDelete((e) => {
  const companyId = e.record.id

  // Cascade delete in related collections
  // 1. Delete checklist_responses linked to company's checklists
  try {
    const checklists = $app.findRecordsByFilter(
      'checklists',
      `company_id = '${companyId}'`,
      '',
      0,
      0,
    )
    for (let i = 0; i < checklists.length; i++) {
      const responses = $app.findRecordsByFilter(
        'checklist_responses',
        `checklist_id = '${checklists[i].id}'`,
        '',
        0,
        0,
      )
      for (let j = 0; j < responses.length; j++) {
        $app.delete(responses[j])
      }
      $app.delete(checklists[i])
    }
  } catch (err) {
    console.error('Error cascading delete checklists/responses:', err)
  }

  // 2. Delete checklist_template_items and checklist_templates
  try {
    const templates = $app.findRecordsByFilter(
      'checklist_templates',
      `company_id = '${companyId}'`,
      '',
      0,
      0,
    )
    for (let i = 0; i < templates.length; i++) {
      const items = $app.findRecordsByFilter(
        'checklist_template_items',
        `template_id = '${templates[i].id}'`,
        '',
        0,
        0,
      )
      for (let j = 0; j < items.length; j++) {
        $app.delete(items[j])
      }
      $app.delete(templates[i])
    }
  } catch (err) {
    console.error('Error cascading delete templates/items:', err)
  }

  // 3. Delete equipment
  try {
    const equipmentList = $app.findRecordsByFilter(
      'equipment',
      `company_id = '${companyId}'`,
      '',
      0,
      0,
    )
    for (let i = 0; i < equipmentList.length; i++) {
      $app.delete(equipmentList[i])
    }
  } catch (err) {
    console.error('Error cascading delete equipment:', err)
  }

  // 4. Delete materials
  try {
    const materials = $app.findRecordsByFilter('materials', `company_id = '${companyId}'`, '', 0, 0)
    for (let i = 0; i < materials.length; i++) {
      $app.delete(materials[i])
    }
  } catch (err) {
    console.error('Error cascading delete materials:', err)
  }

  // 5. Delete clients
  try {
    const clients = $app.findRecordsByFilter('clients', `company_id = '${companyId}'`, '', 0, 0)
    for (let i = 0; i < clients.length; i++) {
      $app.delete(clients[i])
    }
  } catch (err) {
    console.error('Error cascading delete clients:', err)
  }

  // 6. Delete users vinculados (except superadmin if necessary, but deleting users with company_id)
  try {
    const users = $app.findRecordsByFilter('users', `company_id = '${companyId}'`, '', 0, 0)
    for (let i = 0; i < users.length; i++) {
      $app.delete(users[i])
    }
  } catch (err) {
    console.error('Error cascading delete users:', err)
  }

  e.next()
}, 'companies')
