import type { Invoice, InvoiceSubtype } from '../types'

export interface InvoiceItem {
  product_id: string
  product_name: string
  quantity: number
  current_stock: number
}

export interface OrderDraft {
  delivery_details: string
  note: string
  items: InvoiceItem[]
}

export function validateInvoice(
  type: 'IN' | 'OUT',
  items: InvoiceItem[],
  subtype?: InvoiceSubtype | null,
  orders?: OrderDraft[]
): string | null {
  if (type === 'OUT') {
    if (!subtype) return 'Оберіть тип видачі'
    if (!orders || orders.length === 0) return 'Додайте хоча б одне замовлення'
    for (let i = 0; i < orders.length; i++) {
      const order = orders[i]
      if (order.items.length === 0) return `Замовлення ${i + 1}: додайте хоча б один товар`
      for (const item of order.items) {
        if (!item.quantity || item.quantity <= 0) {
          return `Замовлення ${i + 1}, ${item.product_name}: кількість має бути більше 0`
        }
        if (item.quantity > item.current_stock) {
          return `Замовлення ${i + 1}, ${item.product_name}: недостатньо товару (на складі: ${item.current_stock})`
        }
      }
    }
    return null
  }

  // IN validation
  if (items.length === 0) return 'Додайте хоча б один товар'
  for (const item of items) {
    if (!item.quantity || item.quantity <= 0) {
      return `${item.product_name}: кількість має бути більше 0`
    }
  }
  return null
}

const SUBTYPE_LABELS: Record<InvoiceSubtype, string> = {
  DNIPRO: '🚚 Дніпро',
  PICKUP: '🧍 Самовивіз',
  NOVA_POSHTA: '📮 Нова Пошта',
}

export function getSubtypeLabel(subtype: InvoiceSubtype): string {
  return SUBTYPE_LABELS[subtype]
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

  if (invoice.invoice_number) parts.push(`ПН №${invoice.invoice_number}`)

  return parts.join(' — ')
}

export function canCancelInvoice(invoice: Pick<Invoice, 'created_at'>): boolean {
  const today = new Date().toDateString()
  const invoiceDate = new Date(invoice.created_at).toDateString()
  return today === invoiceDate
}
