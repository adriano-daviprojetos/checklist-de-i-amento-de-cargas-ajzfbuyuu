migrate(
  (app) => {
    // 1. Create companies collection
    const companies = new Collection({
      name: 'companies',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'trade_name', type: 'text' },
        { name: 'cnpj', type: 'text' },
        { name: 'phone', type: 'text' },
        { name: 'email', type: 'text' },
        { name: 'address', type: 'text' },
        { name: 'city', type: 'text' },
        { name: 'state', type: 'text' },
        { name: 'active', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_companies_name ON companies (name)'],
    })
    app.save(companies)

    // 2. Extend users auth collection with company_id, role, cpf, phone, active
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    users.listRule = "@request.auth.id != ''"
    users.viewRule = "@request.auth.id != ''"
    users.createRule = "@request.auth.id != ''"
    users.updateRule = "@request.auth.id != ''"
    users.deleteRule = "@request.auth.id != ''"

    if (!users.fields.getByName('company_id')) {
      users.fields.add(
        new RelationField({
          name: 'company_id',
          collectionId: companies.id,
          maxSelect: 1,
          required: false,
        }),
      )
    }
    if (!users.fields.getByName('cpf')) {
      users.fields.add(
        new TextField({
          name: 'cpf',
        }),
      )
    }
    if (!users.fields.getByName('phone')) {
      users.fields.add(
        new TextField({
          name: 'phone',
        }),
      )
    }
    if (!users.fields.getByName('role')) {
      users.fields.add(
        new SelectField({
          name: 'role',
          values: [
            'superadmin',
            'admin',
            'gestor',
            'supervisor',
            'rigger',
            'sinaleiro',
            'operador',
          ],
          maxSelect: 1,
        }),
      )
    }
    if (!users.fields.getByName('active')) {
      users.fields.add(
        new BoolField({
          name: 'active',
        }),
      )
    }
    app.save(users)

    // 3. Create clients collection
    const clients = new Collection({
      name: 'clients',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'company_id',
          type: 'relation',
          collectionId: companies.id,
          maxSelect: 1,
          required: true,
        },
        { name: 'name', type: 'text', required: true },
        { name: 'trade_name', type: 'text' },
        { name: 'document', type: 'text' }, // CPF or CNPJ
        { name: 'contact_name', type: 'text' },
        { name: 'phone', type: 'text' },
        { name: 'email', type: 'text' },
        { name: 'address', type: 'text' },
        { name: 'city', type: 'text' },
        { name: 'state', type: 'text' },
        { name: 'notes', type: 'text' },
        { name: 'active', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_clients_company ON clients (company_id)',
        'CREATE INDEX idx_clients_name ON clients (name)',
      ],
    })
    app.save(clients)

    // 4. Create equipment collection
    // Types: Guindaste, Munck, Caminhão, Empilhadeira, Plataforma Elevatória, Outro
    const equipment = new Collection({
      name: 'equipment',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'company_id',
          type: 'relation',
          collectionId: companies.id,
          maxSelect: 1,
          required: true,
        },
        {
          name: 'type',
          type: 'select',
          values: [
            'Guindaste',
            'Munck',
            'Caminhão',
            'Empilhadeira',
            'Plataforma Elevatória',
            'Outro',
          ],
          maxSelect: 1,
          required: true,
        },
        { name: 'manufacturer', type: 'text', required: true }, // Fabricante
        { name: 'model', type: 'text', required: true }, // Modelo
        { name: 'capacity', type: 'text', required: true }, // Capacidade (e.g. 70t, 30t)
        { name: 'license_plate', type: 'text' }, // Placa / Identificação
        { name: 'serial_number', type: 'text' },
        { name: 'year', type: 'number' },
        {
          name: 'status',
          type: 'select',
          values: ['Operacional', 'Em Manutenção', 'Inativo', 'Aguardando Inspeção'],
          maxSelect: 1,
        },
        { name: 'last_inspection', type: 'date' },
        { name: 'notes', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_equipment_company ON equipment (company_id)',
        'CREATE INDEX idx_equipment_type ON equipment (type)',
      ],
    })
    app.save(equipment)

    // 5. Create materials collection (materiais e acessórios de içamento)
    // Types: Cinta, Cabos de Aço, Manilhas, Ganchos, Olhais, Moitões, Estropos, Balancim, Outro
    const materials = new Collection({
      name: 'materials',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'company_id',
          type: 'relation',
          collectionId: companies.id,
          maxSelect: 1,
          required: true,
        },
        {
          name: 'type',
          type: 'select',
          values: [
            'Cinta',
            'Cabos de Aço',
            'Manilhas',
            'Ganchos',
            'Olhais',
            'Moitões',
            'Estropos',
            'Balancim',
            'Outro',
          ],
          maxSelect: 1,
          required: true,
        },
        { name: 'tag', type: 'text', required: true }, // TAG identificador
        { name: 'manufacturer', type: 'text' }, // Fabricante
        { name: 'model', type: 'text' }, // Modelo/Especificação
        { name: 'capacity', type: 'text', required: true }, // Capacidade / WLL (e.g. 5t, 12t)
        { name: 'diameter_or_length', type: 'text' }, // Diâmetro / Comprimento
        {
          name: 'status',
          type: 'select',
          values: ['Disponível', 'Em Uso', 'Em Inspeção', 'Danificado / Descarte', 'Quarentena'],
          maxSelect: 1,
        },
        { name: 'last_inspection', type: 'date' },
        { name: 'validity_date', type: 'date' },
        { name: 'notes', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_materials_company ON materials (company_id)',
        'CREATE INDEX idx_materials_tag ON materials (tag)',
      ],
    })
    app.save(materials)

    // 6. Create checklist_templates collection
    const checklistTemplates = new Collection({
      name: 'checklist_templates',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'company_id',
          type: 'relation',
          collectionId: companies.id,
          maxSelect: 1,
          required: true,
        },
        { name: 'title', type: 'text', required: true },
        { name: 'description', type: 'text' },
        {
          name: 'category',
          type: 'select',
          values: [
            'Guindaste',
            'Munck',
            'Acessórios e Materiais',
            'Plano de Rigging',
            'Segurança e Sinalização',
            'Geral de Içamento',
          ],
          maxSelect: 1,
          required: true,
        },
        {
          name: 'target_role',
          type: 'select',
          values: ['Todos', 'Operador', 'Rigger', 'Sinaleiro', 'Supervisor'],
          maxSelect: 1,
        },
        { name: 'active', type: 'bool' },
        { name: 'version', type: 'number' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_templates_company ON checklist_templates (company_id)',
        'CREATE INDEX idx_templates_category ON checklist_templates (category)',
      ],
    })
    app.save(checklistTemplates)

    // 7. Create checklist_template_items collection
    const checklistTemplateItems = new Collection({
      name: 'checklist_template_items',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'template_id',
          type: 'relation',
          collectionId: checklistTemplates.id,
          maxSelect: 1,
          required: true,
          cascadeDelete: true,
        },
        { name: 'section', type: 'text' }, // e.g. "Condições Mecânicas", "Sistemas de Segurança", "Cabos e Ganchos"
        { name: 'title', type: 'text', required: true },
        { name: 'description', type: 'text' },
        {
          name: 'type',
          type: 'select',
          values: ['conforme_nao_conforme', 'sim_nao_na', 'texto', 'numero', 'foto_obrigatoria'],
          maxSelect: 1,
          required: true,
        },
        { name: 'is_mandatory', type: 'bool' },
        { name: 'is_critical', type: 'bool' }, // se não conforme, reprova automaticamente o checklist
        { name: 'order_num', type: 'number' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_items_template ON checklist_template_items (template_id)',
        'CREATE INDEX idx_items_order ON checklist_template_items (template_id, order_num)',
      ],
    })
    app.save(checklistTemplateItems)

    // 8. Create checklists collection (instâncias de execução)
    const checklists = new Collection({
      name: 'checklists',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'company_id',
          type: 'relation',
          collectionId: companies.id,
          maxSelect: 1,
          required: true,
        },
        {
          name: 'template_id',
          type: 'relation',
          collectionId: checklistTemplates.id,
          maxSelect: 1,
          required: true,
        },
        { name: 'client_id', type: 'relation', collectionId: clients.id, maxSelect: 1 },
        { name: 'equipment_id', type: 'relation', collectionId: equipment.id, maxSelect: 1 },
        { name: 'material_id', type: 'relation', collectionId: materials.id, maxSelect: 1 },
        { name: 'user_id', type: 'relation', collectionId: users.id, maxSelect: 1, required: true },
        { name: 'code', type: 'text' }, // e.g. CHK-2025-001
        { name: 'title', type: 'text', required: true },
        { name: 'location', type: 'text' }, // Local da operação / Obra
        { name: 'operation_type', type: 'text' }, // e.g. "Içamento de Transformador", "Montagem Estrutura"
        { name: 'scheduled_date', type: 'date' },
        { name: 'started_at', type: 'date' },
        { name: 'completed_at', type: 'date' },
        {
          name: 'status',
          type: 'select',
          values: ['Pendente', 'Em Andamento', 'Concluído', 'Reprovado'],
          maxSelect: 1,
          required: true,
        },
        {
          name: 'risk_level',
          type: 'select',
          values: ['Baixo', 'Médio', 'Alto', 'Crítico'],
          maxSelect: 1,
        },
        { name: 'notes', type: 'text' },
        { name: 'inspector_name', type: 'text' },
        { name: 'signature_data', type: 'text' }, // Base64 signature
        {
          name: 'sync_status',
          type: 'select',
          values: ['synced', 'pending_sync', 'conflict'],
          maxSelect: 1,
        },
        { name: 'local_id', type: 'text' }, // IndexedDB tracking id
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_checklists_company ON checklists (company_id)',
        'CREATE INDEX idx_checklists_status ON checklists (status)',
        'CREATE INDEX idx_checklists_user ON checklists (user_id)',
      ],
    })
    app.save(checklists)

    // 9. Create checklist_responses collection (respostas individuais de cada item)
    const checklistResponses = new Collection({
      name: 'checklist_responses',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'checklist_id',
          type: 'relation',
          collectionId: checklists.id,
          maxSelect: 1,
          required: true,
          cascadeDelete: true,
        },
        {
          name: 'item_id',
          type: 'relation',
          collectionId: checklistTemplateItems.id,
          maxSelect: 1,
        },
        { name: 'item_title', type: 'text', required: true },
        { name: 'item_section', type: 'text' },
        {
          name: 'status',
          type: 'select',
          values: ['C', 'NC', 'NA', 'SIM', 'NAO', 'PENDENTE'],
          maxSelect: 1,
          required: true,
        }, // C = Conforme, NC = Não Conforme, NA = Não se Aplica
        { name: 'observation', type: 'text' },
        { name: 'photo_url', type: 'text' }, // Base64 or URL
        { name: 'value', type: 'text' }, // Textual or numeric answer
        { name: 'is_critical_fail', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_responses_checklist ON checklist_responses (checklist_id)'],
    })
    app.save(checklistResponses)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('checklist_responses'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('checklists'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('checklist_template_items'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('checklist_templates'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('materials'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('equipment'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('clients'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('companies'))
    } catch (_) {}
  },
)
