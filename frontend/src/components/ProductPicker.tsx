import { useState } from 'react'
import type { Product } from '../types'
import { filterProducts } from '../utils/search'

interface Props {
  products: Product[]
  excludeIds: Set<string>
  onPick: (product: Product) => void
  onClose: () => void
}

export default function ProductPicker({ products, excludeIds, onPick, onClose }: Props) {
  const [search, setSearch] = useState('')

  const available = products.filter(p => p.is_active && !excludeIds.has(p.id))
  const filtered = filterProducts(available, search).slice(0, 50)

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-bold">Оберіть товар</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
      </div>

      <div className="relative mb-3">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
        <input
          type="text"
          autoFocus
          placeholder="Пошук по назві, артикулу, полиці..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div className="flex-1 overflow-y-auto -mx-1">
        {filtered.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-6">Нічого не знайдено</p>
        ) : (
          <div className="space-y-1">
            {filtered.map(p => (
              <button
                key={p.id}
                onClick={() => onPick(p)}
                className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-blue-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900 text-sm">{p.name}</span>
                  <span className="text-xs text-gray-500 ml-2 whitespace-nowrap">На складі: {p.current_stock}</span>
                </div>
                {(p.articles.length > 0 || p.shelf_location) && (
                  <div className="text-xs text-gray-400 mt-0.5">
                    {p.articles.length > 0 && <span>{p.articles.join(', ')}</span>}
                    {p.articles.length > 0 && p.shelf_location && <span> · </span>}
                    {p.shelf_location && <span>📍 {p.shelf_location}</span>}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400 mt-2 pt-2 border-t border-gray-100">
        {filtered.length} з {available.length} товарів
      </p>
    </div>
  )
}
