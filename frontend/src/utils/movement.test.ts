import { describe, it, expect } from 'vitest'
import { canUndo, quantityDisplay, typeColor, typeLabel, validateMovement } from './movement'
import type { StockMovement } from '../types'

const base: StockMovement = {
  id: '1',
  product_id: 'p1',
  type: 'IN',
  quantity: 5,
  counterparty: null,
  invoice_number: null,
  invoice_id: null,
  order_id: null,
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

describe('validateMovement', () => {
  it('returns null when everything is OK', () => {
    expect(validateMovement('IN', 5, 10)).toBeNull()
    expect(validateMovement('OUT', 5, 10)).toBeNull()
    expect(validateMovement('ADJUST', 3, 10)).toBeNull()
  })

  it('OUT > stock returns error', () => {
    expect(validateMovement('OUT', 15, 10)).toContain('Недостатньо')
  })

  it('OUT === stock is OK (can give away all)', () => {
    expect(validateMovement('OUT', 10, 10)).toBeNull()
  })

  it('quantity = 0 returns error', () => {
    expect(validateMovement('IN', 0, 10)).not.toBeNull()
  })

  it('negative quantity returns error', () => {
    expect(validateMovement('IN', -1, 10)).not.toBeNull()
  })

  it('ADJUST negative returns error', () => {
    expect(validateMovement('ADJUST', -1, 10)).not.toBeNull()
  })

  it('ADJUST = 0 is OK (can zero out stock)', () => {
    expect(validateMovement('ADJUST', 0, 10)).toBeNull()
  })

  it('IN is not limited by current stock', () => {
    expect(validateMovement('IN', 9999, 0)).toBeNull()
  })
})

describe('canUndo', () => {
  it('today IN → true', () => {
    expect(canUndo({ ...base, type: 'IN', created_at: new Date().toISOString() })).toBe(true)
  })

  it('today OUT → true', () => {
    expect(canUndo({ ...base, type: 'OUT', created_at: new Date().toISOString() })).toBe(true)
  })

  it('yesterday → false', () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    expect(canUndo({ ...base, type: 'IN', created_at: yesterday.toISOString() })).toBe(false)
  })

  it('ADJUST → false', () => {
    expect(canUndo({ ...base, type: 'ADJUST', created_at: new Date().toISOString() })).toBe(false)
  })

  it('today MOVE → true', () => {
    expect(canUndo({ ...base, type: 'MOVE', created_at: new Date().toISOString() })).toBe(true)
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
