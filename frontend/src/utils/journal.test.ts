import { describe, it, expect } from 'vitest'
import { filterByDate, groupByInvoice } from './journal'
import type { StockMovement } from '../types'

const base: StockMovement = {
  id: '1',
  product_id: 'p1',
  type: 'IN',
  quantity: 5,
  counterparty: null,
  invoice_number: null,
  note: null,
  created_at: '2026-04-05T10:00:00Z',
}

describe('filterByDate', () => {
  it('keeps movements matching the date', () => {
    const movements = [
      { ...base, id: '1', created_at: '2026-04-05T08:00:00Z' },
      { ...base, id: '2', created_at: '2026-04-06T08:00:00Z' },
      { ...base, id: '3', created_at: '2026-04-05T15:00:00Z' },
    ]
    const result = filterByDate(movements, '2026-04-05')
    expect(result.map(m => m.id)).toEqual(['1', '3'])
  })

  it('returns empty array when no match', () => {
    const movements = [{ ...base, created_at: '2026-04-06T08:00:00Z' }]
    expect(filterByDate(movements, '2026-04-05')).toEqual([])
  })

  it('handles empty input', () => {
    expect(filterByDate([], '2026-04-05')).toEqual([])
  })
})

describe('groupByInvoice', () => {
  it('groups by invoice_number + counterparty', () => {
    const movements = [
      { ...base, id: '1', invoice_number: 'PN-001', counterparty: 'Supplier A' },
      { ...base, id: '2', invoice_number: 'PN-001', counterparty: 'Supplier A' },
      { ...base, id: '3', invoice_number: 'PN-002', counterparty: 'Supplier B' },
    ]
    const groups = groupByInvoice(movements)
    expect(groups).toHaveLength(2)
    expect(groups[0].invoice_number).toBe('PN-001')
    expect(groups[0].movements).toHaveLength(2)
    expect(groups[0].label).toBe('Supplier A — ПН №PN-001')
    expect(groups[1].invoice_number).toBe('PN-002')
    expect(groups[1].movements).toHaveLength(1)
  })

  it('separates "Імпорт з CSV" into initial stock group', () => {
    const movements = [
      { ...base, id: '1', type: 'IN' as const, note: 'Імпорт з CSV', invoice_number: null, counterparty: null },
      { ...base, id: '2', type: 'IN' as const, note: 'Імпорт з CSV', invoice_number: null, counterparty: null },
      { ...base, id: '3', type: 'IN' as const, note: null, invoice_number: null, counterparty: null },
    ]
    const groups = groupByInvoice(movements)
    expect(groups).toHaveLength(2)
    const initial = groups.find(g => g.isInitialStock)!
    expect(initial).toBeDefined()
    expect(initial.label).toBe('📦 Початковий залишок')
    expect(initial.movements).toHaveLength(2)
    const noInvoice = groups.find(g => !g.isInitialStock)!
    expect(noInvoice.label).toBe('📦 Прийом (без накладної)')
    expect(noInvoice.movements).toHaveLength(1)
  })

  it('marks initial stock group with isInitialStock=true', () => {
    const movements = [
      { ...base, id: '1', type: 'IN' as const, note: 'Імпорт з CSV', invoice_number: null, counterparty: null },
    ]
    const groups = groupByInvoice(movements)
    expect(groups[0].isInitialStock).toBe(true)
  })

  it('sets type based on movement types in group', () => {
    const movements = [
      { ...base, id: '1', type: 'OUT' as const, invoice_number: 'PN-001', counterparty: 'A' },
      { ...base, id: '2', type: 'OUT' as const, invoice_number: 'PN-001', counterparty: 'A' },
    ]
    const groups = groupByInvoice(movements)
    expect(groups[0].type).toBe('OUT')
  })

  it('separates same invoice but different counterparty', () => {
    const movements = [
      { ...base, id: '1', invoice_number: 'PN-001', counterparty: 'A' },
      { ...base, id: '2', invoice_number: 'PN-001', counterparty: 'B' },
    ]
    const groups = groupByInvoice(movements)
    expect(groups).toHaveLength(2)
  })

  it('returns empty array for empty input', () => {
    expect(groupByInvoice([])).toEqual([])
  })

  it('IN with counterparty but no invoice is not initial stock', () => {
    const movements = [
      { ...base, id: '1', type: 'IN' as const, note: 'Імпорт з CSV', invoice_number: null, counterparty: 'Someone' },
    ]
    const groups = groupByInvoice(movements)
    expect(groups[0].isInitialStock).toBe(false)
    expect(groups[0].label).toBe('Someone')
  })
})
