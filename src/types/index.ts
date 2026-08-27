export interface Company {
  id: string
  name: string
  trade_name?: string
  cnpj?: string
  phone?: string
  email?: string
  address?: string
  city?: string
  state?: string
  active?: boolean
  created?: string
  updated?: string
}

export type UserRole =
  | 'superadmin'
  | 'admin'
  | 'gestor'
  | 'supervisor'
  | 'rigger'
  | 'sinaleiro'
  | 'operador'
  | 'cliente'

export type SystemModuleKey =
  | 'checklists'
  | 'templates'
  | 'equipment'
  | 'materials'
  | 'clients'
  | 'users'
  | 'company'
  | 'audit'

export interface ModulePermission {
  read: boolean
  edit: boolean
  delete: boolean
}

export type UserPermissions = Record<SystemModuleKey, ModulePermission>

export interface AppUser {
  id: string
  name: string
  username?: string
  email?: string
  company_id?: string
  client_id?: string
  role: UserRole
  cpf?: string
  phone?: string
  active?: boolean
  avatar?: string
  permissions?: UserPermissions
  created?: string
  updated?: string
  expand?: {
    company_id?: Company
    client_id?: Client
  }
}
export interface Client {
  id: string
  company_id: string
  name: string
  trade_name?: string
  document?: string
  contact_name?: string
  phone?: string
  email?: string
  address?: string
  city?: string
  state?: string
  notes?: string
  active?: boolean
  created?: string
  updated?: string
}

export type EquipmentType =
  | 'Guindaste'
  | 'Munck'
  | 'Caminhão'
  | 'Empilhadeira'
  | 'Plataforma Elevatória'
  | 'Outro'
export type EquipmentStatus = 'Operacional' | 'Em Manutenção' | 'Inativo' | 'Aguardando Inspeção'

export interface Equipment {
  id: string
  company_id: string
  type: EquipmentType
  manufacturer: string
  model: string
  capacity: string
  license_plate?: string
  serial_number?: string
  year?: number
  status?: EquipmentStatus
  last_inspection?: string
  notes?: string
  created?: string
  updated?: string
}

export type MaterialType =
  | 'Cinta'
  | 'Cabos de Aço'
  | 'Manilhas'
  | 'Ganchos'
  | 'Olhais'
  | 'Moitões'
  | 'Estropos'
  | 'Balancim'
  | 'Outro'
export type MaterialStatus =
  | 'Disponível'
  | 'Em Uso'
  | 'Em Inspeção'
  | 'Danificado / Descarte'
  | 'Quarentena'

export interface Material {
  id: string
  company_id: string
  type: MaterialType
  tag: string
  manufacturer?: string
  model?: string
  capacity: string
  diameter_or_length?: string
  status?: MaterialStatus
  last_inspection?: string
  validity_date?: string
  notes?: string
  created?: string
  updated?: string
}

export type TemplateCategory =
  | 'Guindaste'
  | 'Munck'
  | 'Acessórios e Materiais'
  | 'Plano de Rigging'
  | 'Segurança e Sinalização'
  | 'Geral de Içamento'
export type TargetRole = 'Todos' | 'Operador' | 'Rigger' | 'Sinaleiro' | 'Supervisor'
export type ItemType =
  | 'conforme_nao_conforme'
  | 'sim_nao_na'
  | 'texto'
  | 'numero'
  | 'foto_obrigatoria'

export interface ChecklistTemplate {
  id: string
  company_id: string
  title: string
  description?: string
  category: TemplateCategory
  target_role?: TargetRole
  active?: boolean
  version?: number
  created?: string
  updated?: string
}

export interface ChecklistItemGroup {
  id: string
  company?: string
  template: string
  name: string
  sort_order?: number
  created?: string
  updated?: string
}

export interface ChecklistTemplateItem {
  id: string
  template_id: string
  section?: string
  group?: string
  title: string
  description?: string
  type: ItemType
  is_mandatory?: boolean
  is_critical?: boolean
  order_num?: number
  sort_order?: number
  created?: string
  updated?: string
  expand?: {
    group?: ChecklistItemGroup
  }
}

export type ChecklistStatus = 'Pendente' | 'Em Andamento' | 'Concluído' | 'Reprovado'
export type RiskLevel = 'Baixo' | 'Médio' | 'Alto' | 'Crítico'
export type SyncStatus = 'synced' | 'pending_sync' | 'conflict'
export type ResponseStatus = 'C' | 'NC' | 'NA' | 'SIM' | 'NAO' | 'PENDENTE'

export interface Checklist {
  id: string
  local_id?: string
  company_id: string
  template_id: string
  client_id?: string
  equipment_id?: string
  material_id?: string
  user_id: string
  code?: string
  title: string
  location?: string
  operation_type?: string
  scheduled_date?: string
  started_at?: string
  completed_at?: string
  status: ChecklistStatus
  risk_level?: RiskLevel
  notes?: string
  inspector_name?: string
  signature_data?: string
  filled_by_name?: string
  filled_by_signature?: string
  sync_status?: SyncStatus
  created?: string
  updated?: string
  // Expanded references for fast offline lookup / display
  expand?: {
    template_id?: ChecklistTemplate
    client_id?: Client
    equipment_id?: Equipment
    material_id?: Material
    user_id?: AppUser
  }
}

export interface ChecklistResponse {
  id: string
  checklist_id: string
  item_id?: string
  item_title: string
  item_section?: string
  status: ResponseStatus
  observation?: string
  photo_url?: string
  value?: string
  is_critical_fail?: boolean
  created?: string
  updated?: string
  // offline local id
  local_id?: string
}

export interface SyncLogEntry {
  id: string
  timestamp: number
  type: 'pull' | 'push' | 'error' | 'conflict' | 'info'
  message: string
  details?: any
  success: boolean
}

export interface OfflineSyncQueueItem {
  id: string
  entity:
    | 'checklists'
    | 'checklist_responses'
    | 'equipment'
    | 'materials'
    | 'clients'
    | 'templates'
    | 'checklist_item_groups'
  action: 'create' | 'update' | 'delete' | 'batch_responses'
  payload: any
  timestamp: number
  attempts: number
  error?: string
}

export type AuditAction =
  | 'access_denied'
  | 'permission_changed'
  | 'user_deleted'
  | 'company_deleted'
  | 'checklist_deleted'
  | 'equipment_deleted'
  | 'material_deleted'
  | 'client_deleted'
  | 'template_deleted'
  | 'user_created'
  | 'user_updated'
  | string

export interface AuditLog {
  id: string
  company?: string
  user?: string
  user_name?: string
  action: AuditAction
  module?: string
  details?: string
  metadata?: Record<string, any>
  created: string
  updated?: string
  expand?: {
    company?: Company
    user?: AppUser
  }
}

export interface AuditLogFilters {
  startDate?: string
  endDate?: string
  action?: string
  module?: string
}
