import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Product } from '../types'
import { filterProducts } from '../utils/search'
import { fetchPaginated } from '../utils/fetch-paginated'

export default function Products() {
  const navigate = useNavigate()
  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [loading, setLoading] = useState(true)

  async function fetchProducts() {
    setLoading(true)
    const all = await fetchPaginated<Product>((from, to) =>
      supabase.from('products').select('*').order('name').range(from, to)
    )
    setProducts(all)
    setLoading(false)
  }

  useEffect(() => { fetchProducts() }, [])

  const filtered = filterProducts(products, search).filter(p => showInactive || p.is_active)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">🏪 Склад</h1>
        <div className="flex gap-2">
          <button onClick={() => navigate('/journal')}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors">
            📓 Журнал
          </button>
          <button onClick={() => navigate('/product/new')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
            + Додати товар
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <button onClick={() => navigate('/invoice/new?type=IN')}
          className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors">
          📦 Новий прихід
        </button>
        <button onClick={() => navigate('/invoice/new?type=OUT')}
          className="flex-1 px-4 py-2.5 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 transition-colors">
          📤 Нова видача
        </button>
      </div>

      <div className="relative mb-3">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
        <input
          type="text"
          placeholder="Пошук по назві, артикулу, полиці, нотатках..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <label className="inline-flex items-center gap-2 mb-4 text-sm text-gray-500 cursor-pointer select-none">
        <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)}
          className="rounded border-gray-300" />
        Показати неактивні
      </label>

      {loading ? (
        <p className="text-gray-400 py-8 text-center">Завантаження...</p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-400 py-8 text-center">Нічого не знайдено</p>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Назва</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">Артикул</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Полиця</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Залишок</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(p => (
                <tr
                  key={p.id}
                  onClick={() => navigate(`/product/${p.id}`)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-900">{p.name}</span>
                    {!p.is_active && <span className="ml-2 text-xs text-red-600 bg-red-50 px-1.5 py-0.5 rounded">[неактивний]</span>}
                    {p.notes && <span className="ml-2 text-xs text-gray-400">({p.notes})</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 hidden sm:table-cell">{p.articles.join(', ') || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 hidden md:table-cell">{p.shelf_location || '—'}</td>
                  <td className="px-4 py-3">
                    {p.current_stock === 0
                      ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">0</span>
                      : <span className="font-bold text-gray-900">{p.current_stock}</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-sm text-gray-400 mt-3">Показано: {filtered.length} з {products.length}</p>
    </div>
  )
}
