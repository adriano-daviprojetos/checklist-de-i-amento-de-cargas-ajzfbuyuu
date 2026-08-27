import pb from '@/lib/pocketbase/client'
import { dbGetAll, dbGetById, dbPut, dbPutMany, dbDelete, dbGetByIndex } from '@/lib/offline/db'
import { syncService } from '@/lib/offline/sync-service'
import {
  Checklist,
  ChecklistResponse,
  ChecklistTemplate,
  ChecklistTemplateItem,
  ChecklistItemGroup,
  Equipment,
  Material,
  Client,
  Company,
  AppUser,
} from '@/types'

export class AppDataService {
  // --- Checklists ---
  static async getChecklists(companyId?: string, isOnline = true): Promise<Checklist[]> {
    const authUser = pb.authStore.record as any
    const isClientRole = authUser?.role === 'cliente'
    const clientScopeId = isClientRole ? authUser?.client_id : undefined

    // 1. Try local IndexedDB first for instant UI response
    const local = await dbGetAll<Checklist>('checklists')
    let filteredLocal = companyId ? local.filter((c) => c.company_id === companyId) : local
    if (clientScopeId) {
      filteredLocal = filteredLocal.filter((c) => c.client_id === clientScopeId)
    }

    if (isOnline && pb.authStore.isValid) {
      try {
        const filterParts: string[] = []
        if (companyId) filterParts.push(`company_id='${companyId}'`)
        if (clientScopeId) filterParts.push(`client_id='${clientScopeId}'`)
        const filter = filterParts.length > 0 ? filterParts.join(' && ') : ''

        const onlineList = await pb.collection('checklists').getFullList<Checklist>({
          filter: filter || undefined,
          sort: '-created',
          expand: 'template_id,client_id,equipment_id,material_id,user_id',
        })
        // Merge with local queue
        const pendingLocals = filteredLocal.filter((c) => c.sync_status === 'pending_sync')
        const onlineIds = new Set(onlineList.map((c) => c.id))
        const combined = [...onlineList, ...pendingLocals.filter((c) => !onlineIds.has(c.id))]

        // Save to DB in background
        dbPutMany('checklists', onlineList)
        return combined.sort(
          (a, b) => new Date(b.created || 0).getTime() - new Date(a.created || 0).getTime(),
        )
      } catch (err) {
        console.warn('Could not fetch online checklists, using offline data:', err)
      }
    }

    return filteredLocal.sort(
      (a, b) => new Date(b.created || 0).getTime() - new Date(a.created || 0).getTime(),
    )
  }

  static async getChecklistById(
    id: string,
    isOnline = true,
  ): Promise<{ checklist: Checklist | null; responses: ChecklistResponse[] }> {
    let checklist = await dbGetById<Checklist>('checklists', id)
    let responses = await dbGetByIndex<ChecklistResponse>('checklist_responses', 'checklist_id', id)

    if (isOnline && pb.authStore.isValid && (!id.startsWith('local_') || !checklist)) {
      try {
        const onlineRecord = await pb.collection('checklists').getOne<Checklist>(id, {
          expand: 'template_id,client_id,equipment_id,material_id,user_id',
        })
        if (onlineRecord) {
          checklist = onlineRecord
          await dbPut('checklists', onlineRecord)
        }

        const onlineResponses = await pb
          .collection('checklist_responses')
          .getFullList<ChecklistResponse>({
            filter: `checklist_id='${id}'`,
          })
        if (onlineResponses.length > 0) {
          responses = onlineResponses
          await dbPutMany('checklist_responses', onlineResponses)
        }
      } catch (err) {
        console.warn(`Online getChecklistById(${id}) fallback to local DB`, err)
      }
    }

    return { checklist, responses }
  }

  static async saveChecklist(
    checklist: Partial<Checklist>,
    responses: Partial<ChecklistResponse>[],
    isOnline: boolean,
  ) {
    return await syncService.saveChecklistLocally(checklist, responses, isOnline)
  }

  static async saveChecklistResponses(
    checklistId: string,
    responses: Array<Partial<ChecklistResponse>>,
    isOnline = true,
  ): Promise<ChecklistResponse[]> {
    if (!checklistId) throw new Error('checklistId é obrigatório')

    // Always update/put in IndexedDB for offline support
    const localResponses: ChecklistResponse[] = responses.map((r, idx) => ({
      id: r.id && !r.id.startsWith('temp_') ? r.id : `resp_${checklistId}_${idx}_${Date.now()}`,
      checklist_id: checklistId,
      item_id: r.item_id,
      item_title: r.item_title || '',
      item_section: r.item_section || '',
      status: (r.status as any) || 'PENDENTE',
      observation: r.observation || '',
      photo_url: r.photo_url || '',
      value: r.value || '',
      is_critical_fail: Boolean(r.is_critical_fail),
      created: r.created || new Date().toISOString(),
      updated: new Date().toISOString(),
    }))

    // Clean old local responses for this checklist in IndexedDB
    const existing = await dbGetByIndex<ChecklistResponse>(
      'checklist_responses',
      'checklist_id',
      checklistId,
    )
    for (const item of existing) {
      await dbDelete('checklist_responses', item.id)
    }
    await dbPutMany('checklist_responses', localResponses)

    if (isOnline && pb.authStore.isValid && !checklistId.startsWith('local_')) {
      try {
        const payload = {
          checklist_id: checklistId,
          responses: responses.map((r) => ({
            item_id:
              r.item_id &&
              !r.item_id.startsWith('item_') &&
              !r.item_id.startsWith('local_') &&
              !r.item_id.startsWith('temp_')
                ? r.item_id
                : undefined,
            item_title: r.item_title || '',
            item_section: r.item_section || '',
            status: r.status || 'PENDENTE',
            observation: r.observation || '',
            photo_url: r.photo_url || '',
            value: r.value || '',
            is_critical_fail: Boolean(r.is_critical_fail),
          })),
        }

        const res = await syncService.sendBatchChecklistResponses(
          payload.checklist_id,
          payload.responses,
        )

        if (res && Array.isArray(res.items)) {
          // Replace local cache with authoritative server records
          for (const lr of localResponses) {
            await dbDelete('checklist_responses', lr.id)
          }
          await dbPutMany('checklist_responses', res.items)
          return res.items
        }
      } catch (err) {
        console.warn('Online batch save checklist responses failed, offline copy saved:', err)
      }
    }

    return localResponses
  }

  static async deleteChecklist(id: string, isOnline: boolean): Promise<void> {
    await dbDelete('checklists', id)
    if (isOnline && !id.startsWith('local_')) {
      try {
        await pb.collection('checklists').delete(id)
      } catch (err) {
        console.warn('Failed to delete checklist online', err)
      }
    }
  }

  // --- Equipment ---
  static async getEquipment(companyId?: string, isOnline = true): Promise<Equipment[]> {
    const local = await dbGetAll<Equipment>('equipment')
    const filtered = companyId ? local.filter((e) => e.company_id === companyId) : local

    if (isOnline && pb.authStore.isValid) {
      try {
        const list = await pb.collection('equipment').getFullList<Equipment>({
          filter: companyId ? `company_id='${companyId}'` : undefined,
          sort: 'manufacturer,model',
        })
        await dbPutMany('equipment', list)
        return list
      } catch (err) {
        console.warn('Online equipment fetch failed:', err)
      }
    }
    return filtered
  }

  static async saveEquipment(item: Partial<Equipment>, isOnline: boolean): Promise<Equipment> {
    const userCompId = item.company_id || (pb.authStore.record as any)?.company_id || ''
    const itemWithCompany = { ...item, company_id: userCompId }
    const id = itemWithCompany.id || `eq_${Date.now()}`
    const fullItem = { ...itemWithCompany, id } as Equipment
    await dbPut('equipment', fullItem)

    if (isOnline && pb.authStore.isValid) {
      if (!itemWithCompany.id || itemWithCompany.id.startsWith('eq_')) {
        const { id: _ignoredId, ...createData } = itemWithCompany
        const res = await pb.collection('equipment').create(createData)
        await dbDelete('equipment', id)
        await dbPut('equipment', res as unknown as Equipment)
        return res as unknown as Equipment
      } else {
        const { id: updateId, ...updateData } = itemWithCompany
        const res = await pb.collection('equipment').update(updateId!, updateData)
        await dbPut('equipment', res as unknown as Equipment)
        return res as unknown as Equipment
      }
    }
    return fullItem
  }

  static async deleteEquipment(id: string, isOnline: boolean): Promise<void> {
    await dbDelete('equipment', id)
    if (isOnline && !id.startsWith('eq_')) {
      await pb.collection('equipment').delete(id)
    }
  }

  // --- Materials ---
  static async getMaterials(companyId?: string, isOnline = true): Promise<Material[]> {
    const local = await dbGetAll<Material>('materials')
    const filtered = companyId ? local.filter((m) => m.company_id === companyId) : local

    if (isOnline && pb.authStore.isValid) {
      try {
        const list = await pb.collection('materials').getFullList<Material>({
          filter: companyId ? `company_id='${companyId}'` : undefined,
          sort: 'tag',
        })
        await dbPutMany('materials', list)
        return list
      } catch (err) {
        console.warn('Online materials fetch failed:', err)
      }
    }
    return filtered
  }

  static async saveMaterial(item: Partial<Material>, isOnline: boolean): Promise<Material> {
    const userCompId = item.company_id || (pb.authStore.record as any)?.company_id || ''
    const itemWithCompany = { ...item, company_id: userCompId }
    const id = itemWithCompany.id || `mat_${Date.now()}`
    const fullItem = { ...itemWithCompany, id } as Material
    await dbPut('materials', fullItem)

    if (isOnline && pb.authStore.isValid) {
      if (!itemWithCompany.id || itemWithCompany.id.startsWith('mat_')) {
        const { id: _ignoredId, ...createData } = itemWithCompany
        const res = await pb.collection('materials').create(createData)
        await dbDelete('materials', id)
        await dbPut('materials', res as unknown as Material)
        return res as unknown as Material
      } else {
        const { id: updateId, ...updateData } = itemWithCompany
        const res = await pb.collection('materials').update(updateId!, updateData)
        await dbPut('materials', res as unknown as Material)
        return res as unknown as Material
      }
    }
    return fullItem
  }

  static async deleteMaterial(id: string, isOnline: boolean): Promise<void> {
    await dbDelete('materials', id)
    if (isOnline && !id.startsWith('mat_')) {
      await pb.collection('materials').delete(id)
    }
  }

  // --- Clients ---
  static async getClients(companyId?: string, isOnline = true): Promise<Client[]> {
    const authUser = pb.authStore.record as any
    const isClientRole = authUser?.role === 'cliente'
    const clientScopeId = isClientRole ? authUser?.client_id : undefined

    const local = await dbGetAll<Client>('clients')
    let filtered = companyId ? local.filter((c) => c.company_id === companyId) : local
    if (clientScopeId) {
      filtered = filtered.filter((c) => c.id === clientScopeId)
    }

    if (isOnline && pb.authStore.isValid) {
      try {
        const filterParts: string[] = []
        if (companyId) filterParts.push(`company_id='${companyId}'`)
        if (clientScopeId) filterParts.push(`id='${clientScopeId}'`)
        const filter = filterParts.length > 0 ? filterParts.join(' && ') : undefined

        const list = await pb.collection('clients').getFullList<Client>({
          filter,
          sort: 'name',
        })
        await dbPutMany('clients', list)
        return list
      } catch (err) {
        console.warn('Online clients fetch failed, fallback to offline:', err)
      }
    }
    return filtered
  }
  static async saveClient(item: Partial<Client>, isOnline: boolean): Promise<Client> {
    const userCompId = item.company_id || (pb.authStore.record as any)?.company_id || ''
    const itemWithCompany = { ...item, company_id: userCompId }
    const id = itemWithCompany.id || `cli_${Date.now()}`
    const fullItem = { ...itemWithCompany, id } as Client
    await dbPut('clients', fullItem)

    if (isOnline && pb.authStore.isValid) {
      if (!itemWithCompany.id || itemWithCompany.id.startsWith('cli_')) {
        const { id: _ignoredId, ...createData } = itemWithCompany
        const res = await pb.collection('clients').create(createData)
        await dbDelete('clients', id)
        await dbPut('clients', res as unknown as Client)
        return res as unknown as Client
      } else {
        const { id: updateId, ...updateData } = itemWithCompany
        const res = await pb.collection('clients').update(updateId!, updateData)
        await dbPut('clients', res as unknown as Client)
        return res as unknown as Client
      }
    }
    return fullItem
  }

  static async deleteClient(id: string, isOnline: boolean): Promise<void> {
    await dbDelete('clients', id)
    if (isOnline && !id.startsWith('cli_')) {
      await pb.collection('clients').delete(id)
    }
  }

  // --- Templates & Items ---
  static async getTemplates(companyId?: string, isOnline = true): Promise<ChecklistTemplate[]> {
    const local = await dbGetAll<ChecklistTemplate>('checklist_templates')
    const userRole = ((pb.authStore.record as any)?.role || '').toLowerCase()

    const restrictedRoles = ['supervisor', 'sinaleiro', 'rigger', 'operador']
    const isRestrictedRole = restrictedRoles.includes(userRole)

    // Build filter expressions
    const filterParts: string[] = []
    if (companyId) {
      filterParts.push(`company_id='${companyId}'`)
    }
    if (isRestrictedRole) {
      // Map user role to capitalized value used in target_role (or check lowercase if needed)
      // PocketBase equality check. The options are 'Supervisor', 'Sinaleiro', 'Rigger', 'Operador', 'Todos'
      const capitalizedRole = userRole.charAt(0).toUpperCase() + userRole.slice(1)
      filterParts.push(`(target_role='${capitalizedRole}' || target_role='Todos')`)
    }

    const onlineFilter = filterParts.length > 0 ? filterParts.join(' && ') : undefined

    // Offline filter
    let filtered = local
    if (companyId) {
      filtered = filtered.filter((t) => t.company_id === companyId)
    }
    if (isRestrictedRole) {
      filtered = filtered.filter((t) => {
        const target = (t.target_role || '').toLowerCase()
        return target === userRole || target === 'todos' || !t.target_role
      })
    }

    if (isOnline && pb.authStore.isValid) {
      try {
        const list = await pb.collection('checklist_templates').getFullList<ChecklistTemplate>({
          filter: onlineFilter,
          sort: 'title',
        })
        await dbPutMany('checklist_templates', list)
        return list
      } catch (err) {
        console.warn('Online templates fetch failed:', err)
      }
    }
    return filtered
  }

  // --- Item Groups ---
  static async getItemGroups(templateId: string, isOnline = true): Promise<ChecklistItemGroup[]> {
    const local = await dbGetByIndex<ChecklistItemGroup>(
      'checklist_item_groups',
      'template',
      templateId,
    )

    if (isOnline && pb.authStore.isValid && !templateId.startsWith('tpl_')) {
      try {
        const list = await pb.collection('checklist_item_groups').getFullList<ChecklistItemGroup>({
          filter: `template='${templateId}'`,
          sort: 'sort_order,created',
        })
        await dbPutMany('checklist_item_groups', list)
        return list
      } catch (err) {
        console.warn('Online item groups fetch failed:', err)
      }
    }
    return local.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
  }

  static async saveItemGroup(
    group: Partial<ChecklistItemGroup>,
    isOnline = true,
  ): Promise<ChecklistItemGroup> {
    const groupId = group.id || `grp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    const fullGroup: ChecklistItemGroup = {
      id: groupId,
      company: group.company,
      template: group.template || '',
      name: group.name || 'Novo Grupo',
      sort_order: group.sort_order ?? 0,
    }

    await dbPut('checklist_item_groups', fullGroup)

    if (isOnline && pb.authStore.isValid && !group.template?.startsWith('tpl_')) {
      try {
        if (!group.id || group.id.startsWith('grp_') || group.id.startsWith('temp_')) {
          const { id: _ignoredId, ...createData } = fullGroup
          const created = await pb.collection('checklist_item_groups').create(createData)
          await dbDelete('checklist_item_groups', groupId)
          await dbPut('checklist_item_groups', created as unknown as ChecklistItemGroup)
          return created as unknown as ChecklistItemGroup
        } else {
          const { id: _ignoredId, ...updateData } = fullGroup
          const updated = await pb.collection('checklist_item_groups').update(group.id, updateData)
          await dbPut('checklist_item_groups', updated as unknown as ChecklistItemGroup)
          return updated as unknown as ChecklistItemGroup
        }
      } catch (err) {
        console.warn('Online save item group failed:', err)
      }
    }
    return fullGroup
  }

  static async deleteItemGroup(groupId: string, isOnline = true): Promise<void> {
    await dbDelete('checklist_item_groups', groupId)

    // Unassign group from items locally
    const items = await dbGetByIndex<ChecklistTemplateItem>(
      'checklist_template_items',
      'group',
      groupId,
    )
    for (const item of items) {
      item.group = undefined
      await dbPut('checklist_template_items', item)
    }

    if (isOnline && pb.authStore.isValid && !groupId.startsWith('grp_')) {
      try {
        // Also update items on backend if any
        const onlineItems = await pb.collection('checklist_template_items').getFullList({
          filter: `group='${groupId}'`,
        })
        for (const item of onlineItems) {
          await pb.collection('checklist_template_items').update(item.id, { group: null })
        }
        await pb.collection('checklist_item_groups').delete(groupId)
      } catch (err) {
        console.warn('Online delete item group failed:', err)
      }
    }
  }

  static async getTemplateItems(
    templateId: string,
    isOnline = true,
  ): Promise<ChecklistTemplateItem[]> {
    const local = await dbGetByIndex<ChecklistTemplateItem>(
      'checklist_template_items',
      'template_id',
      templateId,
    )

    if (isOnline && pb.authStore.isValid && !templateId.startsWith('tpl_')) {
      try {
        const list = await pb
          .collection('checklist_template_items')
          .getFullList<ChecklistTemplateItem>({
            filter: `template_id='${templateId}'`,
            sort: 'sort_order,order_num',
            expand: 'group',
          })
        await dbPutMany('checklist_template_items', list)
        return list
      } catch (err) {
        console.warn('Online template items fetch failed:', err)
      }
    }
    return local.sort(
      (a, b) => (a.sort_order ?? a.order_num ?? 0) - (b.sort_order ?? b.order_num ?? 0),
    )
  }

  static async saveTemplate(
    template: Partial<ChecklistTemplate>,
    items: Partial<ChecklistTemplateItem>[],
    isOnline: boolean,
    groups?: Partial<ChecklistItemGroup>[],
  ): Promise<ChecklistTemplate> {
    const userCompId = template.company_id || (pb.authStore.record as any)?.company_id || ''
    const tplId = template.id || `tpl_${Date.now()}`
    const fullTpl: ChecklistTemplate = {
      id: tplId,
      company_id: userCompId,
      title: template.title || 'Novo Modelo',
      description: template.description || '',
      category: template.category || 'Geral de Içamento',
      target_role: template.target_role || 'Todos',
      active: template.active ?? true,
      version: template.version || 1,
    }

    await dbPut('checklist_templates', fullTpl)

    let finalTplId = tplId
    let resultTpl = fullTpl
    if (isOnline && pb.authStore.isValid) {
      if (!template.id || template.id.startsWith('tpl_')) {
        const { id: _ignoredId, ...createTplData } = fullTpl
        const res = await pb.collection('checklist_templates').create(createTplData)
        finalTplId = res.id
        resultTpl = res as unknown as ChecklistTemplate
        await dbDelete('checklist_templates', tplId)
        await dbPut('checklist_templates', resultTpl)
      } else {
        const { id: _ignoredId, ...updateTplData } = fullTpl
        const res = await pb.collection('checklist_templates').update(template.id, updateTplData)
        resultTpl = res as unknown as ChecklistTemplate
        await dbPut('checklist_templates', resultTpl)
      }
    }

    // Save groups if provided
    const groupIdMap = new Map<string, string>()
    if (groups && groups.length > 0) {
      for (let gIdx = 0; gIdx < groups.length; gIdx++) {
        const grp = groups[gIdx]
        const oldGrpId = grp.id
        const savedGrp = await AppDataService.saveItemGroup(
          {
            ...grp,
            template: finalTplId,
            company: userCompId || undefined,
            sort_order: grp.sort_order !== undefined ? grp.sort_order : gIdx + 1,
          },
          isOnline,
        )
        if (oldGrpId) {
          groupIdMap.set(oldGrpId, savedGrp.id)
        }
      }
    }

    // Save items
    for (let i = 0; i < items.length; i++) {
      const it = items[i]
      const itemId = it.id || `item_${Date.now()}_${i}`
      const targetGroupId = it.group ? groupIdMap.get(it.group) || it.group : undefined
      const fullItem: ChecklistTemplateItem = {
        id: itemId,
        template_id: finalTplId,
        section: it.section || 'Geral',
        group:
          targetGroupId && targetGroupId !== 'none' && targetGroupId !== ''
            ? targetGroupId
            : undefined,
        title: it.title || 'Item de Verificação',
        description: it.description || '',
        type: it.type || 'conforme_nao_conforme',
        is_mandatory: it.is_mandatory ?? true,
        is_critical: it.is_critical ?? false,
        order_num: i + 1,
        sort_order: it.sort_order !== undefined ? it.sort_order : i + 1,
      }

      await dbPut('checklist_template_items', fullItem)

      if (isOnline && pb.authStore.isValid) {
        try {
          const { id: _ignoredItemId, expand: _ignoredExpand, ...itemPayload } = fullItem
          if (
            !itemPayload.group ||
            itemPayload.group === '' ||
            itemPayload.group === 'none' ||
            itemPayload.group.startsWith('temp_')
          ) {
            itemPayload.group = null as any
          }
          if (!it.id || it.id.startsWith('item_') || it.id.startsWith('temp_')) {
            const createdItem = await pb.collection('checklist_template_items').create(itemPayload)
            await dbDelete('checklist_template_items', itemId)
            await dbPut('checklist_template_items', createdItem as unknown as ChecklistTemplateItem)
          } else {
            await pb.collection('checklist_template_items').update(it.id, itemPayload)
          }
        } catch (itemErr) {
          console.warn('Failed saving template item online:', itemErr)
        }
      }
    }

    return resultTpl
  }

  static async duplicateTemplate(templateId: string, isOnline = true): Promise<ChecklistTemplate> {
    // 1. Fetch source template
    let sourceTemplate: ChecklistTemplate | null = await dbGetById<ChecklistTemplate>(
      'checklist_templates',
      templateId,
    )

    if (isOnline && pb.authStore.isValid && !templateId.startsWith('tpl_')) {
      try {
        sourceTemplate = await pb
          .collection('checklist_templates')
          .getOne<ChecklistTemplate>(templateId)
      } catch (err) {
        console.warn('Could not fetch source template online, using local cache:', err)
      }
    }

    if (!sourceTemplate) {
      throw new Error('Modelo de checklist original não encontrado.')
    }

    // 2. Fetch source groups and items
    const [sourceGroups, sourceItems] = await Promise.all([
      AppDataService.getItemGroups(templateId, isOnline),
      AppDataService.getTemplateItems(templateId, isOnline),
    ])

    // 3. Prepare duplicated template payload
    const newTitle = `${sourceTemplate.title} (Cópia)`
    const newTemplatePayload: Partial<ChecklistTemplate> = {
      company_id: sourceTemplate.company_id,
      title: newTitle,
      description: sourceTemplate.description || '',
      category: sourceTemplate.category,
      target_role: sourceTemplate.target_role || 'Todos',
      active: true,
      version: 1,
    }

    // 4. Prepare cloned groups with new temporary local ids to preserve mapping
    // We map old group IDs to new group payload references
    const clonedGroups: Partial<ChecklistItemGroup>[] = sourceGroups.map((g, idx) => ({
      id: `temp_grp_dup_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
      name: g.name,
      sort_order: g.sort_order ?? idx + 1,
    }))

    const oldGroupIdToNewTempIdMap = new Map<string, string>()
    sourceGroups.forEach((g, idx) => {
      oldGroupIdToNewTempIdMap.set(g.id, clonedGroups[idx].id!)
    })

    // 5. Prepare cloned items
    const clonedItems: Partial<ChecklistTemplateItem>[] = sourceItems.map((item, idx) => {
      const mappedGroupTempId = item.group
        ? oldGroupIdToNewTempIdMap.get(item.group) || undefined
        : undefined

      return {
        id: `temp_item_dup_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
        section: item.section || 'Geral',
        group: mappedGroupTempId,
        title: item.title,
        description: item.description || '',
        type: item.type,
        is_mandatory: item.is_mandatory ?? true,
        is_critical: item.is_critical ?? false,
        sort_order: item.sort_order ?? item.order_num ?? idx + 1,
        order_num: idx + 1,
      }
    })

    // 6. Save through existing saveTemplate handler (handles both online PocketBase & offline IndexedDB + group ID mapping)
    const createdTemplate = await AppDataService.saveTemplate(
      newTemplatePayload,
      clonedItems,
      isOnline,
      clonedGroups,
    )

    return createdTemplate
  }

  static async deleteTemplate(id: string, isOnline: boolean): Promise<void> {
    await dbDelete('checklist_templates', id)
    // Delete associated template items and groups in local DB
    const localItems = await dbGetByIndex<ChecklistTemplateItem>(
      'checklist_template_items',
      'template_id',
      id,
    )
    for (const item of localItems) {
      await dbDelete('checklist_template_items', item.id)
    }

    const localGroups = await dbGetByIndex<ChecklistItemGroup>(
      'checklist_item_groups',
      'template',
      id,
    )
    for (const group of localGroups) {
      await dbDelete('checklist_item_groups', group.id)
    }

    if (isOnline && !id.startsWith('tpl_')) {
      try {
        // Buscar e deletar itens vinculados
        const items = await pb
          .collection('checklist_template_items')
          .getFullList({ filter: `template_id='${id}'` })
        for (const item of items) {
          await pb.collection('checklist_template_items').delete(item.id)
        }
        // Buscar e deletar grupos vinculados
        const groups = await pb
          .collection('checklist_item_groups')
          .getFullList({ filter: `template='${id}'` })
        for (const group of groups) {
          await pb.collection('checklist_item_groups').delete(group.id)
        }
        // Agora deletar o template
        await pb.collection('checklist_templates').delete(id)
      } catch (err) {
        console.warn('Failed to delete template online:', err)
      }
    }
  }

  // --- Users ---
  static async getUsers(companyId?: string, isOnline = true): Promise<AppUser[]> {
    if (isOnline && pb.authStore.isValid) {
      try {
        const list = await pb.collection('users').getFullList<AppUser>({
          filter: companyId ? `company_id='${companyId}'` : undefined,
          sort: 'name',
          expand: 'company_id,client_id',
        })
        return list
      } catch (err) {
        console.warn('Online users fetch failed:', err)
      }
    }
    return []
  }

  static async saveUser(
    user: Partial<AppUser> & { password?: string; newPassword?: string; passwordConfirm?: string },
  ): Promise<AppUser> {
    const userCompId = user.company_id || (pb.authStore.record as any)?.company_id || ''
    const userWithCompany = { ...user, company_id: userCompId }

    if (!userWithCompany.id) {
      const { id, newPassword, passwordConfirm, ...createFields } = userWithCompany
      const initialPassword = user.password || newPassword || 'Skip@Pass'
      const finalPasswordConfirm = passwordConfirm || initialPassword
      const formattedUsername = createFields.username ? createFields.username.trim() : ''
      const rawEmail = createFields.email ? createFields.email.trim() : ''
      // Ensure email is NEVER empty string — fallback to username@cliente.local or user_id@cliente.local
      const fallbackEmail = formattedUsername
        ? `${formattedUsername.replace(/\s+/g, '.').toLowerCase()}@cliente.local`
        : `user_${Date.now()}@cliente.local`
      const finalEmail = rawEmail || fallbackEmail

      const payload: Record<string, any> = {
        ...createFields,
        username: formattedUsername,
        email: finalEmail,
        password: initialPassword,
        passwordConfirm: finalPasswordConfirm,
        emailVisibility: true,
      }
      const res = await pb.collection('users').create(payload)
      return res as unknown as AppUser
    } else {
      const { id, password, newPassword, passwordConfirm, ...updateFields } = userWithCompany
      const payload: Record<string, any> = { ...updateFields }
      if (payload.username !== undefined) {
        payload.username = payload.username ? payload.username.trim() : ''
      }
      if (payload.email !== undefined) {
        const rawEmail = payload.email ? payload.email.trim() : ''
        if (!rawEmail) {
          const currentUsername = payload.username || 'user'
          payload.email = `${currentUsername.replace(/\s+/g, '.').toLowerCase()}@cliente.local`
        } else {
          payload.email = rawEmail
        }
      }

      // If a new password or password is provided on edit, include it
      const passToSet = newPassword || password
      if (passToSet && passToSet.trim().length >= 8) {
        payload.password = passToSet.trim()
        payload.passwordConfirm = (passwordConfirm || passToSet).trim()
      }

      const res = await pb.collection('users').update(id, payload)
      return res as unknown as AppUser
    }
  }

  static async resetUserPassword(userId: string, newPass: string): Promise<void> {
    if (!pb.authStore.isValid) throw new Error('Não autenticado.')
    if (!newPass || newPass.trim().length < 8) {
      throw new Error('A nova senha deve possuir no mínimo 8 caracteres.')
    }
    await pb.collection('users').update(userId, {
      password: newPass.trim(),
      passwordConfirm: newPass.trim(),
    })
  }

  static async changeOwnPassword(
    oldPassword: string,
    newPassword: string,
    newPasswordConfirm: string,
  ): Promise<void> {
    if (!pb.authStore.isValid || !pb.authStore.record?.id) {
      throw new Error('Usuário não autenticado.')
    }
    const currentUserId = pb.authStore.record.id
    if (!oldPassword || !oldPassword.trim()) {
      throw new Error('Informe sua senha atual.')
    }
    if (!newPassword || newPassword.trim().length < 8) {
      throw new Error('A nova senha deve conter no mínimo 8 caracteres.')
    }
    if (newPassword !== newPasswordConfirm) {
      throw new Error('A confirmação da nova senha não confere.')
    }

    // In PocketBase auth collections, updating own password requires oldPassword, password and passwordConfirm
    await pb.collection('users').update(currentUserId, {
      oldPassword: oldPassword.trim(),
      password: newPassword.trim(),
      passwordConfirm: newPasswordConfirm.trim(),
    })
  }

  static async deleteUser(id: string): Promise<void> {
    if (pb.authStore.isValid) {
      await pb.collection('users').delete(id)
    }
  }

  // --- Companies ---
  static async getCompanies(isOnline = true): Promise<Company[]> {
    const local = await dbGetAll<Company>('companies')
    if (isOnline && pb.authStore.isValid) {
      try {
        const list = await pb.collection('companies').getFullList<Company>({ sort: 'name' })
        await dbPutMany('companies', list)
        return list
      } catch (err) {
        console.warn('Online companies fetch failed:', err)
      }
    }
    return local
  }

  static async saveCompany(comp: Partial<Company>): Promise<Company> {
    if (!comp.id) {
      const { id: _ignoredId, ...createData } = comp
      const res = await pb.collection('companies').create(createData)
      await dbPut('companies', res as unknown as Company)
      return res as unknown as Company
    } else {
      const { id, ...updateData } = comp
      const res = await pb.collection('companies').update(id, updateData)
      await dbPut('companies', res as unknown as Company)
      return res as unknown as Company
    }
  }

  static async deleteCompany(companyId: string): Promise<void> {
    if (pb.authStore.isValid) {
      await pb.collection('companies').delete(companyId)
    }
    await dbDelete('companies', companyId)
  }
}
