import { jsPDF } from 'jspdf'

// ---------- Types ----------

export interface ChorusInvoiceItem {
  reference: string
  productName: string
  quantity: number
  unitPriceHT: number
}

export interface ChorusInvoiceData {
  invoiceNumber: string
  date: string
  /** Fournisseur */
  supplier: {
    name: string
    siret: string
    tvaIntracom: string
    address: string
    postalCode: string
    city: string
    phone: string
    email: string
  }
  /** Client */
  client: {
    entity: string
    contactName: string
    email: string
    phone: string
    siret?: string
    tvaIntracom?: string
    address?: string
    postalCode?: string
    city?: string
    clientType?: string
  }
  items: ChorusInvoiceItem[]
  /** If true, display "TVA non applicable, art. 293 B du CGI" */
  tvaExempt?: boolean
}

// ---------- Helpers ----------

/** Format a number as French currency: 1 234,56 EUR */
function formatEUR(value: number): string {
  return value
    .toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .concat(' \u20ac')
}

/** Format date as DD/MM/YYYY */
function formatDateFR(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
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
  accent: [37, 99, 235] as [number, number, number],      // blue-600
}

// ---------- Main generator ----------

export function generateChorusPDF(data: ChorusInvoiceData): jsPDF {
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
  doc.text(`${data.supplier.email}  |  ${data.supplier.phone}`, MARGIN_LEFT, 31)
  doc.text(`${data.supplier.address}, ${data.supplier.postalCode} ${data.supplier.city}`, MARGIN_LEFT, 37)

  y = 52

  // ===== FACTURE TITLE =====
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.primary)
  doc.text('FACTURE', MARGIN_LEFT, y)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.secondary)
  doc.text(`N\u00b0 ${data.invoiceNumber}`, MARGIN_LEFT + 45, y)

  doc.text(`Date : ${formatDateFR(data.date)}`, PAGE_WIDTH - MARGIN_RIGHT, y, { align: 'right' })

  y += 4
  doc.setDrawColor(...COLORS.primary)
  doc.setLineWidth(0.5)
  doc.line(MARGIN_LEFT, y, PAGE_WIDTH - MARGIN_RIGHT, y)

  y += 10

  // ===== SUPPLIER + CLIENT BLOCKS (side by side) =====
  const blockWidth = (CONTENT_WIDTH - 10) / 2
  const supplierX = MARGIN_LEFT
  const clientX = MARGIN_LEFT + blockWidth + 10
  const blockStartY = y

  // --- Supplier block ---
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
  doc.text(`SIRET : ${data.supplier.siret}`, supplierX + 5, y + 19)
  doc.text(`TVA Intracom. : ${data.supplier.tvaIntracom}`, supplierX + 5, y + 24)
  doc.text(data.supplier.address, supplierX + 5, y + 30)
  doc.text(`${data.supplier.postalCode} ${data.supplier.city}`, supplierX + 5, y + 35)
  doc.text(`T\u00e9l. : ${data.supplier.phone}`, supplierX + 5, y + 40)

  // --- Client block ---
  doc.setFillColor(...COLORS.lightBg)
  doc.roundedRect(clientX, y, blockWidth, 42, 2, 2, 'F')

  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.primary)
  doc.text('CLIENT', clientX + 5, y + 6)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...COLORS.black)
  doc.text(data.client.entity, clientX + 5, y + 13)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...COLORS.secondary)

  let clientLineY = y + 19
  doc.text(data.client.contactName, clientX + 5, clientLineY)
  clientLineY += 5

  if (data.client.siret) {
    doc.text(`SIRET : ${data.client.siret}`, clientX + 5, clientLineY)
    clientLineY += 5
  }
  if (data.client.tvaIntracom) {
    doc.text(`TVA Intracom. : ${data.client.tvaIntracom}`, clientX + 5, clientLineY)
    clientLineY += 5
  }
  if (data.client.address) {
    doc.text(data.client.address, clientX + 5, clientLineY)
    clientLineY += 5
  }
  if (data.client.postalCode || data.client.city) {
    doc.text(
      `${data.client.postalCode || ''} ${data.client.city || ''}`.trim(),
      clientX + 5,
      clientLineY
    )
  }

  y = blockStartY + 42 + 10

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
  doc.text('R\u00e9f.',           TABLE_X + cols.ref.x + 3,                            headerY)
  doc.text('D\u00e9signation',    TABLE_X + cols.name.x + 3,                           headerY)
  doc.text('Qt\u00e9',            TABLE_X + cols.qty.x + cols.qty.w - 3,               headerY, { align: 'right' })
  doc.text('P.U. HT',        TABLE_X + cols.unitHT.x + cols.unitHT.w - 3,         headerY, { align: 'right' })
  doc.text('Total HT',       TABLE_X + cols.totalHT.x + cols.totalHT.w - 3,       headerY, { align: 'right' })

  y += ROW_HEIGHT + 2

  // Data rows
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)

  data.items.forEach((item, index) => {
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
    const totalHT = item.quantity * item.unitPriceHT

    doc.setTextColor(...COLORS.black)
    doc.text(item.reference || '-', TABLE_X + cols.ref.x + 3, rowY)

    const maxNameLen = 42
    const displayName = item.productName.length > maxNameLen
      ? item.productName.slice(0, maxNameLen - 1) + '\u2026'
      : item.productName
    doc.text(displayName, TABLE_X + cols.name.x + 3, rowY)

    doc.text(String(item.quantity), TABLE_X + cols.qty.x + cols.qty.w - 3, rowY, { align: 'right' })
    doc.text(formatEUR(item.unitPriceHT), TABLE_X + cols.unitHT.x + cols.unitHT.w - 3, rowY, { align: 'right' })

    doc.setFont('helvetica', 'bold')
    doc.text(formatEUR(totalHT), TABLE_X + cols.totalHT.x + cols.totalHT.w - 3, rowY, { align: 'right' })
    doc.setFont('helvetica', 'normal')

    y += ROW_HEIGHT
  })

  // Bottom border of table
  doc.setDrawColor(...COLORS.border)
  doc.setLineWidth(0.3)
  doc.line(TABLE_X, y, TABLE_X + CONTENT_WIDTH, y)

  y += 8

  // ===== TOTALS =====
  const totalHT = data.items.reduce((sum, item) => sum + item.quantity * item.unitPriceHT, 0)
  const tva = data.tvaExempt ? 0 : totalHT * TVA_RATE
  const totalTTC = totalHT + tva

  const totalsX = TABLE_X + CONTENT_WIDTH - 75
  const totalsW = 75
  const labelX = totalsX + 3
  const valueX = totalsX + totalsW - 3

  // Background for totals block
  doc.setFillColor(...COLORS.lightBg)
  doc.roundedRect(totalsX, y - 2, totalsW, data.tvaExempt ? 28 : 35, 2, 2, 'F')

  // Total HT
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.black)
  doc.text('Total HT', labelX, y + 5)
  doc.text(formatEUR(totalHT), valueX, y + 5, { align: 'right' })
  y += 8

  // TVA
  if (data.tvaExempt) {
    doc.setFontSize(7)
    doc.setTextColor(...COLORS.secondary)
    doc.text('TVA non applicable', labelX, y + 5)
    doc.text('art. 293 B du CGI', labelX, y + 9)
    y += 11
  } else {
    doc.setTextColor(...COLORS.secondary)
    doc.text('TVA (20 %)', labelX, y + 5)
    doc.text(formatEUR(tva), valueX, y + 5, { align: 'right' })
    y += 8
  }

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

  // ===== PAYMENT CONDITIONS =====
  if (y > 250) { doc.addPage(); y = 20 }

  doc.setFillColor(248, 250, 252) // slate-50
  doc.roundedRect(MARGIN_LEFT, y, CONTENT_WIDTH, 30, 2, 2, 'F')
  doc.setDrawColor(...COLORS.border)
  doc.setLineWidth(0.3)
  doc.roundedRect(MARGIN_LEFT, y, CONTENT_WIDTH, 30, 2, 2, 'S')

  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.primary)
  doc.text('Conditions de paiement', MARGIN_LEFT + 5, y + 6)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...COLORS.black)
  doc.text('Paiement \u00e0 30 jours \u00e0 compter de la date de r\u00e9ception de la facture.', MARGIN_LEFT + 5, y + 13)

  doc.setTextColor(...COLORS.secondary)
  doc.text(
    'En cas de retard de paiement, une p\u00e9nalit\u00e9 de 3 fois le taux d\u2019int\u00e9r\u00eat l\u00e9gal sera appliqu\u00e9e,',
    MARGIN_LEFT + 5, y + 19
  )
  doc.text(
    'conform\u00e9ment \u00e0 l\u2019article L.441-10 du Code de commerce. Indemnit\u00e9 forfaitaire de recouvrement : 40,00 \u20ac.',
    MARGIN_LEFT + 5, y + 24
  )

  y += 38

  // ===== TVA MENTION (if exempt) =====
  if (data.tvaExempt) {
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(...COLORS.secondary)
    doc.text('TVA non applicable, art. 293 B du CGI.', MARGIN_LEFT, y)
    y += 8
  }

  // ===== CHORUS PRO MENTION =====
  doc.setFontSize(7)
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(...COLORS.secondary)
  doc.text('Document conforme aux exigences Chorus Pro pour le d\u00e9p\u00f4t de factures aux collectivit\u00e9s publiques.', MARGIN_LEFT, y)

  // ===== FOOTER =====
  const footerY = 282
  doc.setDrawColor(...COLORS.border)
  doc.setLineWidth(0.3)
  doc.line(MARGIN_LEFT, footerY - 4, PAGE_WIDTH - MARGIN_RIGHT, footerY - 4)

  doc.setFontSize(6.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.secondary)
  doc.text(
    `${data.supplier.name} \u2014 SIRET : ${data.supplier.siret} \u2014 TVA Intracommunautaire : ${data.supplier.tvaIntracom}`,
    PAGE_WIDTH / 2,
    footerY,
    { align: 'center' }
  )
  doc.text(
    `${data.supplier.address}, ${data.supplier.postalCode} ${data.supplier.city} \u2014 ${data.supplier.phone} \u2014 ${data.supplier.email}`,
    PAGE_WIDTH / 2,
    footerY + 4,
    { align: 'center' }
  )

  return doc
}
