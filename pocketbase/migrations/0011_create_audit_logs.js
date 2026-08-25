migrate(
  (app) => {
    const companies = app.findCollectionByNameOrId('companies')
    const users = app.findCollectionByNameOrId('_pb_users_auth_')

    // Rule: only admin, superadmin, and gestor can list/view audit logs
    // Users with role admin, superadmin, or gestor
    const accessRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'superadmin' || @request.auth.role = 'gestor')"

    const auditLogs = new Collection({
      name: 'audit_logs',
      type: 'base',
      listRule: accessRule,
      viewRule: accessRule,
      createRule: null, // Only via hooks/backend
      updateRule: null, // Immutable
      deleteRule: null, // Immutable
      fields: [
        {
          name: 'company',
          type: 'relation',
          collectionId: companies.id,
          maxSelect: 1,
          required: false,
        },
        {
          name: 'user',
          type: 'relation',
          collectionId: users.id,
          maxSelect: 1,
          required: false,
        },
        {
          name: 'user_name',
          type: 'text',
          required: false,
        },
        {
          name: 'action',
          type: 'text',
          required: true,
        },
        {
          name: 'module',
          type: 'text',
          required: false,
        },
        {
          name: 'details',
          type: 'text',
          required: false,
        },
        {
          name: 'metadata',
          type: 'json',
          required: false,
        },
        {
          name: 'created',
          type: 'autodate',
          onCreate: true,
          onUpdate: false,
        },
        {
          name: 'updated',
          type: 'autodate',
          onCreate: true,
          onUpdate: true,
        },
      ],
      indexes: [
        'CREATE INDEX idx_audit_logs_company ON audit_logs (company)',
        'CREATE INDEX idx_audit_logs_user ON audit_logs (user)',
        'CREATE INDEX idx_audit_logs_action ON audit_logs (action)',
        'CREATE INDEX idx_audit_logs_module ON audit_logs (module)',
        'CREATE INDEX idx_audit_logs_created ON audit_logs (created DESC)',
      ],
    })

    app.save(auditLogs)
  },
  (app) => {
    try {
      const auditLogs = app.findCollectionByNameOrId('audit_logs')
      app.delete(auditLogs)
    } catch (_) {}
  },
)
