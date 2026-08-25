import pb from '@/lib/pocketbase/client'
import { dbGetAll, dbGetById, dbPut, dbPutMany, dbDelete, dbGetByIndex } from '@/lib/offline/db'
import { syncService } from '@/lib/offline/sync-service'
import {
  Checklist,
  ChecklistResponse,
  ChecklistTemplate,
  ChecklistTemplateItem,
  Equipment,
  Material,
  Client,
  Company,
  AppUser,
} from '@/types'

export class AppDataService {
  // --- Checklists ---
  static async getChecklists(companyId?: string, isOnline = true): Promise<Checklist[]> {
    // 1. Try local IndexedDB first for instant UI response
    const local = await dbGetAll<Checklist>('checklists')
    const filteredLocal = companyId ? local.filter((c) => c.company_id === companyId) : local

    if (isOnline && pb.authStore.isValid) {
      try {
        const filter = companyId ? `company_id='${companyId}'` : ''
        const onlineList = await pb.collection('checklists').getFullList<Checklist>({
          filter: filter || undefined,
          sort: '-created',
          expand: 'template_id,client_id,equipment_id,material_id,user_id',
        })
        // Merge with local queue
        const pendingLocals = local.filter((c) => c.sync_status === 'pending_sync')
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
    const local = await dbGetAll<Client>('clients')
    const filtered = companyId ? local.filter((c) => c.company_id === companyId) : local

    if (isOnline && pb.authStore.isValid) {
      try {
        const list = await pb.collection('clients').getFullList<Client>({
          filter: companyId ? `company_id='${companyId}'` : undefined,
          sort: 'name',
        })
        await dbPutMany('clients', list)
        return list
      } catch (err) {
        console.warn('Online clients fetch failed:', err)
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
    const filtered = companyId ? local.filter((t) => t.company_id === companyId) : local

    if (isOnline && pb.authStore.isValid) {
      try {
        const list = await pb.collection('checklist_templates').getFullList<ChecklistTemplate>({
          filter: companyId ? `company_id='${companyId}'` : undefined,
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
            sort: 'order_num',
          })
        await dbPutMany('checklist_template_items', list)
        return list
      } catch (err) {
        console.warn('Online template items fetch failed:', err)
      }
    }
    return local.sort((a, b) => (a.order_num || 0) - (b.order_num || 0))
  }

  static async saveTemplate(
    template: Partial<ChecklistTemplate>,
    items: Partial<ChecklistTemplateItem>[],
    isOnline: boolean,
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

    // Save items
    for (let i = 0; i < items.length; i++) {
      const it = items[i]
      const itemId = it.id || `item_${Date.now()}_${i}`
      const fullItem: ChecklistTemplateItem = {
        id: itemId,
        template_id: finalTplId,
        section: it.section || 'Geral',
        title: it.title || 'Item de Verificação',
        description: it.description || '',
        type: it.type || 'conforme_nao_conforme',
        is_mandatory: it.is_mandatory ?? true,
        is_critical: it.is_critical ?? false,
        order_num: i + 1,
      }

      await dbPut('checklist_template_items', fullItem)

      if (isOnline && pb.authStore.isValid) {
        try {
          if (!it.id || it.id.startsWith('item_')) {
            const { id: _ignoredItemId, ...createItemData } = fullItem
            const createdItem = await pb
              .collection('checklist_template_items')
              .create(createItemData)
            await dbDelete('checklist_template_items', itemId)
            await dbPut('checklist_template_items', createdItem as unknown as ChecklistTemplateItem)
          } else {
            const { id: _ignoredItemId, ...updateItemData } = fullItem
            await pb.collection('checklist_template_items').update(it.id, updateItemData)
          }
        } catch (itemErr) {
          console.warn('Failed saving template item online:', itemErr)
        }
      }
    }

    return resultTpl
  }

  // --- Users ---
  static async getUsers(companyId?: string, isOnline = true): Promise<AppUser[]> {
    if (isOnline && pb.authStore.isValid) {
      try {
        const list = await pb.collection('users').getFullList<AppUser>({
          filter: companyId ? `company_id='${companyId}'` : undefined,
          sort: 'name',
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
      const res = await pb.collection('users').create({
        ...createFields,
        username: formattedUsername,
        password: initialPassword,
        passwordConfirm: finalPasswordConfirm,
        emailVisibility: true,
      })
      return res as unknown as AppUser
    } else {
      const { id, password, newPassword, passwordConfirm, ...updateFields } = userWithCompany
      const payload: Record<string, any> = { ...updateFields }
      if (payload.username !== undefined) {
        payload.username = payload.username ? payload.username.trim() : ''
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
}
