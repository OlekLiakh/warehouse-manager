import type { Invoice, InvoiceSubtype } from '../types'

export interface InvoiceItem {
  product_id: string
  product_name: string
  quantity: number
  current_stock: number
}

export function validateInvoice(
  type: 'IN' | 'OUT',
  items: InvoiceItem[],
  subtype?: InvoiceSubtype | null
): string | null {
  if (items.length === 0) return 'Додайте хоча б один товар'
  if (type === 'OUT' && !subtype) return 'Оберіть тип видачі'
  for (const item of items) {
    if (!item.quantity || item.quantity <= 0) {
      return `${item.product_name}: кількість має бути більше 0`
    }
    if (type === 'OUT' && item.quantity > item.current_stock) {
      return `${item.product_name}: недостатньо товару (на складі: ${item.current_stock})`
    }
  }
  return null
}

const SUBTYPE_LABELS: Record<InvoiceSubtype, string> = {
  DNIPRO: '🚚 Дніпро',
  PICKUP: '🧍 Самовивіз',
  NOVA_POSHTA: '📮 Нова Пошта',
}

export function getInvoiceLabel(invoice: Pick<Invoice, 'type' | 'subtype' | 'counterparty' | 'invoice_number'>): string {
  const parts: string[] = []

  if (invoice.type === 'IN') {
    parts.push('📦 Прихід')
  } else if (invoice.subtype) {
    parts.push(SUBTYPE_LABELS[invoice.subtype])
  } else {
    parts.push('📤 Видача')
  }

  if (invoice.counterparty) parts.push(invoice.counterparty)
  if (invoice.invoice_number) parts.push(`ПН №${invoice.invoice_number}`)

  return parts.join(' — ')
}

export function canCancelInvoice(invoice: Pick<Invoice, 'created_at'>): boolean {
  const today = new Date().toDateString()
  const invoiceDate = new Date(invoice.created_at).toDateString()
  return today === invoiceDate
}
