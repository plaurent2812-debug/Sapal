import { jsPDF } from 'jspdf'

// ---------- Constants ----------

const PAGE_WIDTH = 210 // A4 mm
const MARGIN_LEFT = 20
const MARGIN_RIGHT = 20
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT
const TVA_RATE = 0.20

const COLORS = {
  primary:   [26, 54, 93]     as [number, number, number], // dark blue
  secondary: [100, 116, 139]  as [number, number, number], // slate-500
  lightBg:   [241, 245, 249]  as [number, number, number], // slate-100
  border:    [203, 213, 225]  as [number, number, number], // slate-300
  white:     [255, 255, 255]  as [number, number, number],
  black:     [15, 23, 42]     as [number, number, number], // slate-900
}

// SAPAL hardcoded identity (buyer)
const SAPAL = {
  name:        'SAPAL Signalisation',
  address:     '260 Av. Michel Jourdan',
  postalCode:  '06150',
  city:        'Cannes',
  email:       'societe@sapal.fr',
  phone:       '06 22 90 28 54',
  siret:       'XXX XXX XXX XXXXX',
  tvaIntracom: 'FR XX XXX XXX XXX',
}

// ---------- Helpers ----------

/** Format a number as French currency: 1 234,56 \u20ac */
function formatEUR(value: number): string {
  return value
    .toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .replace(/\u202f/g, ' ')
    .replace(/\u00a0/g, ' ')
    .concat(' \u20ac')
}

// ---------- Input type ----------

export interface BdcItem {
  reference: string
  name: string
  variantLabel?: string
  quantity: number
  unitPrice: number
}

export interface BdcData {
  bdcNumber: string
  date: string
  supplier: {
    name: string
    address?: string
    postalCode?: string
    city?: string
    siret?: string
    email?: string
    contactName?: string
  }
  delivery?: {
    address: string
    postalCode: string
    city: string
    contactName?: string
  }
  items: BdcItem[]
  totalHT: number
}

// ---------- Main generator ----------

export function generateBdcPDF(data: BdcData): Buffer {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  let y = 20

  // ===== HEADER BANNER =====
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
  doc.text(`${SAPAL.email}  |  ${SAPAL.phone}`, MARGIN_LEFT, 31)
  doc.text(`${SAPAL.address}, ${SAPAL.postalCode} ${SAPAL.city}`, MARGIN_LEFT, 37)

  y = 52

  // ===== BDC TITLE =====
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.primary)
  doc.text('BON DE COMMANDE', MARGIN_LEFT, y)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.secondary)
  doc.text(`N\u00b0 ${data.bdcNumber}`, MARGIN_LEFT + 72, y)

  doc.text(`Date : ${data.date}`, PAGE_WIDTH - MARGIN_RIGHT, y, { align: 'right' })

  y += 4
  doc.setDrawColor(...COLORS.primary)
  doc.setLineWidth(0.5)
  doc.line(MARGIN_LEFT, y, PAGE_WIDTH - MARGIN_RIGHT, y)

  y += 10

  // ===== ADDRESS BLOCKS: SAPAL (left) / SUPPLIER (right) =====
  const blockWidth = (CONTENT_WIDTH - 10) / 2
  const sapalX = MARGIN_LEFT
  const supplierX = MARGIN_LEFT + blockWidth + 10
  const blockStartY = y

  // --- SAPAL block (buyer) ---
  doc.setFillColor(...COLORS.lightBg)
  doc.roundedRect(sapalX, y, blockWidth, 42, 2, 2, 'F')

  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.primary)
  doc.text('ACHETEUR', sapalX + 5, y + 6)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...COLORS.black)
  doc.text(SAPAL.name, sapalX + 5, y + 13)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...COLORS.secondary)
  doc.text(`SIRET : ${SAPAL.siret}`, sapalX + 5, y + 19)
  doc.text(`TVA Intracom. : ${SAPAL.tvaIntracom}`, sapalX + 5, y + 24)
  doc.text(SAPAL.address, sapalX + 5, y + 30)
  doc.text(`${SAPAL.postalCode} ${SAPAL.city}`, sapalX + 5, y + 35)
  doc.text(`${SAPAL.email}  |  ${SAPAL.phone}`, sapalX + 5, y + 40)

  // --- Supplier block (recipient) ---
  doc.setFillColor(...COLORS.lightBg)
  doc.roundedRect(supplierX, y, blockWidth, 42, 2, 2, 'F')

  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.primary)
  doc.text('FOURNISSEUR', supplierX + 5, y + 6)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...COLORS.black)
  doc.text(data.supplier.name, supplierX + 5, y + 13)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...COLORS.secondary)

  let supplierLineY = y + 19
  if (data.supplier.siret) {
    doc.text(`SIRET : ${data.supplier.siret}`, supplierX + 5, supplierLineY)
    supplierLineY += 5
  }
  if (data.supplier.contactName) {
    doc.text(data.supplier.contactName, supplierX + 5, supplierLineY)
    supplierLineY += 5
  }
  if (data.supplier.address) {
    doc.text(data.supplier.address, supplierX + 5, supplierLineY)
    supplierLineY += 5
  }
  if (data.supplier.postalCode || data.supplier.city) {
    doc.text(
      `${data.supplier.postalCode ?? ''} ${data.supplier.city ?? ''}`.trim(),
      supplierX + 5,
      supplierLineY
    )
    supplierLineY += 5
  }
  if (data.supplier.email) {
    doc.text(data.supplier.email, supplierX + 5, supplierLineY)
  }

  y = blockStartY + 42 + 10

  // ===== DELIVERY ADDRESS BLOCK (optional) =====
  if (data.delivery) {
    const deliveryBlockHeight = 28
    doc.setFillColor(...COLORS.lightBg)
    doc.roundedRect(MARGIN_LEFT, y, CONTENT_WIDTH, deliveryBlockHeight, 2, 2, 'F')

    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...COLORS.primary)
    doc.text('ADRESSE DE LIVRAISON', MARGIN_LEFT + 5, y + 6)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...COLORS.secondary)

    let deliveryLineY = y + 13
    if (data.delivery.contactName) {
      doc.text(data.delivery.contactName, MARGIN_LEFT + 5, deliveryLineY)
      deliveryLineY += 5
    }
    doc.text(data.delivery.address, MARGIN_LEFT + 5, deliveryLineY)
    deliveryLineY += 5
    doc.text(`${data.delivery.postalCode} ${data.delivery.city}`, MARGIN_LEFT + 5, deliveryLineY)

    y += deliveryBlockHeight + 10
  }

  // ===== PRODUCTS TABLE =====
  const cols = {
    ref:     { x: 0,   w: 25 },
    name:    { x: 25,  w: 67 },
    qty:     { x: 92,  w: 18 },
    unitHT:  { x: 110, w: 28 },
    totalHT: { x: 138, w: 32 },
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
  doc.text('R\u00e9f.',        TABLE_X + cols.ref.x + 3,                        headerY)
  doc.text('D\u00e9signation', TABLE_X + cols.name.x + 3,                       headerY)
  doc.text('Qt\u00e9',         TABLE_X + cols.qty.x + cols.qty.w - 3,           headerY, { align: 'right' })
  doc.text('Prix unit. HT',    TABLE_X + cols.unitHT.x + cols.unitHT.w - 3,     headerY, { align: 'right' })
  doc.text('Total HT',         TABLE_X + cols.totalHT.x + cols.totalHT.w - 3,   headerY, { align: 'right' })

  y += ROW_HEIGHT + 2

  // Data rows
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)

  data.items.forEach((item, index) => {
    // New page if needed
    if (y > 240) {
      doc.addPage()
      y = 20
    }

    const isOdd = index % 2 === 0
    if (isOdd) {
      doc.setFillColor(...COLORS.lightBg)
      doc.rect(TABLE_X, y, CONTENT_WIDTH, ROW_HEIGHT, 'F')
    }

    const rowY = y + 5.5
    const lineTotal = item.quantity * item.unitPrice

    // Build designation: name + optional variant
    const rawName = item.variantLabel
      ? `${item.name} — ${item.variantLabel}`
      : item.name
    const maxNameLen = 42
    const displayName = rawName.length > maxNameLen
      ? rawName.slice(0, maxNameLen - 1) + '\u2026'
      : rawName

    doc.setTextColor(...COLORS.black)
    doc.text(item.reference || '-',   TABLE_X + cols.ref.x + 3,                      rowY)
    doc.text(displayName,             TABLE_X + cols.name.x + 3,                      rowY)
    doc.text(String(item.quantity),   TABLE_X + cols.qty.x + cols.qty.w - 3,          rowY, { align: 'right' })
    doc.text(formatEUR(item.unitPrice), TABLE_X + cols.unitHT.x + cols.unitHT.w - 3, rowY, { align: 'right' })

    doc.setFont('helvetica', 'bold')
    doc.text(formatEUR(lineTotal),    TABLE_X + cols.totalHT.x + cols.totalHT.w - 3, rowY, { align: 'right' })
    doc.setFont('helvetica', 'normal')

    y += ROW_HEIGHT
  })

  // Bottom border of table
  doc.setDrawColor(...COLORS.border)
  doc.setLineWidth(0.3)
  doc.line(TABLE_X, y, TABLE_X + CONTENT_WIDTH, y)

  y += 8

  // ===== TOTALS =====
  const totalHT = data.totalHT
  const tva = totalHT * TVA_RATE
  const totalTTC = totalHT + tva

  const totalsX = TABLE_X + CONTENT_WIDTH - 75
  const totalsW = 75
  const labelX = totalsX + 3
  const valueX = totalsX + totalsW - 3

  // Background for totals block
  doc.setFillColor(...COLORS.lightBg)
  doc.roundedRect(totalsX, y - 2, totalsW, 35, 2, 2, 'F')

  // Total HT
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.black)
  doc.text('Total HT', labelX, y + 5)
  doc.text(formatEUR(totalHT), valueX, y + 5, { align: 'right' })
  y += 8

  // TVA
  doc.setTextColor(...COLORS.secondary)
  doc.text('TVA (20\u00a0%)', labelX, y + 5)
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

  // ===== FOOTER =====
  const footerY = 282
  doc.setDrawColor(...COLORS.border)
  doc.setLineWidth(0.3)
  doc.line(MARGIN_LEFT, footerY - 4, PAGE_WIDTH - MARGIN_RIGHT, footerY - 4)

  doc.setFontSize(6.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.secondary)
  doc.text(
    `${SAPAL.name} \u2014 SIRET\u00a0: ${SAPAL.siret} \u2014 TVA Intracommunautaire\u00a0: ${SAPAL.tvaIntracom}`,
    PAGE_WIDTH / 2,
    footerY,
    { align: 'center' }
  )
  doc.text(
    `${SAPAL.address}, ${SAPAL.postalCode} ${SAPAL.city} \u2014 ${SAPAL.phone} \u2014 ${SAPAL.email}`,
    PAGE_WIDTH / 2,
    footerY + 4,
    { align: 'center' }
  )

  // Return raw Buffer (Node.js)
  return Buffer.from(doc.output('arraybuffer'))
}
