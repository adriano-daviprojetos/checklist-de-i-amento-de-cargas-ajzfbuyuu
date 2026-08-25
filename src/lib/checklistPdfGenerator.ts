import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  Checklist,
  ChecklistResponse,
  ChecklistItemGroup,
  ChecklistTemplateItem,
  Company,
  Client,
  Equipment,
  Material,
} from '@/types'

export interface GenerateChecklistPdfOptions {
  checklist: Checklist
  responses: ChecklistResponse[]
  items: ChecklistTemplateItem[]
  groups: ChecklistItemGroup[]
  company?: Company | null
  client?: Client | null
  equipment?: Equipment | null
  material?: Material | null
}

interface ProcessedGroup {
  id: string
  name: string
  groupNumber: number | null // null for "Geral"
  items: Array<{
    itemNumberLabel: string
    title: string
    description?: string
    isCritical?: boolean
    isMandatory?: boolean
    status: string // 'C' | 'NC' | 'NA' | 'SIM' | 'NAO' | 'PENDENTE'
    statusText: string
    observation?: string
    value?: string
  }>
}

/**
 * Helper to safely get image dimensions from base64 string
 */
function getImageDimensions(
  base64Data: string,
): Promise<{ width: number; height: number; format: string }> {
  return new Promise((resolve) => {
    // Detect format
    let format = 'PNG'
    if (base64Data.startsWith('data:image/jpeg') || base64Data.startsWith('data:image/jpg')) {
      format = 'JPEG'
    } else if (base64Data.startsWith('data:image/webp')) {
      format = 'WEBP'
    }

    if (typeof window === 'undefined') {
      resolve({ width: 400, height: 200, format })
      return
    }

    const img = new Image()
    img.onload = () => {
      resolve({
        width: img.naturalWidth || 400,
        height: img.naturalHeight || 200,
        format,
      })
    }
    img.onerror = () => {
      resolve({ width: 400, height: 200, format })
    }
    img.src = base64Data
  })
}

/**
 * Formats a date string into "DD/MM/AAAA às HH:MM"
 */
function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) return '-'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return '-'
    const datePart = d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
    const timePart = d.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })
    return `${datePart} às ${timePart}`
  } catch {
    return '-'
  }
}

/**
 * Returns formatted label and badge color for status
 */
function getStatusDisplay(status?: string): {
  text: string
  textColor: [number, number, number]
  bgColor: [number, number, number]
} {
  switch (status) {
    case 'C':
    case 'SIM':
      return {
        text: 'CONFORME',
        textColor: [6, 95, 70], // #065F46 dark green
        bgColor: [209, 250, 229], // #D1FAE5 light green
      }
    case 'NC':
    case 'NAO':
      return {
        text: 'NÃO CONFORME',
        textColor: [153, 27, 27], // #991B1B dark red
        bgColor: [254, 226, 226], // #FEE2E2 light red
      }
    case 'NA':
      return {
        text: 'NÃO APLICÁVEL',
        textColor: [75, 85, 99], // #4B5563 dark gray
        bgColor: [243, 244, 246], // #F3F4F6 light gray
      }
    default:
      return {
        text: 'PENDENTE',
        textColor: [146, 64, 14], // #92400E dark amber
        bgColor: [254, 243, 199], // #FEF3C7 light amber
      }
  }
}

export async function generateChecklistPdf({
  checklist,
  responses,
  items,
  groups,
  company,
  client,
  equipment,
  material,
}: GenerateChecklistPdfOptions): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = doc.internal.pageSize.getWidth() // 210mm
  const pageHeight = doc.internal.pageSize.getHeight() // 297mm
  const margin = 14
  const contentWidth = pageWidth - margin * 2 // 182mm

  // Colors
  const primaryNavy: [number, number, number] = [15, 23, 42] // Slate 900
  const secondaryBlue: [number, number, number] = [2, 132, 199] // Sky 600
  const headerBgColor: [number, number, number] = [241, 245, 249] // Slate 100
  const borderGray: [number, number, number] = [203, 213, 225] // Slate 300
  const darkText: [number, number, number] = [30, 41, 59] // Slate 800
  const lightMutedText: [number, number, number] = [100, 116, 139] // Slate 500

  // Effective company name
  const companyName = company?.trade_name || company?.name || 'Davi Projetos - Engenharia e Rigging'

  // Effective client name
  const clientName =
    client?.trade_name ||
    client?.name ||
    checklist.expand?.client_id?.trade_name ||
    checklist.expand?.client_id?.name ||
    'Não informado'

  // Map of responses by itemId and by title for fallback
  const responseByItemId = new Map<string, ChecklistResponse>()
  const responseByTitle = new Map<string, ChecklistResponse>()
  responses.forEach((r) => {
    if (r.item_id) responseByItemId.set(r.item_id, r)
    if (r.item_title) responseByTitle.set(r.item_title, r)
  })

  // Group items by groups
  const sortedGroups = [...groups].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  const processedGroups: ProcessedGroup[] = []

  // Defined groups
  sortedGroups.forEach((grp, gIdx) => {
    const groupItems = items
      .filter((it) => it.group === grp.id)
      .sort((a, b) => (a.sort_order ?? a.order_num ?? 0) - (b.sort_order ?? b.order_num ?? 0))

    if (groupItems.length > 0) {
      processedGroups.push({
        id: grp.id,
        name: grp.name,
        groupNumber: gIdx + 1,
        items: groupItems.map((it, itemIdx) => {
          const resp = responseByItemId.get(it.id) || responseByTitle.get(it.title)
          const disp = getStatusDisplay(resp?.status)
          return {
            itemNumberLabel: `${gIdx + 1}.${itemIdx + 1}`,
            title: it.title,
            description: it.description,
            isCritical: it.is_critical,
            isMandatory: it.is_mandatory,
            status: resp?.status || 'PENDENTE',
            statusText: disp.text,
            observation: resp?.observation,
            value: resp?.value,
          }
        }),
      })
    }
  })

  // Geral / Unassigned items
  const knownGroupIds = new Set(groups.map((g) => g.id))
  const unassignedItems = items
    .filter((it) => !it.group || !knownGroupIds.has(it.group))
    .sort((a, b) => (a.sort_order ?? a.order_num ?? 0) - (b.sort_order ?? b.order_num ?? 0))

  if (unassignedItems.length > 0 || processedGroups.length === 0) {
    const isSingleGroup = processedGroups.length === 0
    processedGroups.push({
      id: 'general',
      name: isSingleGroup ? 'Itens de Verificação' : 'Geral',
      groupNumber: isSingleGroup ? 1 : null,
      items: unassignedItems.map((it, itemIdx) => {
        const resp = responseByItemId.get(it.id) || responseByTitle.get(it.title)
        const disp = getStatusDisplay(resp?.status)
        return {
          itemNumberLabel: isSingleGroup ? `${itemIdx + 1}.` : `${itemIdx + 1}.`,
          title: it.title,
          description: it.description,
          isCritical: it.is_critical,
          isMandatory: it.is_mandatory,
          status: resp?.status || 'PENDENTE',
          statusText: disp.text,
          observation: resp?.observation,
          value: resp?.value,
        }
      }),
    })
  }

  // Pre-load signatures if present
  let inspectorSigDimensions: { width: number; height: number; format: string } | null = null
  let filledBySigDimensions: { width: number; height: number; format: string } | null = null

  if (checklist.signature_data && checklist.signature_data.startsWith('data:image')) {
    try {
      inspectorSigDimensions = await getImageDimensions(checklist.signature_data)
    } catch (e) {
      console.warn('Could not load inspector signature image dimensions', e)
    }
  }

  if (checklist.filled_by_signature && checklist.filled_by_signature.startsWith('data:image')) {
    try {
      filledBySigDimensions = await getImageDimensions(checklist.filled_by_signature)
    } catch (e) {
      console.warn('Could not load filled_by signature image dimensions', e)
    }
  }

  // Render Header (applied to every page)
  const renderHeader = (isFirstPage: boolean = false) => {
    // Outer Header Box
    doc.setFillColor(headerBgColor[0], headerBgColor[1], headerBgColor[2])
    doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2])
    doc.setLineWidth(0.3)
    doc.roundedRect(margin, margin, contentWidth, 27, 2, 2, 'FD')

    // Left accent bar
    doc.setFillColor(secondaryBlue[0], secondaryBlue[1], secondaryBlue[2])
    doc.rect(margin, margin, 3, 27, 'F')

    // Company / Brand
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(secondaryBlue[0], secondaryBlue[1], secondaryBlue[2])
    doc.text(companyName.toUpperCase(), margin + 6, margin + 5.5)

    // Main Title
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2])
    doc.text('RELATÓRIO DE CHECKLIST DE IÇAMENTO DE CARGAS', margin + 6, margin + 11.5)

    // Subtitle / Checklist Code & Status
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(darkText[0], darkText[1], darkText[2])
    doc.text(`Código: `, margin + 6, margin + 17)
    doc.setFont('helvetica', 'bold')
    doc.text(checklist.code || 'CHK-N/A', margin + 18, margin + 17)

    // Status Badge inside header
    const isCompleted = checklist.status === 'Concluído'
    const isRejected = checklist.status === 'Reprovado'
    const stBadgeText = isCompleted
      ? 'LIBERADO (CONCLUÍDO)'
      : isRejected
        ? 'REPROVADO'
        : (checklist.status || 'EM ANDAMENTO').toUpperCase()

    const badgeX = margin + 55
    const badgeY = margin + 13.5
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'bold')
    if (isCompleted) {
      doc.setFillColor(209, 250, 229)
      doc.setTextColor(6, 95, 70)
      doc.setDrawColor(16, 185, 129)
    } else if (isRejected) {
      doc.setFillColor(254, 226, 226)
      doc.setTextColor(153, 27, 27)
      doc.setDrawColor(239, 68, 68)
    } else {
      doc.setFillColor(224, 242, 254)
      doc.setTextColor(3, 105, 161)
      doc.setDrawColor(14, 165, 233)
    }
    doc.roundedRect(badgeX, badgeY, 38, 5, 1, 1, 'FD')
    doc.text(stBadgeText, badgeX + 19, badgeY + 3.6, { align: 'center' })

    // Client/Obra in header
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(lightMutedText[0], lightMutedText[1], lightMutedText[2])
    doc.text('Cliente / Obra:', margin + 6, margin + 22.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(darkText[0], darkText[1], darkText[2])
    const truncatedClient =
      clientName.length > 40 ? clientName.substring(0, 38) + '...' : clientName
    doc.text(truncatedClient, margin + 26, margin + 22.5)

    // Right Column in header: Dates
    const rightColX = pageWidth - margin - 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(lightMutedText[0], lightMutedText[1], lightMutedText[2])

    const createdFormatted = formatDateTime(checklist.created || checklist.scheduled_date)
    const completedFormatted = formatDateTime(checklist.completed_at || checklist.updated)

    doc.text(`Criação: ${createdFormatted}`, rightColX, margin + 6.5, { align: 'right' })
    doc.text(`Finalização: ${completedFormatted}`, rightColX, margin + 11.5, { align: 'right' })

    if (checklist.risk_level) {
      doc.text(`Grau de Risco: `, rightColX - 18, margin + 17, { align: 'right' })
      doc.setFont('helvetica', 'bold')
      if (checklist.risk_level === 'Alto' || checklist.risk_level === 'Crítico') {
        doc.setTextColor(185, 28, 28)
      } else {
        doc.setTextColor(darkText[0], darkText[1], darkText[2])
      }
      doc.text(checklist.risk_level.toUpperCase(), rightColX, margin + 17, { align: 'right' })
    }

    doc.setFont('helvetica', 'normal')
    doc.setTextColor(lightMutedText[0], lightMutedText[1], lightMutedText[2])
    doc.setFontSize(7)
    doc.text(`Emissão: ${new Date().toLocaleDateString('pt-BR')}`, rightColX, margin + 22.5, {
      align: 'right',
    })
  }

  // Render Operation Details Block (First page before items)
  const renderOperationDetails = (startY: number): number => {
    doc.setFillColor(248, 250, 252)
    doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2])
    doc.setLineWidth(0.25)

    const boxHeight = 27
    doc.roundedRect(margin, startY, contentWidth, boxHeight, 1.5, 1.5, 'FD')

    // Section title inside box
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2])
    doc.text('DADOS DA OPERAÇÃO DE IÇAMENTO', margin + 3.5, startY + 4.5)

    // Horizontal line
    doc.setDrawColor(226, 232, 240)
    doc.line(margin, startY + 6.5, margin + contentWidth, startY + 6.5)

    // 2-row x 3-column grid
    const col1X = margin + 3.5
    const col2X = margin + contentWidth / 3 + 2
    const col3X = margin + (contentWidth / 3) * 2 + 2

    const row1Y = startY + 11.5
    const row2Y = startY + 19.5

    // Equipment string
    const eqObj = equipment || checklist.expand?.equipment_id
    const eqStr = eqObj
      ? `${eqObj.type} ${eqObj.manufacturer} ${eqObj.model} (${eqObj.capacity})`
      : 'Não especificado'

    // Material string
    const matObj = material || checklist.expand?.material_id
    const matStr = matObj
      ? `TAG: ${matObj.tag} - ${matObj.type} (${matObj.capacity})`
      : 'Não especificado'

    // Cell helper
    const drawCell = (x: number, y: number, label: string, val: string, maxLen = 32) => {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7)
      doc.setTextColor(lightMutedText[0], lightMutedText[1], lightMutedText[2])
      doc.text(label, x, y)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(darkText[0], darkText[1], darkText[2])
      const textToDraw = val.length > maxLen ? val.substring(0, maxLen - 2) + '...' : val
      doc.text(textToDraw, x, y + 4)
    }

    drawCell(
      col1X,
      row1Y,
      'DATA / HORA PROGRAMADA',
      formatDateTime(checklist.scheduled_date || checklist.created),
    )
    drawCell(col2X, row1Y, 'LOCAL / FRENTE DE SERVIÇO', checklist.location || 'Não informado')
    drawCell(col3X, row1Y, 'MANOBRA / OPERAÇÃO', checklist.operation_type || checklist.title)

    drawCell(col1X, row2Y, 'EQUIPAMENTO UTILIZADO', eqStr)
    drawCell(col2X, row2Y, 'ACESSÓRIOS / MATERIAIS', matStr)
    drawCell(
      col3X,
      row2Y,
      'RESP. PELO PREENCHIMENTO',
      checklist.filled_by_name || checklist.inspector_name || 'Não informado',
    )

    return startY + boxHeight + 4
  }

  // Generate Pages (One page per section/group)
  let isFirst = true

  for (let gIdx = 0; gIdx < processedGroups.length; gIdx++) {
    const group = processedGroups[gIdx]

    if (!isFirst) {
      doc.addPage()
    }
    isFirst = false

    renderHeader()

    let currentY = margin + 30

    // Only on page 1: show operation details before the first group
    if (gIdx === 0) {
      currentY = renderOperationDetails(currentY)
    }

    // Section Group Header Banner
    const groupTitle =
      group.groupNumber !== null ? `${group.groupNumber}. ${group.name}` : group.name

    doc.setFillColor(secondaryBlue[0], secondaryBlue[1], secondaryBlue[2])
    doc.roundedRect(margin, currentY, contentWidth, 7, 1, 1, 'F')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(255, 255, 255)
    doc.text(groupTitle.toUpperCase(), margin + 3, currentY + 4.8)

    // Item count indicator on right
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.text(
      `${group.items.length} ${group.items.length === 1 ? 'item' : 'itens'}`,
      pageWidth - margin - 4,
      currentY + 4.8,
      { align: 'right' },
    )

    currentY += 9

    // Table of items for this group
    const tableBody = group.items.map((item) => {
      let fullTitle = `${item.itemNumberLabel}  ${item.title}`
      if (item.isCritical) fullTitle += ' [ITEM CRÍTICO]'
      if (item.isMandatory) fullTitle += ' (Obrigatório)'
      if (item.description) fullTitle += `\n${item.description}`
      if (item.value) fullTitle += `\nMedição: ${item.value}`
      if (item.observation) fullTitle += `\nObs: ${item.observation}`

      return [item.itemNumberLabel, fullTitle, item.statusText]
    })

    autoTable(doc, {
      startY: currentY,
      head: [['Nº', 'ITEM DE VERIFICAÇÃO / DESCRIÇÃO / OBSERVAÇÕES', 'AVALIAÇÃO']],
      body: tableBody,
      theme: 'grid',
      margin: { left: margin, right: margin, bottom: 22 },
      tableWidth: contentWidth,
      headStyles: {
        fillColor: [30, 41, 59], // Slate 800
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.5,
        halign: 'left',
        cellPadding: 2,
      },
      columnStyles: {
        0: { cellWidth: 12, halign: 'center', fontStyle: 'bold', fontSize: 8 },
        1: { cellWidth: 'auto', fontSize: 8 },
        2: { cellWidth: 32, halign: 'center', fontStyle: 'bold', fontSize: 7.5 },
      },
      styles: {
        cellPadding: 2.2,
        lineColor: borderGray,
        lineWidth: 0.15,
        textColor: darkText,
        overflow: 'linebreak',
      },
      didParseCell: (data) => {
        // Style evaluation column badge cells
        if (data.section === 'body' && data.column.index === 2) {
          const rawText = data.cell.raw as string
          if (rawText === 'CONFORME') {
            data.cell.styles.fillColor = [209, 250, 229] // Emerald 100
            data.cell.styles.textColor = [6, 95, 70] // Emerald 800
          } else if (rawText === 'NÃO CONFORME') {
            data.cell.styles.fillColor = [254, 226, 226] // Red 100
            data.cell.styles.textColor = [153, 27, 27] // Red 800
          } else if (rawText === 'NÃO APLICÁVEL') {
            data.cell.styles.fillColor = [243, 244, 246] // Gray 100
            data.cell.styles.textColor = [75, 85, 99] // Gray 600
          } else {
            data.cell.styles.fillColor = [254, 243, 199] // Amber 100
            data.cell.styles.textColor = [146, 64, 14] // Amber 800
          }
        }
      },
    })
  }

  // --- Final Signatures Page (or prominent section at the end) ---
  // We add a dedicated concluding page for Technical Opinions, Notes, and Digital Signatures
  doc.addPage()
  renderHeader()

  let sigY = margin + 30

  // General Notes & Recommendations Box
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2])
  doc.setLineWidth(0.25)
  doc.roundedRect(margin, sigY, contentWidth, 38, 1.5, 1.5, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2])
  doc.text('PARECER FINAL E OBSERVAÇÕES TÉCNICAS DE RIGGING', margin + 3.5, sigY + 5)

  doc.setDrawColor(226, 232, 240)
  doc.line(margin, sigY + 7, margin + contentWidth, sigY + 7)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(darkText[0], darkText[1], darkText[2])

  const notesText =
    checklist.notes?.trim() ||
    'Operação vistoriada conforme normas regulamentadoras de segurança vigentes (NR-11, NR-12 e NR-18). Equipamentos, acessórios de amarração e isolamento de raio de giro inspecionados no canteiro de obras.'
  const splitNotes = doc.splitTextToSize(notesText, contentWidth - 7)
  doc.text(splitNotes, margin + 3.5, sigY + 12)

  // Status and Conclusion stamp inside notes box
  const conclusionY = sigY + 31
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('Conclusão da Vistoria:', margin + 3.5, conclusionY)

  const isApproved = checklist.status === 'Concluído'
  if (isApproved) {
    doc.setTextColor(6, 95, 70)
    doc.text('OPERAÇÃO LIBERADA - CONFORMIDADE ATESTADA', margin + 38, conclusionY)
  } else if (checklist.status === 'Reprovado') {
    doc.setTextColor(153, 27, 27)
    doc.text('OPERAÇÃO BLOQUEADA - NÃO CONFORMIDADES IDENTIFICADAS', margin + 38, conclusionY)
  } else {
    doc.setTextColor(146, 64, 14)
    doc.text('EM ANDAMENTO / PENDENTE DE LIBERAÇÃO', margin + 38, conclusionY)
  }

  sigY += 44

  // Title for Signatures
  doc.setFillColor(primaryNavy[0], primaryNavy[1], primaryNavy[2])
  doc.roundedRect(margin, sigY, contentWidth, 7, 1, 1, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(255, 255, 255)
  doc.text('VALIDAÇÃO E ASSINATURAS DIGITAIS', margin + 3, sigY + 4.8)

  sigY += 11

  // Signatures 2-column layout
  const sigBoxWidth = (contentWidth - 6) / 2
  const sigBoxHeight = 65

  // Box 1: Responsável pelo Preenchimento
  const box1X = margin
  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2])
  doc.setLineWidth(0.3)
  doc.roundedRect(box1X, sigY, sigBoxWidth, sigBoxHeight, 2, 2, 'FD')

  // Header of Box 1
  doc.setFillColor(241, 245, 249)
  doc.rect(box1X, sigY, sigBoxWidth, 7, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2])
  doc.text('RESPONSÁVEL PELO PREENCHIMENTO', box1X + sigBoxWidth / 2, sigY + 4.8, {
    align: 'center',
  })

  // Signature Image / Placeholder for Filled By
  if (checklist.filled_by_signature && checklist.filled_by_signature.startsWith('data:image')) {
    try {
      const dim = filledBySigDimensions || { width: 400, height: 200, format: 'PNG' }
      const maxImgW = sigBoxWidth - 10
      const maxImgH = 28
      const ratio = Math.min(maxImgW / dim.width, maxImgH / dim.height)
      const renderW = dim.width * ratio
      const renderH = dim.height * ratio
      const renderX = box1X + (sigBoxWidth - renderW) / 2
      const renderY = sigY + 9 + (maxImgH - renderH) / 2

      doc.addImage(
        checklist.filled_by_signature,
        dim.format,
        renderX,
        renderY,
        renderW,
        renderH,
        undefined,
        'FAST',
      )
    } catch (err) {
      console.warn('Error inserting filled_by signature image in PDF', err)
    }
  } else {
    // Stamp placeholder
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(7.5)
    doc.setTextColor(lightMutedText[0], lightMutedText[1], lightMutedText[2])
    doc.text(
      '(Assinatura registrada digitalmente em sistema)',
      box1X + sigBoxWidth / 2,
      sigY + 22,
      {
        align: 'center',
      },
    )
  }

  // Signature Line 1
  const line1Y = sigY + 44
  doc.setDrawColor(148, 163, 184)
  doc.setLineWidth(0.4)
  doc.line(box1X + 8, line1Y, box1X + sigBoxWidth - 8, line1Y)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(darkText[0], darkText[1], darkText[2])
  const filledName =
    checklist.filled_by_name || checklist.inspector_name || 'Profissional Responsável'
  doc.text(filledName, box1X + sigBoxWidth / 2, line1Y + 4.5, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(lightMutedText[0], lightMutedText[1], lightMutedText[2])
  doc.text('Operador / Rigger Responsável', box1X + sigBoxWidth / 2, line1Y + 8.5, {
    align: 'center',
  })
  if (checklist.created) {
    doc.text(`Data: ${formatDateTime(checklist.created)}`, box1X + sigBoxWidth / 2, line1Y + 12.5, {
      align: 'center',
    })
  }

  // Box 2: Inspetor / Responsável Técnico
  const box2X = margin + sigBoxWidth + 6
  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2])
  doc.setLineWidth(0.3)
  doc.roundedRect(box2X, sigY, sigBoxWidth, sigBoxHeight, 2, 2, 'FD')

  // Header of Box 2
  doc.setFillColor(241, 245, 249)
  doc.rect(box2X, sigY, sigBoxWidth, 7, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2])
  doc.text('INSPETOR / RESPONSÁVEL TÉCNICO', box2X + sigBoxWidth / 2, sigY + 4.8, {
    align: 'center',
  })

  // Signature Image / Placeholder for Inspector
  if (checklist.signature_data && checklist.signature_data.startsWith('data:image')) {
    try {
      const dim = inspectorSigDimensions || { width: 400, height: 200, format: 'PNG' }
      const maxImgW = sigBoxWidth - 10
      const maxImgH = 28
      const ratio = Math.min(maxImgW / dim.width, maxImgH / dim.height)
      const renderW = dim.width * ratio
      const renderH = dim.height * ratio
      const renderX = box2X + (sigBoxWidth - renderW) / 2
      const renderY = sigY + 9 + (maxImgH - renderH) / 2

      doc.addImage(
        checklist.signature_data,
        dim.format,
        renderX,
        renderY,
        renderW,
        renderH,
        undefined,
        'FAST',
      )
    } catch (err) {
      console.warn('Error inserting inspector signature image in PDF', err)
    }
  } else {
    // Stamp placeholder
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(7.5)
    doc.setTextColor(lightMutedText[0], lightMutedText[1], lightMutedText[2])
    doc.text('(Assinatura digital autenticada)', box2X + sigBoxWidth / 2, sigY + 22, {
      align: 'center',
    })
  }

  // Signature Line 2
  doc.setDrawColor(148, 163, 184)
  doc.setLineWidth(0.4)
  doc.line(box2X + 8, line1Y, box2X + sigBoxWidth - 8, line1Y)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(darkText[0], darkText[1], darkText[2])
  const inspName = checklist.inspector_name || 'Inspetor Técnico'
  doc.text(inspName, box2X + sigBoxWidth / 2, line1Y + 4.5, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(lightMutedText[0], lightMutedText[1], lightMutedText[2])
  doc.text('Inspetor / Responsável Técnico de Rigging', box2X + sigBoxWidth / 2, line1Y + 8.5, {
    align: 'center',
  })
  if (checklist.completed_at) {
    doc.text(
      `Autenticado em: ${formatDateTime(checklist.completed_at)}`,
      box2X + sigBoxWidth / 2,
      line1Y + 12.5,
      { align: 'center' },
    )
  }

  // Compliance Security Footer Note
  const secNoteY = sigY + sigBoxHeight + 8
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(lightMutedText[0], lightMutedText[1], lightMutedText[2])
  doc.text(
    'Este documento eletrônico foi emitido pelo sistema Davi Projetos e possui validade técnica com registro de auditoria, datação temporal e assinaturas digitais.',
    pageWidth / 2,
    secNoteY,
    { align: 'center' },
  )

  // --- Footers for All Pages (Page X of Y + Issue Date) ---
  const totalPages = doc.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)

    const footerY = pageHeight - margin + 4

    // Top border of footer
    doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2])
    doc.setLineWidth(0.2)
    doc.line(margin, footerY - 3, pageWidth - margin, footerY - 3)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(lightMutedText[0], lightMutedText[1], lightMutedText[2])

    // Left
    doc.text(`${companyName} | ${checklist.code || 'CHK-N/A'}`, margin, footerY)

    // Center
    const emissionDateStr = new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
    doc.text(`Data de Emissão: ${emissionDateStr}`, pageWidth / 2, footerY, { align: 'center' })

    // Right
    doc.text(`Página ${p} de ${totalPages}`, pageWidth - margin, footerY, { align: 'right' })
  }

  // Download filename: checklist-{codigo}-{data}.pdf
  const safeCode = (checklist.code || 'CHK').replace(/[^a-zA-Z0-9-_]/g, '_').toLowerCase()
  const todayStr = new Date().toISOString().split('T')[0]
  const filename = `checklist-${safeCode}-${todayStr}.pdf`

  doc.save(filename)
}
