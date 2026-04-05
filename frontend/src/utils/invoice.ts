export interface InvoiceItem {
  product_id: string
  product_name: string
  quantity: number
  current_stock: number
}

export function validateInvoice(
  type: 'IN' | 'OUT',
  items: InvoiceItem[]
): string | null {
  if (items.length === 0) return 'Додайте хоча б один товар'
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
