import pb from '@/lib/pocketbase/client'
import { AuditLog, AuditLogFilters } from '@/types'

export interface PaginatedAuditLogs {
  items: AuditLog[]
  page: number
  perPage: number
  totalItems: number
  totalPages: number
}

export const auditLogService = {
  /**
   * Fetches audit logs with optional filters and pagination
   */
  async fetchAuditLogs(
    companyId?: string,
    filters?: AuditLogFilters,
    page: number = 1,
    perPage: number = 20,
  ): Promise<PaginatedAuditLogs> {
    try {
      const filterConditions: string[] = []

      // Multi-tenant company filter if specified
      if (companyId) {
        filterConditions.push(`company = '${companyId}'`)
      }

      // Filter by action
      if (filters?.action && filters.action !== 'all') {
        filterConditions.push(`action = '${filters.action}'`)
      }

      // Filter by module
      if (filters?.module && filters.module !== 'all') {
        filterConditions.push(`module = '${filters.module}'`)
      }

      // Filter by date range (created >= start and created <= end)
      if (filters?.startDate) {
        const startIso = new Date(`${filters.startDate}T00:00:00.000Z`).toISOString()
        filterConditions.push(`created >= '${startIso}'`)
      }
      if (filters?.endDate) {
        const endIso = new Date(`${filters.endDate}T23:59:59.999Z`).toISOString()
        filterConditions.push(`created <= '${endIso}'`)
      }

      const filterQuery = filterConditions.join(' && ')

      const result = await pb.collection('audit_logs').getList<AuditLog>(page, perPage, {
        filter: filterQuery || undefined,
        sort: '-created',
        expand: 'company,user',
      })

      return {
        items: result.items,
        page: result.page,
        perPage: result.perPage,
        totalItems: result.totalItems,
        totalPages: result.totalPages,
      }
    } catch (error) {
      console.error('Error fetching audit logs:', error)
      return {
        items: [],
        page: 1,
        perPage,
        totalItems: 0,
        totalPages: 1,
      }
    }
  },

  /**
   * Sends an access denied log to the backend audit hook
   */
  async logAccessDenied(module: string, path: string): Promise<void> {
    try {
      await pb.send('/api/audit/access-denied', {
        method: 'POST',
        body: {
          module,
          path,
        },
      })
    } catch (error) {
      // Access denial logging should fail silently to not interrupt UI UX
      console.warn('Could not register access_denied audit log:', error)
    }
  },
}
