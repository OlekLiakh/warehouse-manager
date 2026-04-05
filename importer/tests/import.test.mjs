import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { makeProductKey, filterNewProducts, deduplicateProducts } from '../src/import.mjs'

describe('makeProductKey', () => {
  it('створює ключ з name + articles', () => {
    assert.equal(makeProductKey('Товар', ['ART-1']), 'Товар|ART-1')
  })

  it('сортує артикули для стабільного ключа', () => {
    assert.equal(
      makeProductKey('Товар', ['B-00', 'A-00']),
      'Товар|A-00,B-00'
    )
  })

  it('порожні артикули → ключ з порожнім списком', () => {
    assert.equal(makeProductKey('Товар', []), 'Товар|')
  })

  it('АНАЛОГ/БУ — частина ключа', () => {
    const k1 = makeProductKey('Захист', ['1585229-00-D'])
    const k2 = makeProductKey('Захист', ['1585229-00-D АНАЛОГ'])
    assert.notEqual(k1, k2)
  })
})

describe('filterNewProducts', () => {
  it('пропускає дублікат (name+articles вже в БД)', () => {
    const products = [
      { name: 'Товар 1', articles: ['ART-1'] },
      { name: 'Товар 2', articles: ['ART-2'] },
      { name: 'Товар 3', articles: ['ART-3'] },
    ]
    const existingKeys = new Set(['Товар 1|ART-1', 'Товар 3|ART-3'])
    const { newProducts, duplicates } = filterNewProducts(products, existingKeys)

    assert.equal(newProducts.length, 1)
    assert.equal(newProducts[0].name, 'Товар 2')
    assert.equal(duplicates.length, 2)
  })

  it('однакова назва але різні артикули — НЕ дублікат', () => {
    const products = [
      { name: 'Патрубок БУ', articles: ['1585719-00-В БУ'] },
      { name: 'Патрубок БУ', articles: ['1472610-00-С БУ'] },
    ]
    const existingKeys = new Set(['Патрубок БУ|1585719-00-В БУ'])
    const { newProducts, duplicates } = filterNewProducts(products, existingKeys)

    assert.equal(newProducts.length, 1)
    assert.equal(newProducts[0].articles[0], '1472610-00-С БУ')
    assert.equal(duplicates.length, 1)
  })

  it('порожня БД — всі товари нові', () => {
    const products = [
      { name: 'Товар 1', articles: ['ART-1'] },
      { name: 'Товар 2', articles: ['ART-2'] },
    ]
    const { newProducts, duplicates } = filterNewProducts(products, new Set())

    assert.equal(newProducts.length, 2)
    assert.equal(duplicates.length, 0)
  })

  it('все вже в БД — нових немає', () => {
    const products = [
      { name: 'Товар 1', articles: ['ART-1'] },
    ]
    const existingKeys = new Set(['Товар 1|ART-1'])
    const { newProducts, duplicates } = filterNewProducts(products, existingKeys)

    assert.equal(newProducts.length, 0)
    assert.equal(duplicates.length, 1)
  })

  it('мульти-артикули — порядок не має значення', () => {
    const products = [
      { name: 'Фільтр', articles: ['B-00', 'A-00'] },
    ]
    // В БД артикули збережені в іншому порядку, але ключ сортує
    const existingKeys = new Set(['Фільтр|A-00,B-00'])
    const { newProducts, duplicates } = filterNewProducts(products, existingKeys)

    assert.equal(duplicates.length, 1)
    assert.equal(newProducts.length, 0)
  })
})

describe('deduplicateProducts', () => {
  it('два товари з однаковим name+articles → залишається один', () => {
    const products = [
      { name: 'Уплотнитель БУ', articles: ['1459233-00-D БУ'], current_stock: 2 },
      { name: 'Інший товар', articles: ['ART-X'], current_stock: 5 },
      { name: 'Уплотнитель БУ', articles: ['1459233-00-D БУ'], current_stock: 0 },
    ]
    const { unique, internalDupes } = deduplicateProducts(products)

    assert.equal(unique.length, 2)
    assert.equal(internalDupes.length, 1)
    assert.equal(unique[0].name, 'Уплотнитель БУ')
    assert.equal(unique[0].current_stock, 2) // перший залишається
    assert.equal(internalDupes[0].current_stock, 0) // другий пропущено
  })

  it('без дублікатів — все залишається', () => {
    const products = [
      { name: 'Товар 1', articles: ['A'] },
      { name: 'Товар 2', articles: ['B'] },
    ]
    const { unique, internalDupes } = deduplicateProducts(products)
    assert.equal(unique.length, 2)
    assert.equal(internalDupes.length, 0)
  })

  it('однакова назва різні артикули — обидва залишаються', () => {
    const products = [
      { name: 'Патрубок БУ', articles: ['1585719-00-В БУ'] },
      { name: 'Патрубок БУ', articles: ['1472610-00-С БУ'] },
    ]
    const { unique, internalDupes } = deduplicateProducts(products)
    assert.equal(unique.length, 2)
    assert.equal(internalDupes.length, 0)
  })
})
