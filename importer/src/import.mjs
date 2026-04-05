import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateCSV } from './validate.mjs'
import { parseCSV } from './parse.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '..', '.env.local') })

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_KEY
const BATCH_SIZE = 50

function getSupabase() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('SUPABASE_URL та SUPABASE_KEY мають бути встановлені в .env.local')
  }
  return createClient(SUPABASE_URL, SUPABASE_KEY)
}

/**
 * Build a dedup key: name + sorted articles.
 */
export function makeProductKey(name, articles) {
  return `${name}|${[...articles].sort().join(',')}`
}

/**
 * Filter out products that already exist in DB (by name+articles key).
 * @param {Array} products - parsed products
 * @param {Set<string>} existingKeys - set of keys already in DB
 * @returns {{ newProducts: Array, duplicates: Array }}
 */
export function filterNewProducts(products, existingKeys) {
  const newProducts = []
  const duplicates = []
  for (const p of products) {
    const key = makeProductKey(p.name, p.articles)
    if (existingKeys.has(key)) {
      duplicates.push(p)
    } else {
      newProducts.push(p)
    }
  }
  return { newProducts, duplicates }
}

/**
 * Deduplicate products within the same array (same CSV file).
 * Keeps the first occurrence, skips subsequent ones with same name+articles.
 * @param {Array} products
 * @returns {{ unique: Array, internalDupes: Array }}
 */
export function deduplicateProducts(products) {
  const seen = new Set()
  const unique = []
  const internalDupes = []
  for (const p of products) {
    const key = makeProductKey(p.name, p.articles)
    if (seen.has(key)) {
      internalDupes.push(p)
    } else {
      seen.add(key)
      unique.push(p)
    }
  }
  return { unique, internalDupes }
}

/**
 * Fetch all existing product keys from Supabase (paginated).
 */
async function fetchExistingProductKeys(supabase) {
  const keys = new Set()
  let offset = 0
  const PAGE = 1000
  while (true) {
    const { data, error } = await supabase
      .from('products')
      .select('name, articles')
      .range(offset, offset + PAGE - 1)
    if (error) throw new Error(`Помилка читання products: ${error.message}`)
    for (const row of data) {
      keys.add(makeProductKey(row.name, row.articles))
    }
    if (data.length < PAGE) break
    offset += PAGE
  }
  return keys
}

/**
 * Import products from a CSV file into Supabase.
 *
 * @param {string} filePath - path to the CSV file
 * @param {{ dryRun?: boolean }} options
 * @returns {Promise<{ inserted: number, skipped: number, movements: number, errors: string[] }>}
 */
export async function importCSV(filePath, { dryRun = false } = {}) {
  const t0 = Date.now()

  // Step 1: Validate
  console.log('🔍 Валідація файлу...')
  const validation = validateCSV(filePath)

  if (!validation.valid) {
    console.log('❌ Файл має помилки:')
    validation.errors.forEach(e => console.log(`   - ${e}`))
    return { inserted: 0, skipped: 0, movements: 0, errors: validation.errors }
  }

  if (validation.warnings.length > 0) {
    console.log(`⚠️  Попередження (${validation.warnings.length}):`)
    validation.warnings.forEach(w => console.log(`   - ${w}`))
  }

  // Step 2: Parse
  console.log('📋 Парсинг файлу...')
  const products = parseCSV(filePath)
  console.log(`📊 Знайдено товарів: ${products.length}`)

  if (dryRun) {
    console.log('\n🏃 DRY RUN — нічого не записуємо в БД')
    console.log(`   Буде додано товарів: ${products.length}`)
    const movementsCount = products.filter(p => p.current_stock > 0).length
    console.log(`   Буде створено рухів залишків: ${movementsCount}`)
    console.log('\nПерші 10 товарів:')
    products.slice(0, 10).forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.name} | ${p.articles.join(', ') || '—'} | Полка: ${p.shelf_location || '—'} | Залишок: ${p.current_stock}`)
    })
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
    console.log(`\n⏱️  ${elapsed} сек`)
    return { inserted: products.length, skipped: 0, movements: movementsCount, errors: [] }
  }

  // Step 3: Check for existing products in DB
  const supabase = getSupabase()
  console.log('🔍 Перевірка дублікатів в БД...')
  const existingKeys = await fetchExistingProductKeys(supabase)
  const { newProducts: fromDB, duplicates: dbDupes } = filterNewProducts(products, existingKeys)

  // Step 3b: Deduplicate within the CSV itself
  const { unique: newProducts, internalDupes } = deduplicateProducts(fromDB)
  const duplicates = [...dbDupes, ...internalDupes]

  if (dbDupes.length > 0) {
    console.log(`⏭️  Пропущено (вже в БД): ${dbDupes.length}`)
    dbDupes.slice(0, 10).forEach(d =>
      console.log(`   - ${d.name} [${d.articles.join(', ') || 'без артикулу'}]`)
    )
    if (dbDupes.length > 10) console.log(`   ... і ще ${dbDupes.length - 10}`)
  }

  if (internalDupes.length > 0) {
    console.log(`⏭️  Пропущено (дублікати в CSV): ${internalDupes.length}`)
    internalDupes.forEach(d =>
      console.log(`   - ${d.name} [${d.articles.join(', ') || 'без артикулу'}]`)
    )
  }

  if (newProducts.length === 0) {
    console.log('ℹ️  Нових товарів немає — все вже в БД.')
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
    console.log(`⏱️  ${elapsed} сек`)
    return { inserted: 0, skipped: duplicates.length, movements: 0, errors: [] }
  }

  // Step 4: Batch insert products
  console.log(`📦 Додаю ${newProducts.length} товарів батчами по ${BATCH_SIZE}...`)
  const errors = []
  let inserted = 0
  const stockMap = new Map()
  for (const p of newProducts) {
    if (p.current_stock > 0) {
      stockMap.set(makeProductKey(p.name, p.articles), p.current_stock)
    }
  }

  const pendingMovements = []

  for (let i = 0; i < newProducts.length; i += BATCH_SIZE) {
    const chunk = newProducts.slice(i, i + BATCH_SIZE)
    const rows = chunk.map(p => ({
      name: p.name,
      articles: p.articles,
      shelf_location: p.shelf_location,
      boss_quantity: p.boss_quantity,
      current_stock: 0,
      is_active: true,
    }))

    const { data, error } = await supabase
      .from('products')
      .insert(rows)
      .select('id, name, articles')

    if (error) {
      errors.push(`Помилка батчу ${i + 1}-${i + chunk.length}: ${error.message}`)
      continue
    }

    inserted += data.length

    for (const row of data) {
      const key = makeProductKey(row.name, row.articles)
      const stock = stockMap.get(key)
      if (stock) {
        pendingMovements.push({
          product_id: row.id,
          type: 'IN',
          quantity: stock,
          note: 'Початковий залишок з CSV',
        })
      }
    }

    const done = Math.min(i + BATCH_SIZE, newProducts.length)
    console.log(`   Додано ${done}/${newProducts.length}...`)
  }

  // Step 5: Batch insert stock movements
  let movements = 0
  if (pendingMovements.length > 0) {
    console.log(`📦 Додаю ${pendingMovements.length} рухів залишків...`)
    for (let i = 0; i < pendingMovements.length; i += BATCH_SIZE) {
      const chunk = pendingMovements.slice(i, i + BATCH_SIZE)
      const { error } = await supabase.from('stock_movements').insert(chunk)
      if (error) {
        errors.push(`Помилка руху батчу ${i + 1}-${i + chunk.length}: ${error.message}`)
      } else {
        movements += chunk.length
      }
    }
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
  console.log('\n✅ Імпорт завершено:')
  console.log(`   Додано товарів: ${inserted}`)
  console.log(`   Пропущено дублікатів: ${duplicates.length}`)
  console.log(`   Рухів залишків: ${movements}`)
  console.log(`   ⏱️  ${elapsed} сек`)
  if (errors.length > 0) {
    console.log(`   ⚠️  Помилки (${errors.length}):`)
    errors.forEach(e => console.log(`      - ${e}`))
  }

  return { inserted, skipped: duplicates.length, movements, errors }
}

/**
 * CLI entry point: node src/import.mjs path/to/file.csv [--dry-run]
 */
async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const filePath = args.find(a => !a.startsWith('--'))

  if (!filePath) {
    console.error('Використання: node src/import.mjs <шлях_до_CSV> [--dry-run]')
    process.exit(1)
  }

  try {
    const result = await importCSV(filePath, { dryRun })
    if (result.errors.length > 0 && result.inserted === 0) {
      process.exit(1)
    }
  } catch (err) {
    console.error('❌ Критична помилка:', err.message)
    process.exit(1)
  }
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  main()
}
