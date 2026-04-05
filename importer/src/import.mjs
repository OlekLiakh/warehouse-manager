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

function getSupabase() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('SUPABASE_URL та SUPABASE_KEY мають бути встановлені в .env.local')
  }
  return createClient(SUPABASE_URL, SUPABASE_KEY)
}

/**
 * Import products from a CSV file into Supabase.
 *
 * @param {string} filePath - path to the CSV file
 * @param {{ dryRun?: boolean }} options
 * @returns {Promise<{ inserted: number, skipped: number, movements: number, errors: string[] }>}
 */
export async function importCSV(filePath, { dryRun = false } = {}) {
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
    return { inserted: products.length, skipped: 0, movements: movementsCount, errors: [] }
  }

  // Step 3: Insert into Supabase
  const supabase = getSupabase()
  let inserted = 0
  let skipped = 0
  let movements = 0
  const errors = []

  for (const product of products) {
    // Insert with current_stock: 0 — the DB trigger will update it
    // when we insert the stock_movement below
    const { data, error } = await supabase
      .from('products')
      .insert({
        name: product.name,
        articles: product.articles,
        shelf_location: product.shelf_location,
        boss_quantity: product.boss_quantity,
        current_stock: 0,
        is_active: true,
      })
      .select('id')
      .single()

    if (error) {
      errors.push(`Помилка при вставці "${product.name}": ${error.message}`)
      skipped++
      continue
    }

    inserted++

    // Create initial stock movement if stock > 0
    if (product.current_stock > 0) {
      const { error: mvError } = await supabase
        .from('stock_movements')
        .insert({
          product_id: data.id,
          type: 'IN',
          quantity: product.current_stock,
          note: 'Початковий залишок з CSV',
        })

      if (mvError) {
        errors.push(`Помилка руху для "${product.name}": ${mvError.message}`)
      } else {
        movements++
      }
    }
  }

  console.log('\n✅ Імпорт завершено:')
  console.log(`   Додано товарів: ${inserted}`)
  console.log(`   Пропущено: ${skipped}`)
  console.log(`   Рухів залишків: ${movements}`)
  if (errors.length > 0) {
    console.log(`   ⚠️  Помилки (${errors.length}):`)
    errors.forEach(e => console.log(`      - ${e}`))
  }

  return { inserted, skipped, movements, errors }
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
