import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import 'jspdf-autotable'

export interface ChecklistReportItem {
  id: string
  code: string
  title: string
  status: string
  completed_at?: string
  created?: string
  location?: string
  clientName: string
  equipmentInfo: string // "Fabricante Modelo — Placa" ou "-"
}

export interface ChecklistReportPdfOptions {
  checklists: ChecklistReportItem[]
  dateFrom: string // "DD/MM/AAAA"
  dateTo: string // "DD/MM/AAAA"
  equipmentName: string // "Todos os Equipamentos" ou "Guindaste Liebherr LTM 1050-3.1 — ABC-1234"
  companyName: string
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
 * Loads an image from a URL and converts it to a base64 data URL along with its dimensions.
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
 * Standardize status display
 */
function getStatusLabel(status?: string): string {
  switch (status) {
    case 'Concluído':
      return 'CONCLUÍDO'
    case 'Reprovado':
      return 'REPROVADO'
    case 'Em Andamento':
      return 'EM ANDAMENTO'
    case 'Pendente':
      return 'PENDENTE'
    default:
      return (status || 'PENDENTE').toUpperCase()
  }
}

export async function generateChecklistReportPdf({
  checklists = [],
  dateFrom,
  dateTo,
  equipmentName,
  companyName,
}: ChecklistReportPdfOptions): Promise<void> {
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

  // Colors
  const primaryNavy: [number, number, number] = [15, 23, 42] // Slate 900
  const secondaryBlue: [number, number, number] = [2, 132, 199] // Sky 600
  const headerBgColor: [number, number, number] = [241, 245, 249] // Slate 100
  const borderGray: [number, number, number] = [203, 213, 225] // Slate 300
  const darkText: [number, number, number] = [30, 41, 59] // Slate 800
  const lightMutedText: [number, number, number] = [100, 116, 139] // Slate 500

  const safeCompanyName = companyName || 'Davi Projetos - Engenharia e Rigging'
  let logoImage = await loadLogoImage(LOGO_URL)
  if (!logoImage) {
    logoImage = await loadLogoImage(LOGO_FALLBACK_URL)
  }

  // Header height
  const headerHeight = 16.5

  // Render Compact Header
  const renderHeader = (isFirstPage: boolean = true) => {
    // Header background card
    doc.setFillColor(headerBgColor[0], headerBgColor[1], headerBgColor[2])
    doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2])
    doc.setLineWidth(0.25)
    doc.roundedRect(margin, margin, contentWidth, headerHeight, 1.2, 1.2, 'FD')

    // Left accent bar
    doc.setFillColor(secondaryBlue[0], secondaryBlue[1], secondaryBlue[2])
    doc.rect(margin, margin, 2.2, headerHeight, 'F')

    // Logo Placement
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
        console.warn('Error rendering logo in report header:', err)
      }
    }

    // Row 1: Company Name & Main Title
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.8)
    doc.setTextColor(secondaryBlue[0], secondaryBlue[1], secondaryBlue[2])
    const compText = safeCompanyName.toUpperCase()
    const truncatedCompany = compText.length > 30 ? compText.substring(0, 28) + '...' : compText
    doc.text(truncatedCompany, textStartX, margin + 4.8)

    // Title
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.2)
    doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2])
    const docTitle = 'RELATÓRIO CONSOLIDADO DE CHECKLISTS'
    const titleX = Math.max(textStartX + 58, margin + 85)
    doc.text(docTitle, titleX, margin + 4.8)

    // Badge Total Count on top right
    const badgeW = 28
    const badgeH = 4.2
    const badgeX = pageWidth - margin - badgeW - 1.5
    const badgeY = margin + 1.8
    doc.setFillColor(224, 242, 254)
    doc.setTextColor(3, 105, 161)
    doc.setDrawColor(14, 165, 233)
    doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 0.8, 0.8, 'FD')
    doc.setFontSize(6.5)
    doc.setFont('helvetica', 'bold')
    doc.text(
      `${checklists.length} ${checklists.length === 1 ? 'REGISTRO' : 'REGISTROS'}`,
      badgeX + badgeW / 2,
      badgeY + 2.9,
      {
        align: 'center',
      },
    )

    // Horizontal thin divider in header
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.15)
    doc.line(textStartX, margin + 8.2, pageWidth - margin - 1.5, margin + 8.2)

    // Row 2: Subtitle with filters (Período & Equipamento & Data de Emissão)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.8)
    doc.setTextColor(lightMutedText[0], lightMutedText[1], lightMutedText[2])
    doc.text('Período: ', textStartX, margin + 12.8)

    doc.setFont('helvetica', 'bold')
    doc.setTextColor(darkText[0], darkText[1], darkText[2])
    const periodStr = `${dateFrom} a ${dateTo}`
    doc.text(periodStr, textStartX + 10, margin + 12.8)

    const eqStartX = textStartX + 12 + doc.getTextWidth(periodStr) + 4
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(lightMutedText[0], lightMutedText[1], lightMutedText[2])
    doc.text('Equipamento: ', eqStartX, margin + 12.8)

    doc.setFont('helvetica', 'bold')
    doc.setTextColor(darkText[0], darkText[1], darkText[2])
    const maxEqLen = 42
    const eqDisplay =
      equipmentName.length > maxEqLen
        ? equipmentName.substring(0, maxEqLen - 2) + '...'
        : equipmentName
    doc.text(eqDisplay, eqStartX + 16, margin + 12.8)

    // Emission date
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(lightMutedText[0], lightMutedText[1], lightMutedText[2])
    const emissionDateStr = new Date().toLocaleDateString('pt-BR')
    doc.text(`Emissão: ${emissionDateStr}`, pageWidth - margin - 2, margin + 12.8, {
      align: 'right',
    })
  }

  // Draw Initial Header
  renderHeader(true)
  let currentY = margin + headerHeight + 2.5

  // Summary Metrics Bar
  const summaryHeight = 12
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2])
  doc.setLineWidth(0.2)
  doc.roundedRect(margin, currentY, contentWidth, summaryHeight, 1.2, 1.2, 'FD')

  // Calculate statistics
  const countConcluido = checklists.filter((c) => c.status === 'Concluído').length
  const countReprovado = checklists.filter((c) => c.status === 'Reprovado').length
  const countAndamento = checklists.filter((c) => c.status === 'Em Andamento').length
  const countPendente = checklists.filter(
    (c) => c.status !== 'Concluído' && c.status !== 'Reprovado' && c.status !== 'Em Andamento',
  ).length

  const colW = contentWidth / 4
  const metrics = [
    {
      label: 'CONCLUÍDOS / LIBERADOS',
      count: countConcluido,
      color: [6, 95, 70] as [number, number, number],
      bg: [209, 250, 229] as [number, number, number],
    },
    {
      label: 'REPROVADOS',
      count: countReprovado,
      color: [153, 27, 27] as [number, number, number],
      bg: [254, 226, 226] as [number, number, number],
    },
    {
      label: 'EM ANDAMENTO',
      count: countAndamento,
      color: [3, 105, 161] as [number, number, number],
      bg: [224, 242, 254] as [number, number, number],
    },
    {
      label: 'PENDENTES',
      count: countPendente,
      color: [146, 64, 14] as [number, number, number],
      bg: [254, 243, 199] as [number, number, number],
    },
  ]

  metrics.forEach((m, idx) => {
    const colX = margin + idx * colW
    if (idx > 0) {
      doc.setDrawColor(226, 232, 240)
      doc.setLineWidth(0.15)
      doc.line(colX, currentY + 1.5, colX, currentY + summaryHeight - 1.5)
    }

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(5.8)
    doc.setTextColor(lightMutedText[0], lightMutedText[1], lightMutedText[2])
    doc.text(m.label, colX + colW / 2, currentY + 4, { align: 'center' })

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(m.color[0], m.color[1], m.color[2])
    doc.text(String(m.count), colX + colW / 2, currentY + 9.5, { align: 'center' })
  })

  currentY += summaryHeight + 2.5

  // Table of Checklists
  // Columns: Código, Data/Hora, Status, Cliente, Equipamento, Local
  const tableBody =
    checklists.length > 0
      ? checklists.map((chk) => {
          const code = chk.code || '-'
          const dateToFormat = chk.completed_at || chk.created
          const dateStr = formatDateTime(dateToFormat)
          const statusText = getStatusLabel(chk.status)
          const client = chk.clientName || 'Não informado'
          const equipment = chk.equipmentInfo || '-'
          const location = chk.location || '-'

          return [code, dateStr, statusText, client, equipment, location]
        })
      : [['-', '-', '-', 'Nenhum checklist encontrado para os filtros selecionados', '-', '-']]

  applyAutoTable(doc, {
    startY: currentY,
    head: [['CÓDIGO', 'DATA E HORA', 'STATUS', 'CLIENTE', 'EQUIPAMENTO', 'LOCAL / OBRA']],
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
      cellPadding: 1.5,
    },
    columnStyles: {
      0: { cellWidth: 30, fontStyle: 'bold', fontSize: 6.8, halign: 'center' },
      1: { cellWidth: 28, fontSize: 6.8, halign: 'left' },
      2: { cellWidth: 24, halign: 'center', fontStyle: 'bold', fontSize: 6.8 },
      3: { cellWidth: 38, fontSize: 6.8 },
      4: { cellWidth: 44, fontSize: 6.8 },
      5: { cellWidth: 'auto', fontSize: 6.8 },
    },
    styles: {
      cellPadding: 1.3,
      lineColor: borderGray,
      lineWidth: 0.12,
      textColor: darkText,
      overflow: 'linebreak',
    },
    didParseCell: (data: any) => {
      // Style evaluation column badge cells (column index 2: STATUS)
      if (data.section === 'body' && data.column.index === 2) {
        const rawText = data.cell.raw as string
        if (rawText === 'CONCLUÍDO') {
          data.cell.styles.fillColor = [209, 250, 229] // Emerald 100
          data.cell.styles.textColor = [6, 95, 70] // Emerald 800
        } else if (rawText === 'REPROVADO') {
          data.cell.styles.fillColor = [254, 226, 226] // Red 100
          data.cell.styles.textColor = [153, 27, 27] // Red 800
        } else if (rawText === 'EM ANDAMENTO') {
          data.cell.styles.fillColor = [224, 242, 254] // Blue 100
          data.cell.styles.textColor = [3, 105, 161] // Blue 800
        } else {
          data.cell.styles.fillColor = [254, 243, 199] // Amber 100
          data.cell.styles.textColor = [146, 64, 14] // Amber 800
        }
      }
    },
  })

  // Footers on All Pages
  const totalPages = doc.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)

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
    doc.text(`${safeCompanyName} | Relatório Consolidado de Checklists`, margin, footerY)

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

  // Download filename: relatorio-checklists-{data}.pdf
  const todayStr = new Date().toISOString().split('T')[0]
  const filename = `relatorio-checklists-${todayStr}.pdf`

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
        `Falha ao salvar o PDF consolidado (${saveErr?.message || 'Erro de download'}). Detalhes: ${fallbackErr?.message || 'Desconhecido'}`,
      )
    }
  }
}
