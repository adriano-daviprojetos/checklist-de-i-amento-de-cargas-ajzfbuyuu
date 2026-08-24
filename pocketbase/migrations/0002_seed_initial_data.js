migrate(
  (app) => {
    const companies = app.findCollectionByNameOrId('companies')
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    const clients = app.findCollectionByNameOrId('clients')
    const equipment = app.findCollectionByNameOrId('equipment')
    const materials = app.findCollectionByNameOrId('materials')
    const checklistTemplates = app.findCollectionByNameOrId('checklist_templates')
    const checklistTemplateItems = app.findCollectionByNameOrId('checklist_template_items')
    const checklists = app.findCollectionByNameOrId('checklists')
    const checklistResponses = app.findCollectionByNameOrId('checklist_responses')

    // 1. Seed Company
    let companyRecord
    try {
      companyRecord = app.findFirstRecordByData(
        'companies',
        'name',
        'Guindastes & Engenharia Brasil Ltda',
      )
    } catch (_) {
      companyRecord = new Record(companies)
      companyRecord.set('name', 'Guindastes & Engenharia Brasil Ltda')
      companyRecord.set('trade_name', 'GEB Rigging & Içamentos')
      companyRecord.set('cnpj', '12.345.678/0001-90')
      companyRecord.set('phone', '(11) 3456-7890')
      companyRecord.set('email', 'contato@gebrigging.com.br')
      companyRecord.set('address', 'Av. Industrial dos Guindastes, 1500 - Distrito Industrial')
      companyRecord.set('city', 'São Paulo')
      companyRecord.set('state', 'SP')
      companyRecord.set('active', true)
      app.save(companyRecord)
    }

    // 1.1 Secondary Company for multi-tenant showcase
    let companyRecord2
    try {
      companyRecord2 = app.findFirstRecordByData(
        'companies',
        'name',
        'MegaLift Serviços de Içamento S/A',
      )
    } catch (_) {
      companyRecord2 = new Record(companies)
      companyRecord2.set('name', 'MegaLift Serviços de Içamento S/A')
      companyRecord2.set('trade_name', 'MegaLift Soluções Pesadas')
      companyRecord2.set('cnpj', '98.765.432/0001-10')
      companyRecord2.set('phone', '(21) 2233-4455')
      companyRecord2.set('email', 'operacoes@megalift.com.br')
      companyRecord2.set('address', 'Rodovia Presidente Dutra, KM 180')
      companyRecord2.set('city', 'Rio de Janeiro')
      companyRecord2.set('state', 'RJ')
      companyRecord2.set('active', true)
      app.save(companyRecord2)
    }

    // 2. Seed Admin User (adriano@daviprojetos.com.br)
    let adminUser
    try {
      adminUser = app.findAuthRecordByEmail('_pb_users_auth_', 'adriano@daviprojetos.com.br')
      adminUser.set('company_id', companyRecord.id)
      adminUser.set('role', 'admin')
      adminUser.set('cpf', '123.456.789-00')
      adminUser.set('phone', '(11) 98765-4321')
      adminUser.set('active', true)
      adminUser.set('name', 'Adriano Gestor Master')
      app.save(adminUser)
    } catch (_) {
      adminUser = new Record(users)
      adminUser.setEmail('adriano@daviprojetos.com.br')
      adminUser.setPassword('Skip@Pass')
      adminUser.setVerified(true)
      adminUser.set('name', 'Adriano Gestor Master')
      adminUser.set('company_id', companyRecord.id)
      adminUser.set('role', 'admin')
      adminUser.set('cpf', '123.456.789-00')
      adminUser.set('phone', '(11) 98765-4321')
      adminUser.set('active', true)
      app.save(adminUser)
    }

    // 2.1 Seed demo role users for testing
    const demoUsers = [
      {
        email: 'gestor@gebrigging.com.br',
        name: 'Carlos Andrade (Gestor)',
        role: 'gestor',
        cpf: '222.333.444-55',
      },
      {
        email: 'supervisor@gebrigging.com.br',
        name: 'Marcio Silva (Supervisor)',
        role: 'supervisor',
        cpf: '333.444.555-66',
      },
      {
        email: 'rigger@gebrigging.com.br',
        name: 'Lucas Ferreira (Rigger)',
        role: 'rigger',
        cpf: '444.555.666-77',
      },
      {
        email: 'operador@gebrigging.com.br',
        name: 'José Roberto (Operador Guindaste)',
        role: 'operador',
        cpf: '555.666.777-88',
      },
      {
        email: 'sinaleiro@gebrigging.com.br',
        name: 'Bruno Souza (Sinaleiro)',
        role: 'sinaleiro',
        cpf: '666.777.888-99',
      },
    ]

    demoUsers.forEach((u) => {
      try {
        app.findAuthRecordByEmail('_pb_users_auth_', u.email)
      } catch (_) {
        const rec = new Record(users)
        rec.setEmail(u.email)
        rec.setPassword('Skip@Pass')
        rec.setVerified(true)
        rec.set('name', u.name)
        rec.set('company_id', companyRecord.id)
        rec.set('role', u.role)
        rec.set('cpf', u.cpf)
        rec.set('phone', '(11) 98000-0000')
        rec.set('active', true)
        app.save(rec)
      }
    })

    // 3. Seed Clients
    let client1
    try {
      client1 = app.findFirstRecordByData('clients', 'name', 'Petrobras S/A - Refinaria RPBC')
    } catch (_) {
      client1 = new Record(clients)
      client1.set('company_id', companyRecord.id)
      client1.set('name', 'Petrobras S/A - Refinaria RPBC')
      client1.set('trade_name', 'RPBC Cubatão')
      client1.set('document', '33.000.167/0001-01')
      client1.set('contact_name', 'Eng. Rafael Mendes')
      client1.set('phone', '(13) 3362-8000')
      client1.set('email', 'obras.rpbc@petrobras.com.br')
      client1.set('address', 'Av. 9 de Abril, 777 - Vila Nova')
      client1.set('city', 'Cubatão')
      client1.set('state', 'SP')
      client1.set('notes', 'Exigência de plano de rigging nível 3 e ART')
      client1.set('active', true)
      app.save(client1)
    }

    let client2
    try {
      client2 = app.findFirstRecordByData('clients', 'name', 'Vale Mineradora - Terminal Marítimo')
    } catch (_) {
      client2 = new Record(clients)
      client2.set('company_id', companyRecord.id)
      client2.set('name', 'Vale Mineradora - Terminal Marítimo')
      client2.set('trade_name', 'Vale Porto')
      client2.set('document', '33.592.510/0001-54')
      client2.set('contact_name', 'Supervisora Patrícia')
      client2.set('phone', '(27) 3333-9000')
      client2.set('email', 'manutencao.portos@vale.com')
      client2.set('city', 'Vitória')
      client2.set('state', 'ES')
      client2.set('active', true)
      app.save(client2)
    }

    // 4. Seed Equipment
    let eq1, eq2, eq3
    try {
      eq1 = app.findFirstRecordByData('equipment', 'model', 'LTM 1100-5.2')
    } catch (_) {
      eq1 = new Record(equipment)
      eq1.set('company_id', companyRecord.id)
      eq1.set('type', 'Guindaste')
      eq1.set('manufacturer', 'Liebherr')
      eq1.set('model', 'LTM 1100-5.2')
      eq1.set('capacity', '100 Toneladas')
      eq1.set('license_plate', 'GEB-1001')
      eq1.set('serial_number', 'LBH-998821')
      eq1.set('year', 2022)
      eq1.set('status', 'Operacional')
      eq1.set('last_inspection', '2025-02-10 10:00:00.000Z')
      eq1.set('notes', 'Lança telescópica de 52m + Jib 19m. Tabela de carga calibrada.')
      app.save(eq1)
    }

    try {
      eq2 = app.findFirstRecordByData('equipment', 'model', 'Madal MD 300')
    } catch (_) {
      eq2 = new Record(equipment)
      eq2.set('company_id', companyRecord.id)
      eq2.set('type', 'Guindaste')
      eq2.set('manufacturer', 'Madal Palfinger')
      eq2.set('model', 'Madal MD 300')
      eq2.set('capacity', '30 Toneladas')
      eq2.set('license_plate', 'GEB-3004')
      eq2.set('serial_number', 'MDL-44120')
      eq2.set('year', 2020)
      eq2.set('status', 'Operacional')
      eq2.set('last_inspection', '2025-01-20 09:00:00.000Z')
      app.save(eq2)
    }

    try {
      eq3 = app.findFirstRecordByData('equipment', 'model', 'PK 45002 - Scania P310')
    } catch (_) {
      eq3 = new Record(equipment)
      eq3.set('company_id', companyRecord.id)
      eq3.set('type', 'Munck')
      eq3.set('manufacturer', 'Palfinger / Scania')
      eq3.set('model', 'PK 45002 - Scania P310')
      eq3.set('capacity', '45 tm (12t no pé)')
      eq3.set('license_plate', 'MNC-8890')
      eq3.set('serial_number', 'PLF-77891')
      eq3.set('year', 2023)
      eq3.set('status', 'Operacional')
      eq3.set('last_inspection', '2025-02-15 14:00:00.000Z')
      app.save(eq3)
    }

    // 5. Seed Materials
    let mat1, mat2, mat3, mat4
    try {
      mat1 = app.findFirstRecordByData('materials', 'tag', 'CIN-014-10T')
    } catch (_) {
      mat1 = new Record(materials)
      mat1.set('company_id', companyRecord.id)
      mat1.set('type', 'Cinta')
      mat1.set('tag', 'CIN-014-10T')
      mat1.set('manufacturer', 'Tecnotextil (Levtec)')
      mat1.set('model', 'Cinta Tubular Poliéster Dupla Camada')
      mat1.set('capacity', '10 Toneladas (WLL)')
      mat1.set('diameter_or_length', '6.0 metros - Fator 7:1')
      mat1.set('status', 'Disponível')
      mat1.set('last_inspection', '2025-02-01 08:00:00.000Z')
      mat1.set('validity_date', '2026-02-01 00:00:00.000Z')
      app.save(mat1)
    }

    try {
      mat2 = app.findFirstRecordByData('materials', 'tag', 'MAN-008-17T')
    } catch (_) {
      mat2 = new Record(materials)
      mat2.set('company_id', companyRecord.id)
      mat2.set('type', 'Manilhas')
      mat2.set('tag', 'MAN-008-17T')
      mat2.set('manufacturer', 'Crosby')
      mat2.set('model', 'Manilha Curva G-2130 com Porca e Cupilha')
      mat2.set('capacity', '17 Toneladas')
      mat2.set('diameter_or_length', '1.1/2 polegadas')
      mat2.set('status', 'Disponível')
      mat2.set('last_inspection', '2025-01-15 08:00:00.000Z')
      app.save(mat2)
    }

    try {
      mat3 = app.findFirstRecordByData('materials', 'tag', 'CAB-004-4P')
    } catch (_) {
      mat3 = new Record(materials)
      mat3.set('company_id', companyRecord.id)
      mat3.set('type', 'Cabos de Aço')
      mat3.set('tag', 'CAB-004-4P')
      mat3.set('manufacturer', 'Cimaf')
      mat3.set('model', 'Lingada 4 Pernas 6x25F AF com Ganchos Olhal')
      mat3.set('capacity', '25 Toneladas')
      mat3.set('diameter_or_length', '3/4 pol - 4.0 metros')
      mat3.set('status', 'Disponível')
      mat3.set('last_inspection', '2025-02-12 08:00:00.000Z')
      app.save(mat3)
    }

    try {
      mat4 = app.findFirstRecordByData('materials', 'tag', 'GAN-002-32T')
    } catch (_) {
      mat4 = new Record(materials)
      mat4.set('company_id', companyRecord.id)
      mat4.set('type', 'Ganchos')
      mat4.set('tag', 'GAN-002-32T')
      mat4.set('manufacturer', 'Gunnebo')
      mat4.set('model', 'Gancho Automático BK com trava de segurança')
      mat4.set('capacity', '32 Toneladas')
      mat4.set('status', 'Disponível')
      mat4.set('last_inspection', '2025-02-05 08:00:00.000Z')
      app.save(mat4)
    }

    // 6. Seed Checklist Templates and Items
    // Template 1: Checklist Diário Pré-Uso Guindaste Móvel
    let tpl1
    try {
      tpl1 = app.findFirstRecordByData(
        'checklist_templates',
        'title',
        'Checklist Diário Pré-Operacional de Guindaste',
      )
    } catch (_) {
      tpl1 = new Record(checklistTemplates)
      tpl1.set('company_id', companyRecord.id)
      tpl1.set('title', 'Checklist Diário Pré-Operacional de Guindaste')
      tpl1.set(
        'description',
        'Inspeção diária obrigatória antes do início das operações de içamento com guindaste telescópico.',
      )
      tpl1.set('category', 'Guindaste')
      tpl1.set('target_role', 'Operador')
      tpl1.set('active', true)
      tpl1.set('version', 1)
      app.save(tpl1)

      const itemsTpl1 = [
        {
          section: '1. Documentação e Condições Gerais',
          title: 'Tabela de carga legível e presente na cabine',
          type: 'conforme_nao_conforme',
          is_mandatory: true,
          is_critical: true,
          order_num: 1,
        },
        {
          section: '1. Documentação e Condições Gerais',
          title: 'Operador qualificado e habilitado (NR-11/NR-12)',
          type: 'sim_nao_na',
          is_mandatory: true,
          is_critical: true,
          order_num: 2,
        },
        {
          section: '2. Estrutura e Estabilização',
          title: 'Patolas / estabilizadores totalmente estendidos com calços adequados',
          type: 'conforme_nao_conforme',
          is_mandatory: true,
          is_critical: true,
          order_num: 3,
        },
        {
          section: '2. Estrutura e Estabilização',
          title: 'Nivelamento do guindaste conferido pelo nível de bolha',
          type: 'conforme_nao_conforme',
          is_mandatory: true,
          is_critical: true,
          order_num: 4,
        },
        {
          section: '3. Cabos, Moitão e Gancho',
          title: 'Cabo de aço principal sem arames rompidos, dobras ou gaiolas de passarinho',
          type: 'conforme_nao_conforme',
          is_mandatory: true,
          is_critical: true,
          order_num: 5,
        },
        {
          section: '3. Cabos, Moitão e Gancho',
          title: 'Trava de segurança do gancho funcionando perfeitamente',
          type: 'conforme_nao_conforme',
          is_mandatory: true,
          is_critical: true,
          order_num: 6,
        },
        {
          section: '3. Cabos, Moitão e Gancho',
          title: 'Sensor de fim de curso superior (Anti Two-Block / A2B) operacional',
          type: 'conforme_nao_conforme',
          is_mandatory: true,
          is_critical: true,
          order_num: 7,
        },
        {
          section: '4. Sistemas Hidráulicos e Motor',
          title: 'Ausência de vazamentos em mangueiras, cilindros e conexões hidráulicas',
          type: 'conforme_nao_conforme',
          is_mandatory: true,
          is_critical: false,
          order_num: 8,
        },
        {
          section: '4. Sistemas Hidráulicos e Motor',
          title: 'Nível de óleo do motor, hidráulico e líquido de arrefecimento',
          type: 'conforme_nao_conforme',
          is_mandatory: true,
          is_critical: false,
          order_num: 9,
        },
        {
          section: '5. Sistemas de Segurança e Alarme',
          title: 'Alarme sonoro de ré e giro da torre em funcionamento',
          type: 'conforme_nao_conforme',
          is_mandatory: true,
          is_critical: false,
          order_num: 10,
        },
        {
          section: '5. Sistemas de Segurança e Alarme',
          title: 'Anemômetro e indicador de velocidade do vento (km/h)',
          type: 'numero',
          is_mandatory: false,
          is_critical: false,
          order_num: 11,
        },
        {
          section: '5. Sistemas de Segurança e Alarme',
          title: 'Foto das sapatas instaladas e isolamento da área',
          type: 'foto_obrigatoria',
          is_mandatory: false,
          is_critical: false,
          order_num: 12,
        },
      ]

      itemsTpl1.forEach((it) => {
        const rec = new Record(checklistTemplateItems)
        rec.set('template_id', tpl1.id)
        rec.set('section', it.section)
        rec.set('title', it.title)
        rec.set('type', it.type)
        rec.set('is_mandatory', it.is_mandatory)
        rec.set('is_critical', it.is_critical)
        rec.set('order_num', it.order_num)
        app.save(rec)
      })
    }

    // Template 2: Inspeção de Acessórios de Içamento (Rigger)
    let tpl2
    try {
      tpl2 = app.findFirstRecordByData(
        'checklist_templates',
        'title',
        'Inspeção de Cintas, Cabos e Acessórios de Amarração',
      )
    } catch (_) {
      tpl2 = new Record(checklistTemplates)
      tpl2.set('company_id', companyRecord.id)
      tpl2.set('title', 'Inspeção de Cintas, Cabos e Acessórios de Amarração')
      tpl2.set(
        'description',
        'Verificação técnica detalhada de lingadas, manilhas, cintas e olhais antes do acoplamento à carga.',
      )
      tpl2.set('category', 'Acessórios e Materiais')
      tpl2.set('target_role', 'Rigger')
      tpl2.set('active', true)
      tpl2.set('version', 1)
      app.save(tpl2)

      const itemsTpl2 = [
        {
          section: '1. Cintas Sintéticas de Poliéster',
          title: 'Etiqueta de identificação com WLL e fator de segurança legível',
          type: 'conforme_nao_conforme',
          is_mandatory: true,
          is_critical: true,
          order_num: 1,
        },
        {
          section: '1. Cintas Sintéticas de Poliéster',
          title: 'Ausência de cortes, abrasão severa, queimaduras químicas ou nós',
          type: 'conforme_nao_conforme',
          is_mandatory: true,
          is_critical: true,
          order_num: 2,
        },
        {
          section: '1. Cintas Sintéticas de Poliéster',
          title: 'Uso de proteções de cantos vivos nos pontos de contato',
          type: 'sim_nao_na',
          is_mandatory: true,
          is_critical: false,
          order_num: 3,
        },
        {
          section: '2. Manilhas e Pinos',
          title: 'Corpo da manilha sem deformações, trincas ou redução de diâmetro',
          type: 'conforme_nao_conforme',
          is_mandatory: true,
          is_critical: true,
          order_num: 4,
        },
        {
          section: '2. Manilhas e Pinos',
          title: 'Pino original rosqueado até o batente com cupilha de travamento',
          type: 'conforme_nao_conforme',
          is_mandatory: true,
          is_critical: true,
          order_num: 5,
        },
        {
          section: '3. Cabos de Aço e Estropos',
          title: 'Olhais com sapatilho e trançado ou presilhas prensadas intactas',
          type: 'conforme_nao_conforme',
          is_mandatory: true,
          is_critical: true,
          order_num: 6,
        },
        {
          section: '4. Ângulos e Capacidade',
          title: 'Ângulo de abertura das pernas da lingada menor que 60 graus',
          type: 'conforme_nao_conforme',
          is_mandatory: true,
          is_critical: true,
          order_num: 7,
        },
        {
          section: '4. Ângulos e Capacidade',
          title: 'Peso estimado da carga informado (Ton)',
          type: 'numero',
          is_mandatory: true,
          is_critical: false,
          order_num: 8,
        },
      ]

      itemsTpl2.forEach((it) => {
        const rec = new Record(checklistTemplateItems)
        rec.set('template_id', tpl2.id)
        rec.set('section', it.section)
        rec.set('title', it.title)
        rec.set('type', it.type)
        rec.set('is_mandatory', it.is_mandatory)
        rec.set('is_critical', it.is_critical)
        rec.set('order_num', it.order_num)
        app.save(rec)
      })
    }

    // Template 3: Checklist Caminhão Munck Pré-Uso
    let tpl3
    try {
      tpl3 = app.findFirstRecordByData(
        'checklist_templates',
        'title',
        'Checklist Pré-Operacional Caminhão Munck',
      )
    } catch (_) {
      tpl3 = new Record(checklistTemplates)
      tpl3.set('company_id', companyRecord.id)
      tpl3.set('title', 'Checklist Pré-Operacional Caminhão Munck')
      tpl3.set('description', 'Inspeção operacional e mecânica para guindauto / caminhão munck.')
      tpl3.set('category', 'Munck')
      tpl3.set('target_role', 'Operador')
      tpl3.set('active', true)
      tpl3.set('version', 1)
      app.save(tpl3)

      const itemsTpl3 = [
        {
          section: '1. Veículo e Estabilizadores',
          title: 'Freio de estacionamento acionado e calços nas rodas colocados',
          type: 'sim_nao_na',
          is_mandatory: true,
          is_critical: true,
          order_num: 1,
        },
        {
          section: '1. Veículo e Estabilizadores',
          title: 'Sapatas dianteiras e traseiras com extensão correta',
          type: 'conforme_nao_conforme',
          is_mandatory: true,
          is_critical: true,
          order_num: 2,
        },
        {
          section: '2. Braço e Lança Hidráulica',
          title: 'Extensões telescópicas sem folgas anormais ou empeno',
          type: 'conforme_nao_conforme',
          is_mandatory: true,
          is_critical: false,
          order_num: 3,
        },
        {
          section: '2. Braço e Lança Hidráulica',
          title: 'Controle remoto / comando manual com parada de emergência ativa',
          type: 'conforme_nao_conforme',
          is_mandatory: true,
          is_critical: true,
          order_num: 4,
        },
        {
          section: '3. Área e Sinalização',
          title: 'Isolamento de raio de tombamento e cones instalados',
          type: 'sim_nao_na',
          is_mandatory: true,
          is_critical: false,
          order_num: 5,
        },
      ]

      itemsTpl3.forEach((it) => {
        const rec = new Record(checklistTemplateItems)
        rec.set('template_id', tpl3.id)
        rec.set('section', it.section)
        rec.set('title', it.title)
        rec.set('type', it.type)
        rec.set('is_mandatory', it.is_mandatory)
        rec.set('is_critical', it.is_critical)
        rec.set('order_num', it.order_num)
        app.save(rec)
      })
    }

    // 7. Seed Sample Executed Checklists
    try {
      const chk1 = app.findFirstRecordByData('checklists', 'code', 'CHK-2025-001')
    } catch (_) {
      if (tpl1 && eq1 && client1) {
        const chk1 = new Record(checklists)
        chk1.set('company_id', companyRecord.id)
        chk1.set('template_id', tpl1.id)
        chk1.set('client_id', client1.id)
        chk1.set('equipment_id', eq1.id)
        chk1.set('user_id', adminUser.id)
        chk1.set('code', 'CHK-2025-001')
        chk1.set('title', 'Içamento do Módulo Skid Unidade U-22')
        chk1.set('location', 'Refinaria RPBC - Setor Norte')
        chk1.set('operation_type', 'Içamento Crítico')
        chk1.set('scheduled_date', '2025-02-24 07:30:00.000Z')
        chk1.set('started_at', '2025-02-24 07:45:00.000Z')
        chk1.set('completed_at', '2025-02-24 08:15:00.000Z')
        chk1.set('status', 'Concluído')
        chk1.set('risk_level', 'Alto')
        chk1.set('inspector_name', 'Adriano Gestor Master')
        chk1.set(
          'notes',
          'Operação liberada. Vento verificado em 12 km/h. Raio de giro devidamente isolado.',
        )
        chk1.set('sync_status', 'synced')
        app.save(chk1)

        // Add some responses for chk1
        const resp1 = new Record(checklistResponses)
        resp1.set('checklist_id', chk1.id)
        resp1.set('item_title', 'Tabela de carga legível e presente na cabine')
        resp1.set('item_section', '1. Documentação e Condições Gerais')
        resp1.set('status', 'C')
        resp1.set('observation', 'Tabela original em português plastificada')
        resp1.set('is_critical_fail', false)
        app.save(resp1)

        const resp2 = new Record(checklistResponses)
        resp2.set('checklist_id', chk1.id)
        resp2.set(
          'item_title',
          'Sensor de fim de curso superior (Anti Two-Block / A2B) operacional',
        )
        resp2.set('item_section', '3. Cabos, Moitão e Gancho')
        resp2.set('status', 'C')
        resp2.set(
          'observation',
          'Testado subindo o moitão manualmente até o batente, corte elétrico ativo.',
        )
        resp2.set('is_critical_fail', false)
        app.save(resp2)
      }
    }

    // Seed a pending checklist
    try {
      const chk2 = app.findFirstRecordByData('checklists', 'code', 'CHK-2025-002')
    } catch (_) {
      if (tpl2 && mat1 && client2) {
        const chk2 = new Record(checklists)
        chk2.set('company_id', companyRecord.id)
        chk2.set('template_id', tpl2.id)
        chk2.set('client_id', client2.id)
        chk2.set('material_id', mat1.id)
        chk2.set('user_id', adminUser.id)
        chk2.set('code', 'CHK-2025-002')
        chk2.set('title', 'Inspeção de Amarração de Tubulações 24"')
        chk2.set('location', 'Vale Terminal Marítimo - Cais 2')
        chk2.set('operation_type', 'Carga e Descarga')
        chk2.set('scheduled_date', '2025-02-25 09:00:00.000Z')
        chk2.set('status', 'Em Andamento')
        chk2.set('risk_level', 'Médio')
        chk2.set('inspector_name', 'Lucas Ferreira (Rigger)')
        chk2.set('notes', 'Aguardando posicionamento da carreta prancha.')
        chk2.set('sync_status', 'synced')
        app.save(chk2)
      }
    }
  },
  (app) => {
    // down logic
  },
)
