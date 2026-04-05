import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { getMovementType, parseDate, buildColumnMap, parseMovements } from '../src/import-movements.mjs'
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// Helper: create a temp CSV file and return its path
function createTempCSV(content) {
  const dir = mkdtempSync(join(tmpdir(), 'movements-test-'))
  const filePath = join(dir, 'test.csv')
  writeFileSync(filePath, content, 'utf-8')
  return { filePath, cleanup: () => rmSync(dir, { recursive: true, force: true }) }
}

// ─── getMovementType tests ──────────────────────────────

describe('getMovementType', () => {
  it('Выдача Днепр → OUT/Дніпро', () => {
    const r = getMovementType('Выдача Днепр')
    assert.deepEqual(r, { type: 'OUT', counterparty: 'Дніпро' })
  })

  it('Видача Дніпро → OUT/Дніпро', () => {
    const r = getMovementType('Видача Дніпро')
    assert.deepEqual(r, { type: 'OUT', counterparty: 'Дніпро' })
  })

  it('Дніпро → OUT/Дніпро', () => {
    const r = getMovementType('Дніпро')
    assert.deepEqual(r, { type: 'OUT', counterparty: 'Дніпро' })
  })

  it('Днепр → OUT/Дніпро', () => {
    const r = getMovementType('Днепр')
    assert.deepEqual(r, { type: 'OUT', counterparty: 'Дніпро' })
  })

  it('1/300$ → OUT/Клієнт', () => {
    const r = getMovementType('1/300$')
    assert.deepEqual(r, { type: 'OUT', counterparty: 'Клієнт' })
  })

  it('2/150$ → OUT/Клієнт', () => {
    const r = getMovementType('2/150$')
    assert.deepEqual(r, { type: 'OUT', counterparty: 'Клієнт' })
  })

  it('1/2 → OUT/Клієнт', () => {
    const r = getMovementType('1/2')
    assert.deepEqual(r, { type: 'OUT', counterparty: 'Клієнт' })
  })

  it('К-123 → OUT/Нова Пошта', () => {
    const r = getMovementType('К-123')
    assert.deepEqual(r, { type: 'OUT', counterparty: 'Нова Пошта' })
  })

  it('А-45 → OUT/Нова Пошта', () => {
    const r = getMovementType('А-45')
    assert.deepEqual(r, { type: 'OUT', counterparty: 'Нова Пошта' })
  })

  it('І-7 → OUT/Нова Пошта', () => {
    const r = getMovementType('І-7')
    assert.deepEqual(r, { type: 'OUT', counterparty: 'Нова Пошта' })
  })

  it('И-99 → OUT/Нова Пошта', () => {
    const r = getMovementType('И-99')
    assert.deepEqual(r, { type: 'OUT', counterparty: 'Нова Пошта' })
  })

  it('pure number 12345 → OUT/Нова Пошта', () => {
    const r = getMovementType('12345')
    assert.deepEqual(r, { type: 'OUT', counterparty: 'Нова Пошта' })
  })

  it('Приход → IN/null', () => {
    const r = getMovementType('Приход')
    assert.deepEqual(r, { type: 'IN', counterparty: null })
  })

  it('Прихід → IN/null', () => {
    const r = getMovementType('Прихід')
    assert.deepEqual(r, { type: 'IN', counterparty: null })
  })

  // Skip cases
  it('Перемещение → null (skip)', () => {
    assert.equal(getMovementType('Перемещение'), null)
  })

  it('Переміщення → null (skip)', () => {
    assert.equal(getMovementType('Переміщення'), null)
  })

  it('Итого → null (skip)', () => {
    assert.equal(getMovementType('Итого'), null)
  })

  it('Неделя → null (skip)', () => {
    assert.equal(getMovementType('Неделя'), null)
  })

  it('Тиждень → null (skip)', () => {
    assert.equal(getMovementType('Тиждень'), null)
  })

  it('date 30/03/2026 → null (skip)', () => {
    assert.equal(getMovementType('30/03/2026'), null)
  })

  it('Общий → null (skip)', () => {
    assert.equal(getMovementType('Общий приход'), null)
  })

  it('ПН№ → null (skip)', () => {
    assert.equal(getMovementType('ПН№'), null)
  })

  it('empty string → null', () => {
    assert.equal(getMovementType(''), null)
  })
})

// ─── parseDate tests ──────────────────────────────

describe('parseDate', () => {
  it('30/03/26р. → 2026-03-30', () => {
    assert.equal(parseDate('30/03/26р.'), '2026-03-30')
  })

  it('31/03/26 → 2026-03-31', () => {
    assert.equal(parseDate('31/03/26'), '2026-03-31')
  })

  it('01/04/2026 → 2026-04-01', () => {
    assert.equal(parseDate('01/04/2026'), '2026-04-01')
  })

  it('null → null', () => {
    assert.equal(parseDate(null), null)
  })

  it('empty string → null', () => {
    assert.equal(parseDate(''), null)
  })

  it('invalid string → null', () => {
    assert.equal(parseDate('hello'), null)
  })
})

// ─── buildColumnMap tests ──────────────────────────────

describe('buildColumnMap', () => {
  it('builds correct column map from header rows', () => {
    // Simulate 3 header rows with columns 0-9
    // Columns 0-6 are product data, 7+ are movements
    const row0 = ['', '', '', '', '', '', '', '', '', '']       // row 1 (unused for cols 7+)
    const row1 = ['', '', '', '', '', '', '', '30/03/26р.', '', '']  // dates
    const row2 = ['', '', '', '', '', '', '', 'Приход', 'Выдача Днепр', 'К-5'] // headers

    const records = [row0, row1, row2]
    const colMap = buildColumnMap(records)

    assert.equal(colMap.size, 3)

    const col7 = colMap.get(7)
    assert.equal(col7.date, '2026-03-30')
    assert.equal(col7.type, 'IN')
    assert.equal(col7.counterparty, null)

    const col8 = colMap.get(8)
    assert.equal(col8.type, 'OUT')
    assert.equal(col8.counterparty, 'Дніпро')

    const col9 = colMap.get(9)
    assert.equal(col9.type, 'OUT')
    assert.equal(col9.counterparty, 'Нова Пошта')
  })

  it('skips columns with no movement type', () => {
    const row0 = ['', '', '', '', '', '', '', '', '']
    const row1 = ['', '', '', '', '', '', '', '30/03/26р.', '']
    const row2 = ['', '', '', '', '', '', '', 'Перемещение', 'Итого']

    const records = [row0, row1, row2]
    const colMap = buildColumnMap(records)

    assert.equal(colMap.size, 0)
  })

  it('date carries forward to subsequent columns', () => {
    const row0 = ['', '', '', '', '', '', '', '', '', '', '']
    const row1 = ['', '', '', '', '', '', '', '30/03/26', '', '', '31/03/26']
    const row2 = ['', '', '', '', '', '', '', 'Приход', '12345', 'К-1', 'Приход']

    const records = [row0, row1, row2]
    const colMap = buildColumnMap(records)

    // col 7, 8, 9 should have date 2026-03-30
    assert.equal(colMap.get(7).date, '2026-03-30')
    assert.equal(colMap.get(8).date, '2026-03-30')
    assert.equal(colMap.get(9).date, '2026-03-30')
    // col 10 should have date 2026-03-31
    assert.equal(colMap.get(10).date, '2026-03-31')
  })
})

// ─── parseMovements integration tests ──────────────────

describe('parseMovements', () => {
  it('value 0 is skipped', () => {
    // Build a CSV with 3 header rows + 1 data row
    const rows = [
      // row 0: ignored
      ',,,,,,,',
      // row 1: dates
      ',,,,,,,30/03/26р.',
      // row 2: headers
      ',,,,,,,Приход',
      // row 3: data — value is 0
      'Товар 1,ART-1,A-1,5,5,5,3,0',
    ]
    const { filePath, cleanup } = createTempCSV(rows.join('\n'))
    try {
      const movements = parseMovements(filePath)
      assert.equal(movements.length, 0)
    } finally {
      cleanup()
    }
  })

  it('value > 0 creates a movement', () => {
    const rows = [
      ',,,,,,,',
      ',,,,,,,30/03/26р.',
      ',,,,,,,Приход',
      'Товар 1,ART-1,A-1,5,5,5,3,5',
    ]
    const { filePath, cleanup } = createTempCSV(rows.join('\n'))
    try {
      const movements = parseMovements(filePath)
      assert.equal(movements.length, 1)
      assert.equal(movements[0].product_name, 'Товар 1')
      assert.equal(movements[0].type, 'IN')
      assert.equal(movements[0].quantity, 5)
      assert.equal(movements[0].date, '2026-03-30')
      assert.equal(movements[0].counterparty, null)
    } finally {
      cleanup()
    }
  })

  it('negative value uses absolute value', () => {
    const rows = [
      ',,,,,,,',
      ',,,,,,,30/03/26р.',
      ',,,,,,,Приход',
      'Товар 1,ART-1,A-1,5,5,5,3,-3',
    ]
    const { filePath, cleanup } = createTempCSV(rows.join('\n'))
    try {
      const movements = parseMovements(filePath)
      assert.equal(movements.length, 1)
      assert.equal(movements[0].quantity, 3)
    } finally {
      cleanup()
    }
  })

  it('multiple columns create multiple movements', () => {
    const rows = [
      ',,,,,,,,',
      ',,,,,,,30/03/26р.,,',
      ',,,,,,,Приход,Выдача Днепр',
      'Товар 1,ART-1,A-1,5,5,5,3,2,1',
    ]
    const { filePath, cleanup } = createTempCSV(rows.join('\n'))
    try {
      const movements = parseMovements(filePath)
      assert.equal(movements.length, 2)

      const inMov = movements.find(m => m.type === 'IN')
      assert.equal(inMov.quantity, 2)

      const outMov = movements.find(m => m.type === 'OUT')
      assert.equal(outMov.quantity, 1)
      assert.equal(outMov.counterparty, 'Дніпро')
    } finally {
      cleanup()
    }
  })

  it('skips header rows and empty name rows', () => {
    const rows = [
      ',,,,,,,,',
      ',,,,,,,30/03/26р.',
      ',,,,,,,Приход',
      'Наименование,КОД,ПОЛКА,,,,КОЛ-ВО,5',
      ',,,,,,,,',
      'Товар 1,ART-1,A-1,5,5,5,3,7',
    ]
    const { filePath, cleanup } = createTempCSV(rows.join('\n'))
    try {
      const movements = parseMovements(filePath)
      assert.equal(movements.length, 1)
      assert.equal(movements[0].product_name, 'Товар 1')
    } finally {
      cleanup()
    }
  })

  it('non-numeric cell values are skipped', () => {
    const rows = [
      ',,,,,,,',
      ',,,,,,,30/03/26р.',
      ',,,,,,,Приход',
      'Товар 1,ART-1,A-1,5,5,5,3,abc',
    ]
    const { filePath, cleanup } = createTempCSV(rows.join('\n'))
    try {
      const movements = parseMovements(filePath)
      assert.equal(movements.length, 0)
    } finally {
      cleanup()
    }
  })
})
