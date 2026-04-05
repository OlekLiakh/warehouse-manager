import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { parse } from 'csv-parse/sync'
import { shouldSkipRow, cleanArticle } from './validate.mjs'
import { makeProductKey } from './import.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '..', '.env.local') })

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_KEY
const BATCH_SIZE = 100

function getSupabase() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('SUPABASE_URL та SUPABASE_KEY мають бути встановлені в .env.local')
  }
  return createClient(SUPABASE_URL, SUPABASE_KEY)
}

/**
 * Classify a column header into a movement type.
 * Returns null for columns to skip.
 */
export function getMovementType(header) {
  const h = header.toLowerCase().trim()
  if (!h) return null

  // Skip: summaries, transfers, dates, week totals
  if (h.includes('перемещение') || h.includes('переміщення')) return null
  if (h.includes('итого')) return null
  if (h.includes('неделя') || h.includes('тиждень')) return null
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(h)) return null // date summary like 30/03/2026
  if (h.includes('общий')) return null
  if (h.includes('пн№') || h.includes('пн #')) return null

  // Дніпро
  if (h.includes('выдача днепр') || h.includes('видача дніпр') || h === 'дніпро' || h === 'днепр')
    return { type: 'OUT', counterparty: 'Дніпро' }

  // Клієнт — contains $ or N/$
  if (/\d+\s*\/.*\$|\$/.test(header) || /\d+\s*\/\s*\d/.test(header.trim()))
    return { type: 'OUT', counterparty: 'Клієнт' }

  // Нова Пошта — К-N, А-N, І-N, И-N patterns
  if (/^[кКаАіІиИ]-\d+/i.test(header.trim()))
    return { type: 'OUT', counterparty: 'Нова Пошта' }

  // Нова Пошта — pure number
  if (/^\d+$/.test(h))
    return { type: 'OUT', counterparty: 'Нова Пошта' }

  // Прийом — only individual, NOT общий/итого/пн
  if (h.includes('приход') || h.includes('прихід'))
    return { type: 'IN', counterparty: null }

  return null
}

/**
 * Parse a date string from row 2 into ISO format YYYY-MM-DD.
 * Handles: "30/03/26р.", "31/03/26", "01/04/26"
 */
export function parseDate(raw) {
  if (!raw) return null
  const cleaned = raw.replace(/р\.?$/, '').trim()
  const m = cleaned.match(/^(\d{2})\/(\d{2})\/(\d{2,4})$/)
  if (!m) return null
  const day = m[1]
  const month = m[2]
  let year = m[3]
  if (year.length === 2) year = '20' + year
  return `${year}-${month}-${day}`
}

/**
 * Build a column map from CSV header rows.
 * Returns Map<colIndex, { date, type, counterparty }>
 */
export function buildColumnMap(records) {
  const colMap = new Map()
  let currentDate = null

  for (let col = 7; col < records[0].length; col++) {
    // Row 2 (index 1) has dates
    const dateRaw = records[1]?.[col]?.trim()
    if (dateRaw) {
      const parsed = parseDate(dateRaw)
      if (parsed) currentDate = parsed
    }

    if (!currentDate) continue

    // Row 3 (index 2) has the primary header
    const header = records[2]?.[col]?.toString().trim() || ''
    if (!header) continue

    const movType = getMovementType(header)
    if (!movType) continue

    colMap.set(col, {
      date: currentDate,
      type: movType.type,
      counterparty: movType.counterparty,
      header,
    })
  }

  return colMap
}

/**
 * Fetch all products from DB, return Map<key, id>.
 */
async function fetchProductIndex(supabase) {
  const index = new Map()
  let offset = 0
  const PAGE = 1000
  while (true) {
    const { data, error } = await supabase
      .from('products')
      .select('id, name, articles')
      .range(offset, offset + PAGE - 1)
    if (error) throw new Error(`Помилка читання products: ${error.message}`)
    for (const row of data) {
      index.set(makeProductKey(row.name, row.articles), row.id)
    }
    if (data.length < PAGE) break
    offset += PAGE
  }
  return index
}

/**
 * Parse movements from a CSV file.
 * Returns array of { product_name, product_key, type, quantity, counterparty, date, note }.
 */
export function parseMovements(filePath) {
  const content = readFileSync(filePath, 'utf-8')
  const records = parse(content, {
    relax_column_count: true,
    skip_empty_lines: false,
    bom: true,
  })

  const colMap = buildColumnMap(records)
  const fileName = filePath.replace(/.*[/\\]/, '')
  const movements = []

  for (let i = 0; i < records.length; i++) {
    const row = records[i]
    if (shouldSkipRow(row)) continue
    if (row.length < 7) continue

    const name = row[0].toString().trim()
    const articles = cleanArticle(row[1])
    const productKey = makeProductKey(name, articles)

    for (const [col, meta] of colMap) {
      const raw = row[col]?.toString().trim()
      if (!raw) continue
      const val = Number(raw)
      if (isNaN(val) || val === 0) continue

      movements.push({
        product_name: name,
        product_key: productKey,
        type: meta.type,
        quantity: Math.abs(val),
        counterparty: meta.counterparty,
        date: meta.date,
        note: `Імпорт з CSV: ${fileName}`,
      })
    }
  }

  return movements
}

/**
 * Import stock movements from a CSV file into Supabase.
 */
export async function importMovements(filePath, { dryRun = false } = {}) {
  const t0 = Date.now()

  console.log('📋 Парсинг рухів...')
  const movements = parseMovements(filePath)
  console.log(`📊 Знайдено рухів: ${movements.length}`)

  // Stats
  const stats = { IN: 0, OUT: 0, byCounterparty: {} }
  for (const m of movements) {
    stats[m.type]++
    const cp = m.counterparty || '(прихід)'
    stats.byCounterparty[cp] = (stats.byCounterparty[cp] || 0) + 1
  }

  console.log(`   IN (прихід): ${stats.IN}`)
  console.log(`   OUT (видача): ${stats.OUT}`)
  console.log('   По counterparty:')
  for (const [cp, count] of Object.entries(stats.byCounterparty)) {
    console.log(`     ${cp}: ${count}`)
  }

  if (dryRun) {
    console.log('\n🏃 DRY RUN — нічого не записуємо в БД')
    console.log('\nПерші 10 рухів:')
    movements.slice(0, 10).forEach((m, i) => {
      console.log(`  ${i + 1}. ${m.type} ${m.quantity} × "${m.product_name}" | ${m.counterparty || '—'} | ${m.date}`)
    })
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
    console.log(`\n⏱️  ${elapsed} сек`)
    return { inserted: 0, matched: 0, unmatched: 0, errors: [] }
  }

  // Real import: resolve product IDs
  const supabase = getSupabase()
  console.log('🔍 Завантаження індексу товарів...')
  const productIndex = await fetchProductIndex(supabase)
  console.log(`   Товарів в БД: ${productIndex.size}`)

  // Match movements to product IDs
  const matched = []
  const unmatchedNames = new Set()
  for (const m of movements) {
    const productId = productIndex.get(m.product_key)
    if (!productId) {
      unmatchedNames.add(m.product_name)
      continue
    }
    matched.push({
      product_id: productId,
      type: m.type,
      quantity: m.quantity,
      counterparty: m.counterparty,
      created_at: `${m.date}T12:00:00+03:00`,
      note: m.note,
    })
  }

  if (unmatchedNames.size > 0) {
    console.log(`⚠️  Товарів не знайдено в БД: ${unmatchedNames.size}`)
    ;[...unmatchedNames].slice(0, 5).forEach(n => console.log(`   - ${n}`))
    if (unmatchedNames.size > 5) console.log(`   ... і ще ${unmatchedNames.size - 5}`)
  }

  // Batch insert
  console.log(`📦 Додаю ${matched.length} рухів батчами по ${BATCH_SIZE}...`)
  let inserted = 0
  const errors = []

  for (let i = 0; i < matched.length; i += BATCH_SIZE) {
    const chunk = matched.slice(i, i + BATCH_SIZE)
    const { error } = await supabase.from('stock_movements').insert(chunk)
    if (error) {
      errors.push(`Помилка батчу ${i + 1}-${i + chunk.length}: ${error.message}`)
    } else {
      inserted += chunk.length
    }
    const done = Math.min(i + BATCH_SIZE, matched.length)
    if (done % 500 === 0 || done === matched.length) {
      console.log(`   Додано ${done}/${matched.length}...`)
    }
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
  console.log('\n✅ Імпорт рухів завершено:')
  console.log(`   Додано: ${inserted}`)
  console.log(`   Зматчено товарів: ${matched.length}`)
  console.log(`   Не знайдено: ${unmatchedNames.size} товарів`)
  console.log(`   ⏱️  ${elapsed} сек`)
  if (errors.length > 0) {
    console.log(`   ⚠️  Помилки (${errors.length}):`)
    errors.forEach(e => console.log(`      - ${e}`))
  }

  return { inserted, matched: matched.length, unmatched: unmatchedNames.size, errors }
}

/**
 * CLI entry point
 */
async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const filePath = args.find(a => !a.startsWith('--'))

  if (!filePath) {
    console.error('Використання: node src/import-movements.mjs <шлях_до_CSV> [--dry-run]')
    process.exit(1)
  }

  try {
    await importMovements(filePath, { dryRun })
  } catch (err) {
    console.error('❌ Критична помилка:', err.message)
    process.exit(1)
  }
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  main()
}
