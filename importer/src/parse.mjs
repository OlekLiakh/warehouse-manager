import { readFileSync } from 'node:fs'
import { parse } from 'csv-parse/sync'
import { cleanArticle, shouldSkipRow, parseStock } from './validate.mjs'

/**
 * Parse a CSV file and return an array of product objects.
 * Does NOT write to the database — returns data only.
 *
 * @param {string} filePath - path to the CSV file
 * @returns {Array<{ name: string, articles: string[], shelf_location: string|null, boss_quantity: number|null, current_stock: number, is_active: boolean }>}
 */
export function parseCSV(filePath) {
  const content = readFileSync(filePath, 'utf-8')
  return parseCSVContent(content)
}

/**
 * Parse CSV content string and return an array of product objects.
 * Useful for testing without file I/O.
 *
 * @param {string} content - CSV content as string
 * @returns {Array<{ name: string, articles: string[], shelf_location: string|null, boss_quantity: number|null, current_stock: number, is_active: boolean }>}
 */
export function parseCSVContent(content) {
  const records = parse(content, {
    relax_column_count: true,
    skip_empty_lines: false,
    bom: true,
  })

  const products = []

  for (let i = 0; i < records.length; i++) {
    const row = records[i]

    if (shouldSkipRow(row)) continue
    if (row.length < 7) continue

    const name = row[0].toString().trim()
    const articles = cleanArticle(row[1])
    const shelfRaw = row[2]?.toString().trim() || null
    const bossRaw = row[3]?.toString().trim()
    const stockResult = parseStock(row[6], i + 1)

    // Skip rows with non-numeric stock (errors)
    if (stockResult.value === null) continue

    const bossQuantity = bossRaw ? Number(bossRaw) : null
    const bossValue = (bossQuantity !== null && !isNaN(bossQuantity)) ? bossQuantity : null

    products.push({
      name,
      articles,
      shelf_location: shelfRaw,
      boss_quantity: bossValue,
      current_stock: stockResult.value,
      is_active: true,
    })
  }

  return products
}

/**
 * CLI entry point: node src/parse.mjs path/to/file.csv
 */
function main() {
  const filePath = process.argv[2]
  if (!filePath) {
    console.error('Використання: node src/parse.mjs <шлях_до_CSV>')
    process.exit(1)
  }

  const products = parseCSV(filePath)
  console.log(`📊 Розпарсено товарів: ${products.length}`)
  console.log('\nПерші 5 товарів:')
  products.slice(0, 5).forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.name}`)
    console.log(`     Артикули: ${p.articles.length > 0 ? p.articles.join(', ') : '(немає)'}`)
    console.log(`     Полка: ${p.shelf_location || '(немає)'}`)
    console.log(`     BOSS: ${p.boss_quantity ?? '(немає)'}`)
    console.log(`     Залишок: ${p.current_stock}`)
  })
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  main()
}
