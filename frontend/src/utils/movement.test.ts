import { describe, it, expect } from 'vitest'
import { quantityDisplay, typeColor, typeLabel } from './movement'
import type { StockMovement } from '../types'

const base: StockMovement = {
  id: '1',
  product_id: 'p1',
  type: 'IN',
  quantity: 5,
  counterparty: null,
  invoice_number: null,
  note: null,
  created_at: '2026-01-01T00:00:00Z',
}

describe('quantityDisplay', () => {
  it('IN shows +N', () => {
    expect(quantityDisplay({ ...base, type: 'IN', quantity: 10 })).toBe('+10')
  })

  it('OUT shows −N (minus sign)', () => {
    expect(quantityDisplay({ ...base, type: 'OUT', quantity: 3 })).toBe('−3')
  })

  it('ADJUST shows =N', () => {
    expect(quantityDisplay({ ...base, type: 'ADJUST', quantity: 7 })).toBe('=7')
  })

  it('MOVE shows +N', () => {
    expect(quantityDisplay({ ...base, type: 'MOVE', quantity: 2 })).toBe('+2')
  })
})

describe('typeColor', () => {
  it('IN is green', () => {
    expect(typeColor('IN')).toBe('#2d7a2d')
  })

  it('OUT is red', () => {
    expect(typeColor('OUT')).toBe('#c0392b')
  })

  it('ADJUST is grey', () => {
    expect(typeColor('ADJUST')).toBe('#7f8c8d')
  })

  it('MOVE is dark grey', () => {
    expect(typeColor('MOVE')).toBe('#555')
  })
})

describe('typeLabel', () => {
  it('IN → 📦 Прийом', () => {
    expect(typeLabel('IN')).toBe('📦 Прийом')
  })

  it('OUT → 📤 Видача', () => {
    expect(typeLabel('OUT')).toBe('📤 Видача')
  })

  it('ADJUST → ✏️ Уточнення', () => {
    expect(typeLabel('ADJUST')).toBe('✏️ Уточнення')
  })

  it('MOVE → 🔄 Переміщення', () => {
    expect(typeLabel('MOVE')).toBe('🔄 Переміщення')
  })
})
