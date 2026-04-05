import type { Product } from '../types'

export function filterProducts(products: Product[], query: string): Product[] {
  const q = query.toLowerCase()
  if (!q) return products
  return products.filter(p =>
    p.name.toLowerCase().includes(q) ||
    p.articles.some(a => a.toLowerCase().includes(q)) ||
    (p.shelf_location?.toLowerCase().includes(q) ?? false) ||
    (p.notes?.toLowerCase().includes(q) ?? false) ||
    (p.description?.toLowerCase().includes(q) ?? false)
  )
}
