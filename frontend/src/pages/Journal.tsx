import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { StockMovement } from '../types'
import { quantityDisplay } from '../utils/movement'
import { groupByInvoice } from '../utils/journal'
import type { InvoiceGroup } from '../utils/journal'
import { fetchPaginated } from '../utils/fetch-paginated'

interface MovementWithProduct extends StockMovement {
  products: { name: string; articles: string[] } | null
}

function todayString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function groupHeaderColor(type: InvoiceGroup<MovementWithProduct>['type']) {
  if (type === 'IN') return 'bg-green-600'
  if (type === 'OUT') return 'bg-red-600'
  return 'bg-gray-600'
}

function groupIcon(type: InvoiceGroup<MovementWithProduct>['type']) {
  if (type === 'IN') return '📦'
  if (type === 'OUT') return '📤'
  return '🔄'
}

export default function Journal() {
  const navigate = useNavigate()
  const [date, setDate] = useState(todayString())
  const [movements, setMovements] = useState<MovementWithProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'IN' | 'OUT'>('ALL')
  const [groupedView, setGroupedView] = useState(false)
  const [hideInitial, setHideInitial] = useState(true)
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())

  async function fetchMovements() {
    setLoading(true)
    const start = new Date(`${date}T00:00:00`)
    const end = new Date(`${date}T23:59:59.999`)

    const all = await fetchPaginated<MovementWithProduct>((from, to) =>
      supabase
        .from('stock_movements')
        .select('*, products(id, name, articles, shelf_location)')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .order('created_at', { ascending: false })
        .range(from, to)
    )

    setMovements(all)
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchMovements() }, [date])

  const filtered = movements.filter(m => typeFilter === 'ALL' || m.type === typeFilter)
  const groups = groupByInvoice(filtered)
  const visibleGroups = hideInitial ? groups.filter(g => !g.isInitialStock) : groups

  function toggleCollapse(index: number) {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  // Auto-collapse initial stock groups
  useEffect(() => {
    const initialIndices = new Set<number>()
    groups.forEach((g, i) => { if (g.isInitialStock) initialIndices.add(i) })
    setCollapsed(initialIndices)
  }, [movements, typeFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  const filterButtons = [
    { key: 'ALL' as const, label: 'Всі' },
    { key: 'IN' as const, label: '📦 Прийом' },
    { key: 'OUT' as const, label: '📤 Видача' },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">📓 Журнал рухів</h1>
        <button onClick={() => navigate('/')}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors">
          ← Склад
        </button>
      </div>

      <div className="flex flex-wrap gap-3 items-center mb-5 bg-white rounded-lg shadow-sm border border-gray-200 p-3">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          📅 Дата:
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
        </label>

        <div className="flex gap-1">
          {filterButtons.map(t => (
            <button key={t.key} onClick={() => setTypeFilter(t.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                typeFilter === t.key
                  ? 'bg-gray-800 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4 ml-auto">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
            <input type="checkbox" checked={hideInitial} onChange={e => setHideInitial(e.target.checked)}
              className="rounded border-gray-300" />
            Приховати початкові залишки
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
            <input type="checkbox" checked={groupedView} onChange={e => setGroupedView(e.target.checked)}
              className="rounded border-gray-300" />
            По замовленнях
          </label>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-400 py-8 text-center">Завантаження...</p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-400 py-8 text-center">Рухів за {date} не знайдено</p>
      ) : groupedView ? (
        <div className="space-y-3">
          {visibleGroups.map((g, i) => (
            <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <button
                onClick={() => toggleCollapse(i)}
                className={`w-full flex items-center justify-between px-4 py-3 text-white text-left ${groupHeaderColor(g.type)}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span>{groupIcon(g.type)}</span>
                  <span className="font-semibold truncate">{g.label}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">{g.movements.length} поз.</span>
                  <span className="text-sm">{collapsed.has(i) ? '▸' : '▾'}</span>
                </div>
              </button>

              {!collapsed.has(i) && (
                <div className="divide-y divide-gray-100">
                  {g.movements.map(m => (
                    <div key={m.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                      <span className="cursor-pointer text-blue-600 hover:text-blue-800 transition-colors flex-1 min-w-0 truncate"
                        onClick={() => navigate(`/product/${m.product_id}`)}>
                        {m.products?.name ?? m.product_id}
                      </span>
                      <span className="text-gray-400 text-xs hidden sm:block truncate max-w-40">{m.products?.articles?.length ? m.products.articles.join(', ') : '—'}</span>
                      <span className="font-bold whitespace-nowrap">{quantityDisplay(m)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Час</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Тип</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Товар</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">Артикул</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Кількість</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">Контрагент</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Накладна</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">Нотатка</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(hideInitial ? filtered.filter(m => m.note !== 'Імпорт з CSV') : filtered).map(m => (
                <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                    {new Date(m.created_at).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium whitespace-nowrap">
                    <span className={m.type === 'IN' ? 'text-green-700' : m.type === 'OUT' ? 'text-red-700' : 'text-gray-500'}>
                      {m.type === 'IN' ? '📦 Прийом' : m.type === 'OUT' ? '📤 Видача' : m.type === 'ADJUST' ? '✏️ Уточнення' : '🔄 Переміщення'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className="cursor-pointer text-blue-600 hover:text-blue-800 transition-colors"
                      onClick={() => navigate(`/product/${m.product_id}`)}>
                      {m.products?.name ?? m.product_id}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 hidden sm:table-cell">{m.products?.articles?.length ? m.products.articles.join(', ') : '—'}</td>
                  <td className="px-4 py-3 text-sm font-bold">{quantityDisplay(m)}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 hidden sm:table-cell">{m.counterparty || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 hidden md:table-cell">{m.invoice_number || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 hidden lg:table-cell">{m.note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-sm text-gray-400 mt-3">
        Показано: {filtered.length} рухів за {date}
      </p>
    </div>
  )
}
