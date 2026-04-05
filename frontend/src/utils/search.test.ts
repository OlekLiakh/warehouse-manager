import { describe, it, expect } from 'vitest'
import { filterProducts } from './search'
import type { Product } from '../types'

const base: Product = {
  id: '1',
  name: 'Ключ-Карта Tesla Model 3/Y',
  articles: ['1104284-00-A', '1104284-00-B'],
  shelf_location: 'А-1_2',
  current_stock: 10,
  boss_quantity: null,
  notes: 'оригінал',
  is_active: true,
  description: 'NFC ключ-карта для Tesla',
  photo_urls: [],
  external_url: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const camera: Product = {
  ...base,
  id: '2',
  name: 'Камера заднього виду',
  articles: ['1642350-00-C'],
  shelf_location: 'С-2_3',
  notes: 'juniper, MY2024+',
  description: null,
}

const inactive: Product = {
  ...base,
  id: '3',
  name: 'Гальмівні колодки',
  articles: ['1188221-00-E'],
  shelf_location: 'Б-1_4',
  notes: 'під списання',
  is_active: false,
  description: null,
}

const products = [base, camera, inactive]

describe('filterProducts', () => {
  it('empty query returns all products', () => {
    expect(filterProducts(products, '')).toHaveLength(3)
  })

  it('searches by name (partial match)', () => {
    const result = filterProducts(products, 'камера')
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Камера заднього виду')
  })

  it('searches by articles (array)', () => {
    const result = filterProducts(products, '1104284')
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Ключ-Карта Tesla Model 3/Y')
  })

  it('searches by shelf_location', () => {
    const result = filterProducts(products, 'С-2_3')
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Камера заднього виду')
  })

  it('searches by notes', () => {
    const result = filterProducts(products, 'juniper')
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Камера заднього виду')
  })

  it('searches by description', () => {
    const result = filterProducts(products, 'NFC')
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Ключ-Карта Tesla Model 3/Y')
  })

  it('case insensitive search', () => {
    expect(filterProducts(products, 'КЛЮЧ-КАРТА')).toHaveLength(1)
    expect(filterProducts(products, 'ключ-карта')).toHaveLength(1)
  })

  it('includes inactive products (filter is client-side concern)', () => {
    const result = filterProducts(products, 'гальмівні')
    expect(result).toHaveLength(1)
    expect(result[0].is_active).toBe(false)
  })

  it('returns empty array when nothing matches', () => {
    expect(filterProducts(products, 'неіснуючий товар xyz')).toHaveLength(0)
  })

  it('handles null description and notes gracefully', () => {
    const result = filterProducts([camera], 'NFC')
    expect(result).toHaveLength(0)
  })
})
