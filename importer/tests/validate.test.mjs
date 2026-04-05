import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { cleanArticle, shouldSkipRow, parseStock, validateCSV } from '../src/validate.mjs'
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// Helper: create a temp CSV file and return its path
function createTempCSV(content) {
  const dir = mkdtempSync(join(tmpdir(), 'importer-test-'))
  const filePath = join(dir, 'test.csv')
  writeFileSync(filePath, content, 'utf-8')
  return { filePath, cleanup: () => rmSync(dir, { recursive: true, force: true }) }
}

// ─── cleanArticle tests ──────────────────────────────

describe('cleanArticle', () => {
  it('1. Валідний артикул парситься коректно', () => {
    const result = cleanArticle('1585229-00-D')
    assert.deepEqual(result, ['1585229-00-D'])
  })

  it('2. Артикул з АНАЛОГ зберігається як є', () => {
    const result = cleanArticle('1585229-00-D АНАЛОГ')
    assert.deepEqual(result, ['1585229-00-D АНАЛОГ'])
  })

  it('3. Артикул з БУ зберігається як є', () => {
    const result = cleanArticle('1585229-00-D БУ')
    assert.deepEqual(result, ['1585229-00-D БУ'])
  })

  it('4. Два артикули через кому → масив з двох елементів', () => {
    const result = cleanArticle('1873282-00,1820734-00')
    assert.deepEqual(result, ['1873282-00', '1820734-00'])
  })

  it('5. Переноси рядка в артикулі → масив з двох елементів', () => {
    const result = cleanArticle('1873282-00\n1820734-00')
    assert.deepEqual(result, ['1873282-00', '1820734-00'])
  })

  it('порожній рядок → порожній масив', () => {
    assert.deepEqual(cleanArticle(''), [])
    assert.deepEqual(cleanArticle(null), [])
    assert.deepEqual(cleanArticle(undefined), [])
  })

  it('зайві пробіли очищуються', () => {
    const result = cleanArticle('  1585229-00-D   АНАЛОГ  ')
    assert.deepEqual(result, ['1585229-00-D АНАЛОГ'])
  })
})

// ─── shouldSkipRow tests ──────────────────────────────

describe('shouldSkipRow', () => {
  it('6. Порожня назва → рядок пропускається', () => {
    assert.equal(shouldSkipRow(['', 'code', 'shelf', '', '', '', '5']), true)
  })

  it('7. Рядок "1014" → пропускається', () => {
    assert.equal(shouldSkipRow(['1014', '', '', '', '', '', '']), true)
  })

  it('чисто числовий рядок пропускається', () => {
    assert.equal(shouldSkipRow(['999', '', '', '', '', '', '']), true)
  })

  it('товар з назвою НЕ пропускається', () => {
    assert.equal(shouldSkipRow(['Ключ-Карта Tesla Model 3', '1133370-00-A', 'A-1', '5', '5', '5', '3']), false)
  })

  it('рядок-заголовок "Наименование" → пропускається', () => {
    assert.equal(shouldSkipRow(['Наименование', 'КОД', 'ПОЛКА', '', 'КОЛ-ВО по программе', 'КОЛ-ВО на начало недели', 'КОЛ-ВО факт']), true)
  })
})

// ─── parseStock tests ──────────────────────────────

describe('parseStock', () => {
  it('8. Нульовий залишок → товар імпортується (stock=0)', () => {
    const result = parseStock('0', 1)
    assert.equal(result.value, 0)
    assert.equal(result.error, null)
  })

  it('9. Від\'ємний залишок → попередження, але імпортується', () => {
    const result = parseStock('-1', 5)
    assert.equal(result.value, -1)
    assert.equal(result.error, null)
    assert.ok(result.warning)
    assert.ok(result.warning.includes("від'ємний"))
  })

  it('10. Нечислове значення в current_stock → помилка', () => {
    const result = parseStock('abc', 3)
    assert.equal(result.value, null)
    assert.ok(result.error)
    assert.ok(result.error.includes('нечислове'))
  })

  it('нормальне число парситься', () => {
    const result = parseStock('42', 1)
    assert.equal(result.value, 42)
    assert.equal(result.error, null)
    assert.equal(result.warning, null)
  })
})

// ─── validateCSV integration tests ──────────────────

describe('validateCSV', () => {
  it('валідний CSV — немає помилок', () => {
    const csv = [
      'Ключ-Карта Tesla Model 3,1133370-00-A,A-1,5,5,5,3',
      'Камера Антихром MS,1642392-70-A,Б-2,10,10,10,8',
    ].join('\n')
    const { filePath, cleanup } = createTempCSV(csv)
    try {
      const result = validateCSV(filePath)
      assert.equal(result.valid, true)
      assert.equal(result.totalProducts, 2)
      assert.equal(result.errors.length, 0)
    } finally {
      cleanup()
    }
  })

  it('нечислове значення stock → помилка', () => {
    const csv = 'Товар 1,ART-1,A-1,5,5,5,abc\n'
    const { filePath, cleanup } = createTempCSV(csv)
    try {
      const result = validateCSV(filePath)
      assert.equal(result.valid, false)
      assert.ok(result.errors.length > 0)
    } finally {
      cleanup()
    }
  })

  it('дублікати назв → попередження', () => {
    const csv = [
      'Товар 1,ART-1,A-1,5,5,5,3',
      'Товар 1,ART-2,A-2,5,5,5,5',
    ].join('\n')
    const { filePath, cleanup } = createTempCSV(csv)
    try {
      const result = validateCSV(filePath)
      assert.equal(result.valid, true)
      assert.ok(result.warnings.some(w => w.includes('дублікат')))
    } finally {
      cleanup()
    }
  })

  it('порожня назва пропускається тихо', () => {
    const csv = [
      ',ART-1,A-1,5,5,5,3',
      'Товар 2,ART-2,A-2,5,5,5,5',
    ].join('\n')
    const { filePath, cleanup } = createTempCSV(csv)
    try {
      const result = validateCSV(filePath)
      assert.equal(result.valid, true)
      assert.equal(result.totalProducts, 1)
    } finally {
      cleanup()
    }
  })

  it('числові рядки (підсумки) пропускаються', () => {
    const csv = [
      'Товар 1,ART-1,A-1,5,5,5,3',
      '1014,,,,,,',
      '999,,,,,,',
    ].join('\n')
    const { filePath, cleanup } = createTempCSV(csv)
    try {
      const result = validateCSV(filePath)
      assert.equal(result.valid, true)
      assert.equal(result.totalProducts, 1)
    } finally {
      cleanup()
    }
  })
})
