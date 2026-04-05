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
  invoice_number: string | null
  counterparty: string | null
  movements: T[]
}

export function groupByInvoice<T extends { invoice_number: string | null; counterparty: string | null }>(
  movements: T[]
): InvoiceGroup<T>[] {
  const map = new Map<string, InvoiceGroup<T>>()
  for (const m of movements) {
    const key = `${m.invoice_number ?? ''}|||${m.counterparty ?? ''}`
    if (!map.has(key)) {
      map.set(key, { invoice_number: m.invoice_number, counterparty: m.counterparty, movements: [] })
    }
    map.get(key)!.movements.push(m)
  }
  return Array.from(map.values())
}
