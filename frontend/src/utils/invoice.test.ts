import { describe, it, expect } from 'vitest'
import { validateInvoice, getInvoiceLabel, getSubtypeLabel, canCancelInvoice } from './invoice'
import type { InvoiceItem, OrderDraft } from './invoice'

const item = (overrides: Partial<InvoiceItem> = {}): InvoiceItem => ({
  product_id: '1',
  product_name: 'Захист підрамника',
  quantity: 5,
  current_stock: 10,
  ...overrides,
})

const order = (overrides: Partial<OrderDraft> = {}): OrderDraft => ({
  delivery_details: '',
  note: '',
  items: [item()],
  ...overrides,
})

describe('validateInvoice', () => {
  // IN validation
  it('IN: returns error when items list is empty', () => {
    expect(validateInvoice('IN', [])).toBe('Додайте хоча б один товар')
  })

  it('IN: returns error when quantity is 0', () => {
    expect(validateInvoice('IN', [item({ quantity: 0 })])).toContain('кількість має бути більше 0')
  })

  it('IN: returns error when quantity is negative', () => {
    expect(validateInvoice('IN', [item({ quantity: -3 })])).toContain('кількість має бути більше 0')
  })

  it('IN: returns null for valid invoice', () => {
    expect(validateInvoice('IN', [item(), item({ product_id: '2', product_name: 'Фільтр' })])).toBeNull()
  })

  it('IN: allows quantity exceeding stock', () => {
    expect(validateInvoice('IN', [item({ quantity: 100, current_stock: 5 })])).toBeNull()
  })

  it('IN: does not require subtype', () => {
    expect(validateInvoice('IN', [item()], null)).toBeNull()
  })

  // OUT validation
  it('OUT: returns error without subtype', () => {
    expect(validateInvoice('OUT', [], null, [order()])).toBe('Оберіть тип видачі')
  })

  it('OUT: returns error without subtype (undefined)', () => {
    expect(validateInvoice('OUT', [], undefined, [order()])).toBe('Оберіть тип видачі')
  })

  it('OUT: returns error without orders', () => {
    expect(validateInvoice('OUT', [], 'DNIPRO', [])).toBe('Додайте хоча б одне замовлення')
  })

  it('OUT: returns error without orders (undefined)', () => {
    expect(validateInvoice('OUT', [], 'DNIPRO', undefined)).toBe('Додайте хоча б одне замовлення')
  })

  it('OUT: returns error when order has no items', () => {
    expect(validateInvoice('OUT', [], 'DNIPRO', [order({ items: [] })])).toContain('додайте хоча б один товар')
  })

  it('OUT: returns error when order item quantity is 0', () => {
    const result = validateInvoice('OUT', [], 'DNIPRO', [order({ items: [item({ quantity: 0 })] })])
    expect(result).toContain('кількість має бути більше 0')
  })

  it('OUT: returns error when quantity exceeds stock', () => {
    const result = validateInvoice('OUT', [], 'PICKUP', [order({ items: [item({ quantity: 15, current_stock: 10 })] })])
    expect(result).toContain('недостатньо товару')
    expect(result).toContain('10')
  })

  it('OUT: returns null for valid invoice with orders', () => {
    expect(validateInvoice('OUT', [], 'NOVA_POSHTA', [order(), order()])).toBeNull()
  })
})

describe('getSubtypeLabel', () => {
  it('returns label for DNIPRO', () => {
    expect(getSubtypeLabel('DNIPRO')).toBe('🚚 Дніпро')
  })

  it('returns label for PICKUP', () => {
    expect(getSubtypeLabel('PICKUP')).toBe('🧍 Самовивіз')
  })

  it('returns label for NOVA_POSHTA', () => {
    expect(getSubtypeLabel('NOVA_POSHTA')).toBe('📮 Нова Пошта')
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
