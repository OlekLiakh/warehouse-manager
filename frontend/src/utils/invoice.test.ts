import { describe, it, expect } from 'vitest'
import { validateInvoice, getInvoiceLabel, canCancelInvoice } from './invoice'
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
    const result = validateInvoice('OUT', [item({ quantity: 15, current_stock: 10 })], 'DNIPRO')
    expect(result).toContain('недостатньо товару')
    expect(result).toContain('10')
  })

  it('returns null for valid OUT invoice', () => {
    expect(validateInvoice('OUT', [item({ quantity: 5, current_stock: 10 })], 'DNIPRO')).toBeNull()
  })

  it('returns null for OUT when quantity equals stock', () => {
    expect(validateInvoice('OUT', [item({ quantity: 10, current_stock: 10 })], 'PICKUP')).toBeNull()
  })

  it('returns first error when multiple items are invalid', () => {
    const items = [
      item({ product_name: 'A', quantity: 0 }),
      item({ product_name: 'B', quantity: -1 }),
    ]
    expect(validateInvoice('IN', items)).toContain('A')
  })

  it('returns error for OUT without subtype', () => {
    expect(validateInvoice('OUT', [item()], null)).toBe('Оберіть тип видачі')
  })

  it('returns error for OUT without subtype (undefined)', () => {
    expect(validateInvoice('OUT', [item()])).toBe('Оберіть тип видачі')
  })

  it('does not require subtype for IN', () => {
    expect(validateInvoice('IN', [item()], null)).toBeNull()
  })
})

describe('getInvoiceLabel', () => {
  it('returns label for IN invoice', () => {
    expect(getInvoiceLabel({ type: 'IN', subtype: null, counterparty: null, invoice_number: null }))
      .toBe('📦 Прихід')
  })

  it('returns label for IN with counterparty and invoice number', () => {
    expect(getInvoiceLabel({ type: 'IN', subtype: null, counterparty: 'Постачальник А', invoice_number: 'PN-001' }))
      .toBe('📦 Прихід — Постачальник А — ПН №PN-001')
  })

  it('returns label for OUT DNIPRO', () => {
    expect(getInvoiceLabel({ type: 'OUT', subtype: 'DNIPRO', counterparty: null, invoice_number: null }))
      .toBe('🚚 Дніпро')
  })

  it('returns label for OUT PICKUP with counterparty', () => {
    expect(getInvoiceLabel({ type: 'OUT', subtype: 'PICKUP', counterparty: 'Клієнт Б', invoice_number: null }))
      .toBe('🧍 Самовивіз — Клієнт Б')
  })

  it('returns label for OUT NOVA_POSHTA with all fields', () => {
    expect(getInvoiceLabel({ type: 'OUT', subtype: 'NOVA_POSHTA', counterparty: 'Іванов', invoice_number: '123' }))
      .toBe('📮 Нова Пошта — Іванов — ПН №123')
  })

  it('returns generic label for OUT without subtype', () => {
    expect(getInvoiceLabel({ type: 'OUT', subtype: null, counterparty: null, invoice_number: null }))
      .toBe('📤 Видача')
  })
})

describe('canCancelInvoice', () => {
  it('returns true if invoice was created today', () => {
    expect(canCancelInvoice({ created_at: new Date().toISOString() })).toBe(true)
  })

  it('returns false if invoice was created yesterday', () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    expect(canCancelInvoice({ created_at: yesterday.toISOString() })).toBe(false)
  })

  it('returns false if invoice was created a week ago', () => {
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    expect(canCancelInvoice({ created_at: weekAgo.toISOString() })).toBe(false)
  })
})
