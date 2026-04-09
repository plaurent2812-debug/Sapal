import { jsPDF } from 'jspdf'

// ---------- Types ----------

export interface QuotePDFItem {
  reference: string
  productName: string
  quantity: number
  unitPriceHT: number
  delai?: string
}

export interface QuotePDFData {
  quoteId: string
  date: string
  entity: string
  contactName: string
  email: string
  phone: string
  items: QuotePDFItem[]
}

// ---------- Helpers ----------

/** Format a number as French currency: 1 234,56 € */
function formatEUR(value: number): string {
  return value
    .toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .replace(/\u202f/g, ' ')
    .replace(/\u00a0/g, ' ')
    .concat(' €')
}

/** Shorten a UUID for display: first 8 chars uppercase */
function shortId(id: string): string {
  return id.replace(/-/g, '').slice(0, 8).toUpperCase()
}

// ---------- Constants ----------

const PAGE_WIDTH = 210 // A4 mm
const MARGIN_LEFT = 20
const MARGIN_RIGHT = 20
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT
const TVA_RATE = 0.20

const COLORS = {
  primary: [26, 54, 93] as [number, number, number],     // dark blue
  secondary: [100, 116, 139] as [number, number, number], // slate-500
  lightBg: [241, 245, 249] as [number, number, number],   // slate-100
  border: [203, 213, 225] as [number, number, number],    // slate-300
  white: [255, 255, 255] as [number, number, number],
  black: [15, 23, 42] as [number, number, number],        // slate-900
}

// ---------- Main generator ----------

export function generateQuotePDF(data: QuotePDFData): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  let y = 20

  // ===== HEADER =====
  doc.setFillColor(...COLORS.primary)
  doc.rect(0, 0, PAGE_WIDTH, 40, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(...COLORS.white)
  doc.text('SAPAL Signalisation', MARGIN_LEFT, 18)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(200, 210, 230)
  doc.text('Mobilier urbain & signalisation', MARGIN_LEFT, 25)
  doc.text('societe@sapal.fr  |  06 22 90 28 54', MARGIN_LEFT, 31)
  doc.text('260 Av. Michel Jourdan, 06150 Cannes', MARGIN_LEFT, 37)

  y = 52

  // ===== DEVIS TITLE =====
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.primary)
  doc.text(`DEVIS N° ${shortId(data.quoteId)}`, MARGIN_LEFT, y)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.secondary)
  doc.text(`Date : ${data.date}`, PAGE_WIDTH - MARGIN_RIGHT, y, { align: 'right' })

  y += 4
  doc.setDrawColor(...COLORS.primary)
  doc.setLineWidth(0.5)
  doc.line(MARGIN_LEFT, y, PAGE_WIDTH - MARGIN_RIGHT, y)

  y += 10

  // ===== CLIENT INFO =====
  doc.setFillColor(...COLORS.lightBg)
  doc.roundedRect(MARGIN_LEFT, y, CONTENT_WIDTH, 32, 2, 2, 'F')

  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.primary)
  doc.text('Client', MARGIN_LEFT + 6, y + 7)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...COLORS.black)
  doc.text(data.entity, MARGIN_LEFT + 6, y + 14)
  doc.text(data.contactName, MARGIN_LEFT + 6, y + 20)

  doc.setTextColor(...COLORS.secondary)
  doc.text(data.email, MARGIN_LEFT + 6, y + 26)
  doc.text(data.phone, MARGIN_LEFT + CONTENT_WIDTH / 2, y + 26)

  y += 42

  // ===== PRODUCTS TABLE =====

  // Column definitions (x-offset from MARGIN_LEFT, width)
  const cols = {
    ref:      { x: 0,                    w: 25 },
    name:     { x: 25,                   w: 72 },
    qty:      { x: 97,                   w: 20 },
    unitHT:   { x: 117,                  w: 28 },
    totalHT:  { x: 145,                  w: 25 },
  }

  const ROW_HEIGHT = 8
  const TABLE_X = MARGIN_LEFT

  // Header row
  doc.setFillColor(...COLORS.primary)
  doc.rect(TABLE_X, y, CONTENT_WIDTH, ROW_HEIGHT + 2, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...COLORS.white)

  const headerY = y + 6
  doc.text('Réf.',        TABLE_X + cols.ref.x + 3,       headerY)
  doc.text('Désignation', TABLE_X + cols.name.x + 3,      headerY)
  doc.text('Qté',         TABLE_X + cols.qty.x + cols.qty.w - 3, headerY, { align: 'right' })
  doc.text('P.U. HT',     TABLE_X + cols.unitHT.x + cols.unitHT.w - 3, headerY, { align: 'right' })
  doc.text('Total HT',    TABLE_X + cols.totalHT.x + cols.totalHT.w - 3, headerY, { align: 'right' })

  y += ROW_HEIGHT + 2

  // Data rows
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)

  data.items.forEach((item, index) => {
    // Check if we need a new page
    if (y > 260) {
      doc.addPage()
      y = 20
    }

    const isOdd = index % 2 === 0
    if (isOdd) {
      doc.setFillColor(...COLORS.lightBg)
      doc.rect(TABLE_X, y, CONTENT_WIDTH, ROW_HEIGHT, 'F')
    }

    const rowY = y + 5.5
    const totalHT = item.quantity * item.unitPriceHT

    doc.setTextColor(...COLORS.black)
    doc.text(item.reference || '-',             TABLE_X + cols.ref.x + 3,  rowY)
    // Truncate product name if too long
    const maxNameLen = 48
    const displayName = item.productName.length > maxNameLen
      ? item.productName.slice(0, maxNameLen - 1) + '…'
      : item.productName
    doc.text(displayName,                        TABLE_X + cols.name.x + 3, rowY)
    doc.text(String(item.quantity),              TABLE_X + cols.qty.x + cols.qty.w - 3, rowY, { align: 'right' })
    doc.text(formatEUR(item.unitPriceHT),       TABLE_X + cols.unitHT.x + cols.unitHT.w - 3, rowY, { align: 'right' })
    doc.setFont('helvetica', 'bold')
    doc.text(formatEUR(totalHT),                TABLE_X + cols.totalHT.x + cols.totalHT.w - 3, rowY, { align: 'right' })
    doc.setFont('helvetica', 'normal')

    y += ROW_HEIGHT

    // Délai de livraison sous le nom du produit
    if (item.delai) {
      doc.setFontSize(7)
      doc.setFont('helvetica', 'italic')
      doc.setTextColor(...COLORS.secondary)
      const delaiText = /^\d+(\.\d+)?$/.test(item.delai) ? (Number(item.delai) >= 14 ? `${Math.ceil(Number(item.delai) / 7)} semaines` : `${item.delai} jours`) : item.delai
      doc.text(`Délai : ${delaiText}`, TABLE_X + cols.name.x + 3, y + 3)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      y += 5
    }
  })

  // Bottom border of table
  doc.setDrawColor(...COLORS.border)
  doc.setLineWidth(0.3)
  doc.line(TABLE_X, y, TABLE_X + CONTENT_WIDTH, y)

  y += 6

  // ===== TOTALS =====
  const totalHT = data.items.reduce((sum, item) => sum + item.quantity * item.unitPriceHT, 0)
  const tva = totalHT * TVA_RATE
  const totalTTC = totalHT + tva

  const totalsX = TABLE_X + CONTENT_WIDTH - 65
  const totalsW = 65
  const labelX = totalsX + 3
  const valueX = totalsX + totalsW - 3

  // Subtotal HT
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.black)
  doc.text('Total HT', labelX, y + 5)
  doc.text(formatEUR(totalHT), valueX, y + 5, { align: 'right' })
  y += 7

  // TVA
  doc.setTextColor(...COLORS.secondary)
  doc.text('TVA (20 %)', labelX, y + 5)
  doc.text(formatEUR(tva), valueX, y + 5, { align: 'right' })
  y += 8

  // Separator
  doc.setDrawColor(...COLORS.primary)
  doc.setLineWidth(0.5)
  doc.line(totalsX, y, totalsX + totalsW, y)
  y += 2

  // Total TTC
  doc.setFillColor(...COLORS.primary)
  doc.roundedRect(totalsX, y, totalsW, 10, 1, 1, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...COLORS.white)
  doc.text('Total TTC', labelX, y + 7)
  doc.text(formatEUR(totalTTC), valueX, y + 7, { align: 'right' })

  y += 20

  // ===== DELIVERY TIME =====
  const delais = data.items.filter(i => i.delai).map(i => i.delai!)
  if (delais.length > 0) {
    if (y > 265) { doc.addPage(); y = 20 }
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...COLORS.primary)
    const formatDelai = (d: string) => /^\d+(\.\d+)?$/.test(d) ? (Number(d) >= 14 ? `${Math.ceil(Number(d) / 7)} semaines` : `${d} jours`) : d
    doc.text(`Délai de livraison : ${[...new Set(delais)].map(formatDelai).join(', ')}`, MARGIN_LEFT, y)
    y += 8
  }

  // ===== VALIDITY =====
  if (y > 265) { doc.addPage(); y = 20 }
  doc.setFontSize(9)
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(...COLORS.secondary)
  doc.text('Devis valable 30 jours à compter de la date d\'émission.', MARGIN_LEFT, y)

  // ===== FOOTER =====
  const footerY = 285
  doc.setDrawColor(...COLORS.border)
  doc.setLineWidth(0.3)
  doc.line(MARGIN_LEFT, footerY - 4, PAGE_WIDTH - MARGIN_RIGHT, footerY - 4)

  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.secondary)
  doc.text(
    'SAPAL Signalisation — SIRET : XXX XXX XXX XXXXX — RCS Ville — TVA intracommunautaire : FR XX XXX XXX XXX',
    PAGE_WIDTH / 2,
    footerY,
    { align: 'center' }
  )

  return doc
}
