import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseCSVContent } from '../src/parse.mjs'

// Simulated real data (first ~10 rows based on typical warehouse CSV structure)
const SAMPLE_CSV = [
  'Ключ-Карта Tesla Model 3,1133370-00-A,А-1,5,5,5,3',
  'Камера Антихром MS,1642392-70-A,Б-2,10,10,10,8',
  'Захист Переднього Підрамника MS/X Plaid АНАЛОГ,1585229-00-D АНАЛОГ,Д-1_5,7,7,7,4',
  'Захист Переднього Підрамника MS/X Plaid,1585229-00-D,Д-1_4,3,3,3,2',
  'Фара Передня Ліва Model Y БУ,1514575-00-A БУ,Е-3,1,1,1,1',
  '"Фільтр Салону Model 3/Y","1107681-00-C,1107682-00-C",Ж-1,20,20,20,15',
  'Підшипник Маточини Передній Model 3,1044007-00-D,З-2,12,12,12,10',
  'Гальмівний Диск Задній Model S (НОВИЙ),1188420-00-A (НОВИЙ),И-1,4,4,4,3',
  'Болт Колісний Model 3/Y,1012345-00-B,К-3,100,100,100,95',
  ',,,,,,,',
  '1014,,,,,,,',
].join('\n')

describe('parseCSVContent', () => {
  it('парсить правильну кількість товарів з реальних даних', () => {
    const products = parseCSVContent(SAMPLE_CSV)
    // 9 valid products (empty row and 1014 are skipped)
    assert.equal(products.length, 9)
  })

  it('Ключ-Карта парситься коректно', () => {
    const products = parseCSVContent(SAMPLE_CSV)
    const keyCard = products[0]
    assert.equal(keyCard.name, 'Ключ-Карта Tesla Model 3')
    assert.deepEqual(keyCard.articles, ['1133370-00-A'])
    assert.equal(keyCard.shelf_location, 'А-1')
    assert.equal(keyCard.boss_quantity, 5)
    assert.equal(keyCard.current_stock, 3)
    assert.equal(keyCard.is_active, true)
  })

  it('Камера Антихром парситься коректно', () => {
    const products = parseCSVContent(SAMPLE_CSV)
    const camera = products[1]
    assert.equal(camera.name, 'Камера Антихром MS')
    assert.deepEqual(camera.articles, ['1642392-70-A'])
    assert.equal(camera.shelf_location, 'Б-2')
    assert.equal(camera.current_stock, 8)
  })

  it('товар з АНАЛОГ зберігає суфікс в артикулі', () => {
    const products = parseCSVContent(SAMPLE_CSV)
    const analog = products[2]
    assert.equal(analog.name, 'Захист Переднього Підрамника MS/X Plaid АНАЛОГ')
    assert.deepEqual(analog.articles, ['1585229-00-D АНАЛОГ'])
    assert.equal(analog.current_stock, 4)
  })

  it('товар без АНАЛОГ — окремий товар з тим самим артикулом', () => {
    const products = parseCSVContent(SAMPLE_CSV)
    const original = products[3]
    assert.equal(original.name, 'Захист Переднього Підрамника MS/X Plaid')
    assert.deepEqual(original.articles, ['1585229-00-D'])
    assert.equal(original.current_stock, 2)
  })

  it('товар з БУ зберігає суфікс', () => {
    const products = parseCSVContent(SAMPLE_CSV)
    const bu = products[4]
    assert.equal(bu.name, 'Фара Передня Ліва Model Y БУ')
    assert.deepEqual(bu.articles, ['1514575-00-A БУ'])
  })

  it('кілька артикулів через кому → масив', () => {
    const products = parseCSVContent(SAMPLE_CSV)
    const filter = products[5]
    assert.equal(filter.name, 'Фільтр Салону Model 3/Y')
    assert.deepEqual(filter.articles, ['1107681-00-C', '1107682-00-C'])
  })

  it('товар з (НОВИЙ) зберігає суфікс', () => {
    const products = parseCSVContent(SAMPLE_CSV)
    const disc = products[7]
    assert.equal(disc.name, 'Гальмівний Диск Задній Model S (НОВИЙ)')
    assert.deepEqual(disc.articles, ['1188420-00-A (НОВИЙ)'])
  })

  it('порожні рядки і 1014 пропускаються', () => {
    const products = parseCSVContent(SAMPLE_CSV)
    const names = products.map(p => p.name)
    assert.ok(!names.includes(''))
    assert.ok(!names.includes('1014'))
  })

  it('всі товари мають is_active = true', () => {
    const products = parseCSVContent(SAMPLE_CSV)
    assert.ok(products.every(p => p.is_active === true))
  })

  it('нульовий залишок імпортується коректно', () => {
    const csv = 'Товар з нулем,ART-0,A-0,5,5,5,0\n'
    const products = parseCSVContent(csv)
    assert.equal(products.length, 1)
    assert.equal(products[0].current_stock, 0)
  })

  it('від\'ємний залишок імпортується коректно', () => {
    const csv = 'Товар від\'ємний,ART-N,A-N,5,5,5,-2\n'
    const products = parseCSVContent(csv)
    assert.equal(products.length, 1)
    assert.equal(products[0].current_stock, -2)
  })

  it('рядок з нечисловим stock пропускається', () => {
    const csv = [
      'Товар 1,ART-1,A-1,5,5,5,10',
      'Товар Bad,ART-B,A-B,5,5,5,abc',
      'Товар 2,ART-2,A-2,5,5,5,20',
    ].join('\n')
    const products = parseCSVContent(csv)
    assert.equal(products.length, 2)
    assert.equal(products[0].name, 'Товар 1')
    assert.equal(products[1].name, 'Товар 2')
  })

  it('порожній shelf_location → null', () => {
    const csv = 'Товар без полки,ART-1,,5,5,5,10\n'
    const products = parseCSVContent(csv)
    assert.equal(products[0].shelf_location, null)
  })

  it('порожній boss_quantity → null', () => {
    const csv = 'Товар без BOSS,ART-1,A-1,,5,5,10\n'
    const products = parseCSVContent(csv)
    assert.equal(products[0].boss_quantity, null)
  })
})
