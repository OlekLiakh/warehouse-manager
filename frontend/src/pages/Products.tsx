import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Product } from '../types'
import { filterProducts } from '../utils/search'
import { fetchPaginated } from '../utils/fetch-paginated'

interface SubtypeCounts {
  DNIPRO: number
  PICKUP: number
  NOVA_POSHTA: number
}

export default function Products() {
  const navigate = useNavigate()
  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [loading, setLoading] = useState(true)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [todayOrders, setTodayOrders] = useState<SubtypeCounts>({ DNIPRO: 0, PICKUP: 0, NOVA_POSHTA: 0 })
  const dropdownRef = useRef<HTMLDivElement>(null)

  async function fetchProducts() {
    setLoading(true)
    const all = await fetchPaginated<Product>((from, to) =>
      supabase.from('products').select('*').order('name').range(from, to)
    )
    setProducts(all)
    setLoading(false)
  }

  async function fetchTodayOrders() {
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('orders')
      .select('subtype')
      .gte('created_at', `${today}T00:00:00`)
    const dnipro = data?.filter(o => o.subtype === 'DNIPRO').length ?? 0
    const pickup = data?.filter(o => o.subtype === 'PICKUP').length ?? 0
    const nova = data?.filter(o => o.subtype === 'NOVA_POSHTA').length ?? 0
    setTodayOrders({ DNIPRO: dnipro, PICKUP: pickup, NOVA_POSHTA: nova })
  }

  useEffect(() => { fetchProducts(); fetchTodayOrders() }, [])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const activeProducts = products.filter(p => p.is_active)
  const filtered = filterProducts(products, search).filter(p => showInactive || p.is_active)
  const inStock = activeProducts.filter(p => p.current_stock > 0).length
  const totalOrders = todayOrders.DNIPRO + todayOrders.PICKUP + todayOrders.NOVA_POSHTA

  return (
    <div className="overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🏪</span>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Склад</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/journal')}
            className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors h-11">
            📓 Журнал
          </button>
          <div ref={dropdownRef} className="relative">
            <button onClick={() => setDropdownOpen(!dropdownOpen)}
              className="px-4 py-2.5 bg-[#1a56db] text-white rounded-xl text-sm font-medium hover:bg-[#1648c0] transition-colors h-11">
              + Накладна ▾
            </button>
            {dropdownOpen && (
              <div className="absolute right-0 mt-1 w-48 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-20">
                <button onClick={() => { navigate('/invoice/new?type=IN'); setDropdownOpen(false) }}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                  📦 Прибуткова
                </button>
                <button onClick={() => { navigate('/invoice/new?type=OUT'); setDropdownOpen(false) }}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                  📤 Видаткова
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-4 py-3 text-center">
          <div className="text-2xl font-bold text-gray-900">{activeProducts.length}</div>
          <div className="text-xs text-gray-500 mt-0.5">Товарів</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-4 py-3 text-center">
          <div className="text-2xl font-bold text-[#057a55]">{inStock}</div>
          <div className="text-xs text-gray-500 mt-0.5">У наявності</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-3 py-3 text-center">
          <div className="text-xs text-gray-500 mb-1">Сьогодні</div>
          {totalOrders === 0 ? (
            <div className="text-xs text-gray-400">Замовлень немає</div>
          ) : (
            <div className="flex items-end justify-center gap-3">
              {todayOrders.DNIPRO > 0 && (
                <div className="text-center">
                  <div className="text-xl font-bold text-gray-900">{todayOrders.DNIPRO}</div>
                  <div className="text-sm">🚚</div>
                  <div className="text-[10px] text-gray-500 leading-tight">Дніпро</div>
                </div>
              )}
              {todayOrders.PICKUP > 0 && (
                <div className="text-center">
                  <div className="text-xl font-bold text-gray-900">{todayOrders.PICKUP}</div>
                  <div className="text-sm">🧍</div>
                  <div className="text-[10px] text-gray-500 leading-tight">Самов.</div>
                </div>
              )}
              {todayOrders.NOVA_POSHTA > 0 && (
                <div className="text-center">
                  <div className="text-xl font-bold text-gray-900">{todayOrders.NOVA_POSHTA}</div>
                  <div className="text-sm">📮</div>
                  <div className="text-[10px] text-gray-500 leading-tight">НП</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Пошук по назві, артикулу, полиці..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1a56db] focus:border-[#1a56db] transition-colors"
        />
      </div>

      <div className="flex items-center justify-between mb-4">
        <label className="inline-flex items-center gap-2 text-sm text-gray-500 cursor-pointer select-none">
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)}
            className="rounded border-gray-300 text-[#1a56db] focus:ring-[#1a56db]" />
          Показати неактивні
        </label>
        <button onClick={() => navigate('/product/new')}
          className="text-sm text-[#1a56db] hover:text-[#1648c0] font-medium transition-colors">
          + Додати товар
        </button>
      </div>

      {loading ? (
        <p className="text-gray-400 py-8 text-center">Завантаження...</p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-400 py-8 text-center">Нічого не знайдено</p>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Артикул</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Назва</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Полиця</th>
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
                    <td className="px-4 py-3 font-mono text-sm text-gray-600">{p.articles.join(', ') || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900">{p.name}</span>
                      {!p.is_active && <span className="ml-2 text-xs text-red-600 bg-red-50 px-1.5 py-0.5 rounded">[неактивний]</span>}
                      {p.notes && <span className="ml-2 text-xs text-gray-400">({p.notes})</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{p.shelf_location || '—'}</td>
                    <td className="px-4 py-3">
                      {p.current_stock === 0
                        ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">0</span>
                        : <span className="font-medium text-gray-900">{p.current_stock}</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {filtered.map(p => (
              <div
                key={p.id}
                onClick={() => navigate(`/product/${p.id}`)}
                className="bg-white rounded-xl shadow-sm border border-gray-200 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors active:bg-gray-100"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    {p.articles.length > 0 && (
                      <div className="font-mono text-xs text-gray-500 mb-0.5">{p.articles.join(', ')}</div>
                    )}
                    <div className="font-medium text-gray-900 text-sm leading-snug">
                      {p.name}
                      {!p.is_active && <span className="ml-1.5 text-xs text-red-600 bg-red-50 px-1 py-0.5 rounded">[неактивний]</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {p.shelf_location && (
                      <span className="text-xs text-gray-400">{p.shelf_location}</span>
                    )}
                    {p.current_stock === 0
                      ? <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">0</span>
                      : <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-900">{p.current_stock}</span>
                    }
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <p className="text-sm text-gray-400 mt-3">Показано: {filtered.length} з {products.length}</p>
    </div>
  )
}
