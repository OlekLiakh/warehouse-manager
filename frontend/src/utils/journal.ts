export function filterByDate<T extends { created_at: string }>(movements: T[], date: string): T[] {
  return movements.filter(m => {
    const d = new Date(m.created_at)
    const y = d.getFullYear()
    const mo = String(d.getMonth() + 1).padStart(2, '0')
    const da = String(d.getDate()).padStart(2, '0')
    return `${y}-${mo}-${da}` === date
  })
}

export interface InvoiceGroup<T> {
  label: string
  invoice_number: string | null
  counterparty: string | null
  type: 'IN' | 'OUT' | 'MIXED'
  isInitialStock: boolean
  movements: T[]
}

export function groupByInvoice<T extends {
  type: string
  invoice_number: string | null
  counterparty: string | null
  note: string | null
}>(movements: T[]): InvoiceGroup<T>[] {
  const map = new Map<string, InvoiceGroup<T>>()

  for (const m of movements) {
    const isInitial = m.type === 'IN' && !m.invoice_number && !m.counterparty && m.note === 'Імпорт з CSV'
    const isInNoInvoice = m.type === 'IN' && !m.invoice_number && !m.counterparty && !isInitial

    let key: string
    let label: string
    let isInitialStock = false

    if (isInitial) {
      key = '__initial_stock__'
      label = '📦 Початковий залишок'
      isInitialStock = true
    } else if (isInNoInvoice) {
      key = '__in_no_invoice__'
      label = '📦 Прийом (без накладної)'
    } else {
      key = `${m.invoice_number ?? ''}|||${m.counterparty ?? ''}`
      const parts: string[] = []
      if (m.counterparty) parts.push(m.counterparty)
      if (m.invoice_number) parts.push(`ПН №${m.invoice_number}`)
      label = parts.length > 0 ? parts.join(' — ') : 'Без контрагента'
    }

    if (!map.has(key)) {
      map.set(key, {
        label,
        invoice_number: m.invoice_number,
        counterparty: m.counterparty,
        type: m.type as 'IN' | 'OUT',
        isInitialStock,
        movements: [],
      })
    }
    const group = map.get(key)!
    group.movements.push(m)
    if (group.type !== m.type) group.type = 'MIXED'
  }

  return Array.from(map.values())
}
