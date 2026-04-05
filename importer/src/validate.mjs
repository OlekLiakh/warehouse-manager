import { readFileSync } from 'node:fs'
import { parse } from 'csv-parse/sync'

/**
 * Clean and split article codes from raw CSV value.
 * NEVER removes АНАЛОГ/БУ/(НОВИЙ) suffixes — they are part of the article.
 */
export function cleanArticle(raw) {
  if (!raw || !raw.toString().trim()) return []
  return raw
    .toString()
    .split(/[,\n]/)
    .map(a => a.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

/** Known header values in column 0 that indicate a non-data row */
const HEADER_NAMES = new Set(['Наименование', 'наименование'])

/**
 * Check if a row should be skipped (headers, summary rows, empty names, etc.)
 */
export function shouldSkipRow(row) {
  const name = row[0]?.toString().trim()
  if (!name) return true
  if (name === '1014') return true
  if (/^\d+$/.test(name)) return true
  if (HEADER_NAMES.has(name)) return true
  return false
}

/**
 * Parse current_stock value from CSV cell.
 * Returns { value, error, warning } object.
 */
export function parseStock(raw, rowIndex) {
  const str = raw?.toString().trim()
  if (!str && str !== '0') {
    return { value: 0, error: null, warning: `Рядок ${rowIndex}: порожній current_stock, встановлено 0` }
  }
  const num = Number(str)
  if (isNaN(num)) {
    return { value: null, error: `Рядок ${rowIndex}: нечислове значення current_stock "${str}"`, warning: null }
  }
  if (!Number.isInteger(num)) {
    return { value: Math.round(num), error: null, warning: `Рядок ${rowIndex}: дробове значення ${str}, округлено до ${Math.round(num)}` }
  }
  if (num < 0) {
    return { value: num, error: null, warning: `Рядок ${rowIndex}: від'ємний залишок (${num})` }
  }
  return { value: num, error: null, warning: null }
}

/**
 * Validate a CSV file and return a report.
 * @param {string} filePath - path to the CSV file
 * @returns {{ valid: boolean, totalProducts: number, warnings: string[], errors: string[] }}
 */
export function validateCSV(filePath) {
  const content = readFileSync(filePath, 'utf-8')
  const records = parse(content, {
    relax_column_count: true,
    skip_empty_lines: false,
    bom: true,
  })

  const errors = []
  const warnings = []
  const dupeKeys = new Map()
  let productCount = 0

  // Check minimum columns
  if (records.length === 0) {
    errors.push('Файл порожній')
    return { valid: false, totalProducts: 0, warnings, errors }
  }

  for (let i = 0; i < records.length; i++) {
    const row = records[i]
    const rowNum = i + 1

    if (shouldSkipRow(row)) {
      if (row[0]?.toString().trim() === '') {
        // Don't warn about every empty row
      }
      continue
    }

    // Check minimum columns (0-6)
    if (row.length < 7) {
      errors.push(`Рядок ${rowNum}: недостатньо колонок (${row.length}, потрібно мінімум 7)`)
      continue
    }

    productCount++
    const name = row[0].toString().trim()

    // Check for empty article (warning, not error)
    const articles = cleanArticle(row[1])
    if (articles.length === 0) {
      warnings.push(`Рядок ${rowNum}: порожній артикул`)
    }

    // Check current_stock (column 6)
    const stockResult = parseStock(row[6], rowNum)
    if (stockResult.error) {
      errors.push(stockResult.error)
    }
    if (stockResult.warning) {
      warnings.push(stockResult.warning)
    }

    // Check for real duplicates (same name + same articles)
    const dupeKey = `${name}|${[...articles].sort().join(',')}`
    if (dupeKeys.has(dupeKey)) {
      warnings.push(`Рядок ${rowNum}: дублікат (name+articles) "${name}" [${articles.join(', ') || 'без артикулу'}] (перший раз: рядок ${dupeKeys.get(dupeKey)})`)
    } else {
      dupeKeys.set(dupeKey, rowNum)
    }
  }

  return {
    valid: errors.length === 0,
    totalProducts: productCount,
    warnings,
    errors,
  }
}

/**
 * CLI entry point: node src/validate.mjs path/to/file.csv
 */
function main() {
  const filePath = process.argv[2]
  if (!filePath) {
    console.error('Використання: node src/validate.mjs <шлях_до_CSV>')
    process.exit(1)
  }

  const result = validateCSV(filePath)

  if (result.valid) {
    console.log('✅ Файл валідний')
  } else {
    console.log('❌ Файл має помилки')
  }

  console.log(`📊 Кількість товарів: ${result.totalProducts}`)

  if (result.warnings.length > 0) {
    console.log(`⚠️  Попередження (${result.warnings.length}):`)
    result.warnings.forEach(w => console.log(`   - ${w}`))
  }

  if (result.errors.length > 0) {
    console.log(`❌ Помилки (${result.errors.length}):`)
    result.errors.forEach(e => console.log(`   - ${e}`))
  }

  process.exit(result.valid ? 0 : 1)
}

// Run CLI only when executed directly
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  main()
}
