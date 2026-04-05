import { describe, it, expect } from 'vitest'
import { validateInvoice } from './invoice'
import type { InvoiceItem } from './invoice'

const item = (overrides: Partial<InvoiceItem> = {}): InvoiceItem => ({
  product_id: '1',
  product_name: 'Захист підрамника',
  quantity: 5,
  current_stock: 10,
  ...overrides,
})

describe('validateInvoice', () => {
  it('returns error when items list is empty', () => {
    expect(validateInvoice('IN', [])).toBe('Додайте хоча б один товар')
  })

  it('returns error when quantity is 0', () => {
    expect(validateInvoice('IN', [item({ quantity: 0 })])).toContain('кількість має бути більше 0')
  })

  it('returns error when quantity is negative', () => {
    expect(validateInvoice('IN', [item({ quantity: -3 })])).toContain('кількість має бути більше 0')
  })

  it('returns null for valid IN invoice', () => {
    expect(validateInvoice('IN', [item(), item({ product_id: '2', product_name: 'Фільтр' })])).toBeNull()
  })

  it('allows IN even when quantity exceeds stock', () => {
    expect(validateInvoice('IN', [item({ quantity: 100, current_stock: 5 })])).toBeNull()
  })

  it('returns error for OUT when quantity exceeds stock', () => {
    const result = validateInvoice('OUT', [item({ quantity: 15, current_stock: 10 })])
    expect(result).toContain('недостатньо товару')
    expect(result).toContain('10')
  })

  it('returns null for valid OUT invoice', () => {
    expect(validateInvoice('OUT', [item({ quantity: 5, current_stock: 10 })])).toBeNull()
  })

  it('returns null for OUT when quantity equals stock', () => {
    expect(validateInvoice('OUT', [item({ quantity: 10, current_stock: 10 })])).toBeNull()
  })

  it('returns first error when multiple items are invalid', () => {
    const items = [
      item({ product_name: 'A', quantity: 0 }),
      item({ product_name: 'B', quantity: -1 }),
    ]
    expect(validateInvoice('IN', items)).toContain('A')
  })
})
