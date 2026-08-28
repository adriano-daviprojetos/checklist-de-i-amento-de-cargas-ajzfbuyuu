import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import 'jspdf-autotable'
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
  responses?: ChecklistResponse[] | null
  items?: ChecklistTemplateItem[] | null
  groups?: ChecklistItemGroup[] | null
  company?: Company | null
  client?: Client | null
  equipment?: Equipment | null
  material?: Material | null
  templateName?: string | null
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
 * Helper to safely run autoTable across different jspdf-autotable versions & bundler environments
 */
function applyAutoTable(doc: jsPDF, options: any): void {
  if (typeof (doc as any).autoTable === 'function') {
    ;(doc as any).autoTable(options)
  } else if (typeof autoTable === 'function') {
    autoTable(doc, options)
  } else if (autoTable && typeof (autoTable as any).default === 'function') {
    ;(autoTable as any).default(doc, options)
  } else {
    throw new Error('Plugin autoTable do jsPDF não foi inicializado corretamente.')
  }
}

const LOGO_URL =
  'https://dagtlwojkqyivnjgveda.supabase.co/storage/v1/object/public/message-attachments/6e8232c6-c506-4bdf-99a5-77593c500309/logonovosite-816c7.png'
const LOGO_FALLBACK_URL = '/logo.svg'

interface LoadedImage {
  data: string
  width: number
  height: number
  format: string
}

let cachedLogo: LoadedImage | null = null

/**
 * Loads an image from a URL or data URI and converts it to a base64 data URL along with its dimensions.
 * Uses canvas or blob fetching with fallback.
 */
async function loadLogoImage(url: string): Promise<LoadedImage | null> {
  if (cachedLogo) return cachedLogo

  // Method 1: Fetch as blob and convert via FileReader (handles CORS cleanly)
  try {
    const response = await fetch(url, { mode: 'cors' })
    if (response.ok) {
      const blob = await response.blob()
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => {
          if (typeof reader.result === 'string') resolve(reader.result)
          else reject(new Error('FileReader result is not a string'))
        }
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })

      const dims = await getImageDimensions(base64Data)
      cachedLogo = {
        data: base64Data,
        width: dims.width,
        height: dims.height,
        format: dims.format,
      }
      return cachedLogo
    }
  } catch (err) {
    console.warn('Direct fetch for logo failed, falling back to Image element load:', err)
  }

  // Method 2: HTML Image load with crossorigin and canvas draw
  try {
    const loaded = await new Promise<LoadedImage | null>((resolve) => {
      if (typeof window === 'undefined') {
        resolve(null)
        return
      }
      const img = new Image()
      img.crossOrigin = 'Anonymous'
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          canvas.width = img.naturalWidth || img.width
          canvas.height = img.naturalHeight || img.height
          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.drawImage(img, 0, 0)
            const dataUrl = canvas.toDataURL('image/png')
            resolve({
              data: dataUrl,
              width: canvas.width,
              height: canvas.height,
              format: 'PNG',
            })
            return
          }
        } catch (canvasErr) {
          console.warn('Canvas export failed for logo:', canvasErr)
        }
        resolve(null)
      }
      img.onerror = () => resolve(null)
      img.src = url
    })

    if (loaded) {
      cachedLogo = loaded
      return cachedLogo
    }
  } catch (err) {
    console.warn('Image element fallback failed for logo:', err)
  }

  return null
}

/**
 * Helper to safely get image dimensions from base64 string
 */
function getImageDimensions(
  base64Data: string,
): Promise<{ width: number; height: number; format: string }> {
  return new Promise((resolve) => {
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
 * Formats a date string into "DD/MM/AAAA às HH:MM" or "DD/MM/AAAA HH:MM"
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
    return `${datePart} ${timePart}`
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
        textColor: [6, 95, 70], // #065F46 dark emerald
        bgColor: [209, 250, 229], // #D1FAE5 light emerald
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
  responses = [],
  items = [],
  groups = [],
  company,
  client,
  equipment,
  material,
  templateName,
}: GenerateChecklistPdfOptions): Promise<void> {
  const safeResponses = Array.isArray(responses) ? responses : []
  const safeItems = Array.isArray(items) ? items : []
  const safeGroups = Array.isArray(groups) ? groups : []

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = doc.internal.pageSize.getWidth() // 210mm
  const pageHeight = doc.internal.pageSize.getHeight() // 297mm
  const margin = 8 // 8mm compact margin
  const contentWidth = pageWidth - margin * 2 // 194mm
  const bottomFooterReserve = 12 // Space reserved for footer
  const pageContentBottomLimit = pageHeight - margin - bottomFooterReserve // ~277mm

  // Colors
  const primaryNavy: [number, number, number] = [15, 23, 42] // Slate 900
  const secondaryBlue: [number, number, number] = [2, 132, 199] // Sky 600
  const headerBgColor: [number, number, number] = [241, 245, 249] // Slate 100
  const borderGray: [number, number, number] = [203, 213, 225] // Slate 300
  const darkText: [number, number, number] = [30, 41, 59] // Slate 800
  const lightMutedText: [number, number, number] = [100, 116, 139] // Slate 500

  // Effective names
  const companyName = company?.trade_name || company?.name || 'Davi Projetos - Engenharia e Rigging'
  const clientName =
    client?.trade_name ||
    client?.name ||
    checklist?.expand?.client_id?.trade_name ||
    checklist?.expand?.client_id?.name ||
    'Não informado'

  // Map of responses by itemId and title
  const responseByItemId = new Map<string, ChecklistResponse>()
  const responseByTitle = new Map<string, ChecklistResponse>()
  safeResponses.forEach((r) => {
    if (r?.item_id) responseByItemId.set(r.item_id, r)
    if (r?.item_title) responseByTitle.set(r.item_title, r)
  })

  // Group items by groups
  const sortedGroups = [...safeGroups].sort((a, b) => (a?.sort_order ?? 0) - (b?.sort_order ?? 0))
  const processedGroups: ProcessedGroup[] = []

  sortedGroups.forEach((grp, gIdx) => {
    if (!grp?.id) return
    const groupItems = safeItems
      .filter((it) => it && it.group === grp.id)
      .sort((a, b) => (a.sort_order ?? a.order_num ?? 0) - (b.sort_order ?? b.order_num ?? 0))

    if (groupItems.length > 0) {
      processedGroups.push({
        id: grp.id,
        name: grp.name || `Grupo ${gIdx + 1}`,
        groupNumber: gIdx + 1,
        items: groupItems.map((it, itemIdx) => {
          const resp =
            (it.id ? responseByItemId.get(it.id) : undefined) ||
            (it.title ? responseByTitle.get(it.title) : undefined)
          const disp = getStatusDisplay(resp?.status)
          return {
            itemNumberLabel: `${gIdx + 1}.${itemIdx + 1}`,
            title: it.title || 'Item sem título',
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
  const knownGroupIds = new Set(safeGroups.map((g) => g?.id).filter(Boolean))
  const unassignedItems = safeItems
    .filter((it) => it && (!it.group || !knownGroupIds.has(it.group)))
    .sort((a, b) => (a.sort_order ?? a.order_num ?? 0) - (b.sort_order ?? b.order_num ?? 0))

  if (unassignedItems.length > 0 || processedGroups.length === 0) {
    const isSingleGroup = processedGroups.length === 0
    processedGroups.push({
      id: 'general',
      name: isSingleGroup ? 'Itens de Verificação' : 'Geral',
      groupNumber: isSingleGroup ? 1 : null,
      items: unassignedItems.map((it, itemIdx) => {
        const resp =
          (it.id ? responseByItemId.get(it.id) : undefined) ||
          (it.title ? responseByTitle.get(it.title) : undefined)
        const disp = getStatusDisplay(resp?.status)
        return {
          itemNumberLabel: `${itemIdx + 1}.`,
          title: it.title || 'Item sem título',
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

  // Pre-load logo and signatures asynchronously before building pages
  let logoImage = await loadLogoImage(LOGO_URL)
  if (!logoImage) {
    logoImage = await loadLogoImage(LOGO_FALLBACK_URL)
  }

  let filledBySigDimensions: { width: number; height: number; format: string } | null = null

  if (
    checklist?.filled_by_signature &&
    typeof checklist.filled_by_signature === 'string' &&
    checklist.filled_by_signature.startsWith('data:image')
  ) {
    try {
      filledBySigDimensions = await getImageDimensions(checklist.filled_by_signature)
    } catch (e) {
      console.warn('Could not load filled_by signature image dimensions', e)
    }
  }

  const safeChecklistCode = checklist?.code || 'chk-pendente'

  // Header height (16.5mm to comfortably accommodate the logo, title, and metadata)
  const headerHeight = 16.5

  // Render Compact Header on any page
  const renderHeader = (isFirstPage: boolean = true) => {
    // Header background card
    doc.setFillColor(headerBgColor[0], headerBgColor[1], headerBgColor[2])
    doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2])
    doc.setLineWidth(0.25)
    doc.roundedRect(margin, margin, contentWidth, headerHeight, 1.2, 1.2, 'FD')

    // Left accent bar
    doc.setFillColor(secondaryBlue[0], secondaryBlue[1], secondaryBlue[2])
    doc.rect(margin, margin, 2.2, headerHeight, 'F')

    // ----------------------------------------------------
    // Logo Placement (Left side of header)
    // ----------------------------------------------------
    let textStartX = margin + 4.5
    const logoMaxW = 24
    const logoMaxH = 13.5

    if (logoImage) {
      try {
        const aspect = logoImage.width / logoImage.height
        let logoW = logoMaxW
        let logoH = logoW / aspect
        if (logoH > logoMaxH) {
          logoH = logoMaxH
          logoW = logoH * aspect
        }
        const logoX = margin + 3.5
        const logoY = margin + (headerHeight - logoH) / 2
        doc.addImage(
          logoImage.data,
          logoImage.format,
          logoX,
          logoY,
          logoW,
          logoH,
          undefined,
          'FAST',
        )

        // Vertical divider line next to logo
        doc.setDrawColor(203, 213, 225)
        doc.setLineWidth(0.2)
        doc.line(
          logoX + logoW + 2.5,
          margin + 1.8,
          logoX + logoW + 2.5,
          margin + headerHeight - 1.8,
        )

        textStartX = logoX + logoW + 5
      } catch (err) {
        console.warn('Error rendering logo in header, falling back to text only', err)
      }
    }

    // ----------------------------------------------------
    // Status Badge (Top Right)
    // ----------------------------------------------------
    const isCompleted = checklist?.status === 'Concluído'
    const isRejected = checklist?.status === 'Reprovado'
    const stBadgeText = isCompleted
      ? 'LIBERADO (CONCLUÍDO)'
      : isRejected
        ? 'REPROVADO'
        : (checklist?.status || 'EM ANDAMENTO').toUpperCase()

    const badgeW = 32
    const badgeH = 4.2
    const badgeX = pageWidth - margin - badgeW - 1.5
    const badgeY = margin + 1.8
    doc.setFontSize(6.5)
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
    doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 0.8, 0.8, 'FD')
    doc.text(stBadgeText, badgeX + badgeW / 2, badgeY + 2.9, { align: 'center' })

    // ----------------------------------------------------
    // Row 1: Template Name / Main Title & Subtitle
    // ----------------------------------------------------
    const resolvedTemplateName = templateName?.trim() || checklist?.expand?.template_id?.title

    if (resolvedTemplateName) {
      // Show template name in bold uppercase on top, and subtitle below
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2])
      const mainTitleText = isFirstPage
        ? resolvedTemplateName.toUpperCase()
        : `${resolvedTemplateName.toUpperCase()} — ${safeChecklistCode}`
      const maxMainTitleLen = 48
      const truncatedTitle =
        mainTitleText.length > maxMainTitleLen
          ? mainTitleText.substring(0, maxMainTitleLen - 3) + '...'
          : mainTitleText
      doc.text(truncatedTitle, textStartX, margin + 4.2)

      // Subtitle below template name
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6.2)
      doc.setTextColor(lightMutedText[0], lightMutedText[1], lightMutedText[2])
      doc.text('Relatório de Checklist de Içamento', textStartX, margin + 7.2)
    } else {
      // Fallback: Company name on left and generic title
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7.8)
      doc.setTextColor(secondaryBlue[0], secondaryBlue[1], secondaryBlue[2])
      const compText = companyName.toUpperCase()
      const truncatedCompany = compText.length > 32 ? compText.substring(0, 30) + '...' : compText
      doc.text(truncatedCompany, textStartX, margin + 4.8)

      // Title next to company or stacked if narrow
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.2)
      doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2])
      const docTitle = isFirstPage
        ? 'RELATÓRIO DE CHECKLIST DE IÇAMENTO'
        : `RELATÓRIO DE CHECKLIST - ${safeChecklistCode}`
      const titleX = Math.max(textStartX + 58, margin + 88)
      if (titleX < badgeX - 4) {
        doc.text(docTitle, titleX, margin + 4.8)
      }
    }

    // Horizontal thin divider in header
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.15)
    doc.line(textStartX, margin + 8.2, pageWidth - margin - 1.5, margin + 8.2)

    // ----------------------------------------------------
    // Row 2: Code, Client/Obra, Dates, Risk, Emission
    // ----------------------------------------------------
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.8)
    doc.setTextColor(lightMutedText[0], lightMutedText[1], lightMutedText[2])
    doc.text('Cód: ', textStartX, margin + 12.8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(darkText[0], darkText[1], darkText[2])
    doc.text(safeChecklistCode, textStartX + 6.5, margin + 12.8)

    const clientStartX = textStartX + 26
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(lightMutedText[0], lightMutedText[1], lightMutedText[2])
    doc.text('Cliente/Obra: ', clientStartX, margin + 12.8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(darkText[0], darkText[1], darkText[2])
    const maxClientLen = 28
    const clientDisplay =
      clientName.length > maxClientLen
        ? clientName.substring(0, maxClientLen - 2) + '...'
        : clientName
    doc.text(clientDisplay, clientStartX + 16.5, margin + 12.8)

    // Dates and Risk
    const createdFormatted = formatDateTime(checklist?.scheduled_date || checklist?.created)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(lightMutedText[0], lightMutedText[1], lightMutedText[2])
    const dateX = Math.max(clientStartX + 56, margin + 115)
    doc.text(`Data: ${createdFormatted}`, dateX, margin + 12.8)

    if (checklist?.risk_level) {
      const riskX = dateX + 38
      doc.text(`Risco: `, riskX, margin + 12.8)
      doc.setFont('helvetica', 'bold')
      if (checklist.risk_level === 'Alto' || checklist.risk_level === 'Crítico') {
        doc.setTextColor(185, 28, 28)
      } else {
        doc.setTextColor(darkText[0], darkText[1], darkText[2])
      }
      doc.text(checklist.risk_level.toUpperCase(), riskX + 8.5, margin + 12.8)
    }

    doc.setFont('helvetica', 'normal')
    doc.setTextColor(lightMutedText[0], lightMutedText[1], lightMutedText[2])
    const emissionDateStr = new Date().toLocaleDateString('pt-BR')
    doc.text(`Emissão: ${emissionDateStr}`, pageWidth - margin - 2, margin + 12.8, {
      align: 'right',
    })
  }

  // Render Compact Operation & Equipment Details Block (Side-by-side 2-column or unified grid)
  const renderOperationDetails = (startY: number): number => {
    const boxHeight = 27 // Ultra compact height: 27mm
    doc.setFillColor(248, 250, 252)
    doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2])
    doc.setLineWidth(0.2)
    doc.roundedRect(margin, startY, contentWidth, boxHeight, 1.2, 1.2, 'FD')

    const halfW = (contentWidth - 2) / 2
    const leftColX = margin + 2.5
    const rightColX = margin + halfW + 3

    // Vertical separator between Operation and Equipment
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.2)
    doc.line(margin + halfW + 1, startY + 1.5, margin + halfW + 1, startY + boxHeight - 1.5)

    // Left Column: DADOS DA OPERAÇÃO
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.2)
    doc.setTextColor(secondaryBlue[0], secondaryBlue[1], secondaryBlue[2])
    doc.text('DADOS DA OPERAÇÃO', leftColX, startY + 4)

    // Right Column: EQUIPAMENTO & ACESSÓRIOS
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.2)
    doc.setTextColor(secondaryBlue[0], secondaryBlue[1], secondaryBlue[2])
    doc.text('EQUIPAMENTO E ACESSÓRIOS', rightColX, startY + 4)

    // Subtle horizontal divider under column titles
    doc.setDrawColor(235, 238, 243)
    doc.line(leftColX, startY + 5.5, leftColX + halfW - 4, startY + 5.5)
    doc.line(rightColX, startY + 5.5, rightColX + halfW - 4, startY + 5.5)

    // Helper for key-value pair
    const drawField = (x: number, y: number, label: string, val: string, maxLen = 32) => {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(6.2)
      doc.setTextColor(lightMutedText[0], lightMutedText[1], lightMutedText[2])
      doc.text(label, x, y)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(darkText[0], darkText[1], darkText[2])
      const safeVal = val || '—'
      const textToDraw =
        safeVal.length > maxLen ? safeVal.substring(0, maxLen - 2) + '...' : safeVal
      doc.text(textToDraw, x, y + 3)
    }

    // Left column items: Row 1 & Row 2 & Row 3
    const opSubColW = (halfW - 5) / 2
    const row1Y = startY + 9.5
    const row2Y = startY + 18.5

    drawField(
      leftColX,
      row1Y,
      'DATA / HORA PROG.',
      formatDateTime(checklist?.scheduled_date || checklist?.created),
      22,
    )
    drawField(leftColX + opSubColW, row1Y, 'LOCAL / FRENTE', checklist?.location || '—', 24)

    drawField(
      leftColX,
      row2Y,
      'MANOBRA / OPERAÇÃO',
      checklist?.operation_type || checklist?.title || 'Içamento de Carga',
      24,
    )
    drawField(
      leftColX + opSubColW,
      row2Y,
      'RESPONSÁVEL TÉCNICO',
      checklist?.filled_by_name || '—',
      22,
    )

    // Right column items: Equipment & Material
    const eqObj = equipment || checklist?.expand?.equipment_id
    const eqType = eqObj?.type || '—'
    const eqModel = eqObj?.model || eqObj?.manufacturer || '—'
    const eqCap = eqObj?.capacity ? `${eqObj.capacity}` : '—'
    const eqPlate = eqObj?.license_plate || '—'

    const eqSubColW = (halfW - 5) / 2
    drawField(rightColX, row1Y, 'TIPO / MODELO', `${eqType} - ${eqModel}`, 24)
    drawField(rightColX + eqSubColW, row1Y, 'CAPACIDADE / PLACA', `${eqCap} | ${eqPlate}`, 22)

    const matObj = material || checklist?.expand?.material_id
    const matStr = matObj
      ? `${matObj.type || 'Acessório'} TAG: ${matObj.tag || '—'} (${matObj.capacity || 'S/ Cap'})`.trim()
      : 'Nenhum acessório vinculado'
    drawField(rightColX, row2Y, 'ACESSÓRIOS / MATERIAIS', matStr, 48)

    return startY + boxHeight + 2.5
  }

  // Draw Page 1 header and operation details
  renderHeader(true)
  let currentY = margin + headerHeight + 2.5
  currentY = renderOperationDetails(currentY)

  // Render Groups & Items continuously across pages
  for (let gIdx = 0; gIdx < processedGroups.length; gIdx++) {
    const group = processedGroups[gIdx]

    // Check if group header banner + minimal rows fit on current page; if not, add page
    if (currentY + 16 > pageContentBottomLimit) {
      doc.addPage()
      renderHeader(false)
      currentY = margin + headerHeight + 2.5
    }

    // Section Group Header Banner
    const groupTitle =
      group.groupNumber !== null ? `${group.groupNumber}. ${group.name}` : group.name

    doc.setFillColor(secondaryBlue[0], secondaryBlue[1], secondaryBlue[2])
    doc.roundedRect(margin, currentY, contentWidth, 5, 0.8, 0.8, 'F')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(255, 255, 255)
    doc.text(groupTitle.toUpperCase(), margin + 2.5, currentY + 3.5)

    // Item count indicator on right
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.text(
      `${group.items.length} ${group.items.length === 1 ? 'item' : 'itens'}`,
      pageWidth - margin - 3,
      currentY + 3.5,
      { align: 'right' },
    )

    currentY += 5.8

    // Table of items for this group
    const tableBody =
      group.items.length > 0
        ? group.items.map((item) => {
            let fullTitle = item.title
            if (item.isCritical) fullTitle += ' [CRÍTICO]'
            if (item.isMandatory) fullTitle += ' (Obrigatório)'
            const pesoLabel = item.isCritical ? 'Crítico (Alto)' : 'Padrão'

            return [item.itemNumberLabel, fullTitle, pesoLabel, item.statusText]
          })
        : [['-', 'Nenhum item cadastrado nesta seção', '-', '-']]

    applyAutoTable(doc, {
      startY: currentY,
      head: [['Nº', 'ITEM DE VERIFICAÇÃO', 'PESO', 'RESULTADO']],
      body: tableBody,
      theme: 'grid',
      margin: { left: margin, right: margin, bottom: bottomFooterReserve + 2 },
      tableWidth: contentWidth,
      headStyles: {
        fillColor: [30, 41, 59], // Slate 800
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7,
        halign: 'left',
        cellPadding: 1.2,
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center', fontStyle: 'bold', fontSize: 7 },
        1: { cellWidth: 'auto', fontSize: 7 },
        2: { cellWidth: 22, halign: 'center', fontSize: 6.8 },
        3: { cellWidth: 26, halign: 'center', fontStyle: 'bold', fontSize: 6.8 },
      },
      styles: {
        cellPadding: 1.2,
        lineColor: borderGray,
        lineWidth: 0.12,
        textColor: darkText,
        overflow: 'linebreak',
      },
      didParseCell: (data: any) => {
        // Style evaluation column badge cells (column index 3: RESULTADO)
        if (data.section === 'body' && data.column.index === 3) {
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

    // Advance currentY after table
    currentY = ((doc as any).lastAutoTable?.finalY ?? currentY) + 2.5
  }

  // --- Concluding Section: Technical Opinion, Notes & Single Signature (Responsável pelo Preenchimento) ---
  const notesAndSignaturesHeight = 54
  if (currentY + notesAndSignaturesHeight > pageContentBottomLimit) {
    doc.addPage()
    renderHeader(false)
    currentY = margin + headerHeight + 2.5
  }

  // General Notes & Recommendations Box (Compact)
  const notesBoxH = 16
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2])
  doc.setLineWidth(0.2)
  doc.roundedRect(margin, currentY, contentWidth, notesBoxH, 1.2, 1.2, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2])
  doc.text('PARECER FINAL E OBSERVAÇÕES TÉCNICAS', margin + 2.5, currentY + 3.6)

  // Status and Conclusion stamp on right side of title
  const isApproved = checklist?.status === 'Concluído'
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.8)
  if (isApproved) {
    doc.setTextColor(6, 95, 70)
    doc.text(
      'OPERAÇÃO LIBERADA - CONFORMIDADE ATESTADA',
      margin + contentWidth - 2.5,
      currentY + 3.6,
      {
        align: 'right',
      },
    )
  } else if (checklist?.status === 'Reprovado') {
    doc.setTextColor(153, 27, 27)
    doc.text(
      'OPERAÇÃO BLOQUEADA - NÃO CONFORMIDADES',
      margin + contentWidth - 2.5,
      currentY + 3.6,
      {
        align: 'right',
      },
    )
  } else {
    doc.setTextColor(146, 64, 14)
    doc.text('EM ANDAMENTO / PENDENTE DE LIBERAÇÃO', margin + contentWidth - 2.5, currentY + 3.6, {
      align: 'right',
    })
  }

  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.15)
  doc.line(margin + 2, currentY + 5.2, margin + contentWidth - 2, currentY + 5.2)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.8)
  doc.setTextColor(darkText[0], darkText[1], darkText[2])

  const notesText =
    checklist?.notes?.trim() ||
    'Operação vistoriada conforme normas regulamentadoras vigentes (NR-11, NR-12 e NR-18). Equipamentos, acessórios e isolamento de raio de giro inspecionados no canteiro de obras.'
  const splitNotes = doc.splitTextToSize(notesText, contentWidth - 5)
  // Limit to 2 lines for compactness
  const displayedNotes = splitNotes.slice(0, 2)
  doc.text(displayedNotes, margin + 2.5, currentY + 8.8)

  currentY += notesBoxH + 2

  // Signature Box: Responsável pelo Preenchimento (Centered box)
  const sigBoxW = 100 // Clean centered signature box width (100mm)
  const sigBoxH = 34 // Compact signature box height
  const box1X = margin + (contentWidth - sigBoxW) / 2

  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2])
  doc.setLineWidth(0.2)
  doc.roundedRect(box1X, currentY, sigBoxW, sigBoxH, 1.2, 1.2, 'FD')

  // Header of Signature Box
  doc.setFillColor(241, 245, 249)
  doc.roundedRect(box1X, currentY, sigBoxW, 4.5, 1.2, 1.2, 'F')
  doc.rect(box1X, currentY + 2.5, sigBoxW, 2, 'F') // straighten bottom corners
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.8)
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2])
  doc.text('RESPONSÁVEL PELO PREENCHIMENTO', box1X + sigBoxW / 2, currentY + 3.2, {
    align: 'center',
  })

  // Signature image / placeholder
  if (
    checklist?.filled_by_signature &&
    typeof checklist.filled_by_signature === 'string' &&
    checklist.filled_by_signature.startsWith('data:image')
  ) {
    try {
      const dim = filledBySigDimensions || { width: 400, height: 200, format: 'PNG' }
      const maxImgW = sigBoxW - 12
      const maxImgH = 14
      const ratio = Math.min(maxImgW / dim.width, maxImgH / dim.height)
      const renderW = dim.width * ratio
      const renderH = dim.height * ratio
      const renderX = box1X + (sigBoxW - renderW) / 2
      const renderY = currentY + 5.5 + (maxImgH - renderH) / 2

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
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(6.5)
    doc.setTextColor(lightMutedText[0], lightMutedText[1], lightMutedText[2])
    doc.text('(Assinatura digital registrada)', box1X + sigBoxW / 2, currentY + 12.5, {
      align: 'center',
    })
  }

  // Signature line and signer details
  const line1Y = currentY + 21.5
  doc.setDrawColor(148, 163, 184)
  doc.setLineWidth(0.3)
  doc.line(box1X + 8, line1Y, box1X + sigBoxW - 8, line1Y)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.2)
  doc.setTextColor(darkText[0], darkText[1], darkText[2])
  const filledName = checklist?.filled_by_name || 'Profissional Responsável'
  doc.text(filledName, box1X + sigBoxW / 2, line1Y + 3.2, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6)
  doc.setTextColor(lightMutedText[0], lightMutedText[1], lightMutedText[2])
  doc.text(
    'Operador / Rigger / Responsável pelo Preenchimento',
    box1X + sigBoxW / 2,
    line1Y + 6.2,
    {
      align: 'center',
    },
  )
  if (checklist?.completed_at || checklist?.created) {
    const sigDate = checklist.completed_at || checklist.created
    doc.text(`Data / Hora: ${formatDateTime(sigDate)}`, box1X + sigBoxW / 2, line1Y + 9.2, {
      align: 'center',
    })
  }

  // Security Note
  currentY += sigBoxH + 1.5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(5.5)
  doc.setTextColor(lightMutedText[0], lightMutedText[1], lightMutedText[2])
  doc.text(
    'Documento emitido pelo sistema com validade técnica, rastreabilidade e assinatura eletrônica do responsável.',
    pageWidth / 2,
    currentY,
    { align: 'center' },
  )

  // --- Footers on All Pages (Page X of Y + Issue Date) ---
  const totalPages = doc.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)

    // Render header on subsequent pages if autotable created new pages automatically
    if (p > 1) {
      renderHeader(false)
    }

    const footerY = pageHeight - margin + 2

    // Top border of footer
    doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2])
    doc.setLineWidth(0.15)
    doc.line(margin, footerY - 2.5, pageWidth - margin, footerY - 2.5)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(lightMutedText[0], lightMutedText[1], lightMutedText[2])

    // Left
    doc.text(`${companyName} | ${safeChecklistCode}`, margin, footerY)

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
  const rawCode = checklist?.code || 'chk'
  const safeCode = rawCode.replace(/[^a-zA-Z0-9-_]/g, '_').toLowerCase()
  const todayStr = new Date().toISOString().split('T')[0]
  const filename = `checklist-${safeCode}-${todayStr}.pdf`

  try {
    doc.save(filename)
  } catch (saveErr: any) {
    console.error('Erro ao salvar/baixar o arquivo PDF gerado:', saveErr)
    try {
      const pdfBlob = doc.output('blob')
      const blobUrl = URL.createObjectURL(pdfBlob)
      const downloadLink = document.createElement('a')
      downloadLink.href = blobUrl
      downloadLink.download = filename
      document.body.appendChild(downloadLink)
      downloadLink.click()
      document.body.removeChild(downloadLink)
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
    } catch (fallbackErr: any) {
      throw new Error(
        `Falha ao salvar o PDF (${saveErr?.message || 'Erro de download'}). Detalhes: ${fallbackErr?.message || 'Desconhecido'}`,
      )
    }
  }
}
