export interface Product {
  id: string
  name: string
  articles: string[]
  shelf_location: string | null
  current_stock: number
  boss_quantity: number | null
  notes: string | null
  is_active: boolean
  description: string | null
  photo_urls: string[]
  external_url: string | null
  created_at: string
  updated_at: string
}

export interface StockMovement {
  id: string
  product_id: string
  type: 'IN' | 'OUT' | 'MOVE' | 'ADJUST'
  quantity: number
  counterparty: string | null
  invoice_number: string | null
  note: string | null
  created_at: string
}

export type ProductForm = Omit<Product, 'id' | 'current_stock' | 'is_active' | 'created_at' | 'updated_at'>
export type MovementForm = Omit<StockMovement, 'id' | 'created_at'>
