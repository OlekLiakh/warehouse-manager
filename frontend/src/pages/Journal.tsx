import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { StockMovement, Invoice } from '../types'
import { quantityDisplay } from '../utils/movement'
import { groupByInvoice, isInitialStockMovement } from '../utils/journal'
import type { InvoiceGroup } from '../utils/journal'
import { getSubtypeLabel } from '../utils/invoice'
import { fetchPaginated } from '../utils/fetch-paginated'

interface MovementWithProduct extends StockMovement {
  products: { name: string; articles: string[] } | null
}

function todayString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function groupHeaderColor(type: InvoiceGroup<MovementWithProduct>['type']) {
  if (type === 'IN') return 'bg-[#057a55]'
  if (type === 'OUT') return 'bg-[#e02424]'
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
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'IN' | 'OUT'>('ALL')
  const [hideInitial, setHideInitial] = useState(true)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  async function fetchMovements() {
    setLoading(true)
    const start = new Date(`${date}T00:00:00`)
    const end = new Date(`${date}T23:59:59.999`)

    const [movs, invs] = await Promise.all([
      fetchPaginated<MovementWithProduct>((from, to) =>
        supabase
          .from('stock_movements')
          .select('*, products(id, name, articles, shelf_location)')
          .gte('created_at', start.toISOString())
          .lte('created_at', end.toISOString())
          .order('created_at', { ascending: false })
          .range(from, to)
      ),
      fetchPaginated<Invoice>((from, to) =>
        supabase
          .from('invoices')
          .select('*')
          .gte('created_at', start.toISOString())
          .lte('created_at', end.toISOString())
          .order('created_at', { ascending: false })
          .range(from, to)
      ),
    ])

    setMovements(movs)
    setInvoices(invs)
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchMovements() }, [date])

  const filtered = movements.filter(m => {
    if (typeFilter !== 'ALL' && m.type !== typeFilter) return false
    if (hideInitial && isInitialStockMovement(m)) return false
    return true
  })

  const rawGroups = groupByInvoice(filtered)

  // Map invoice_id to Invoice for cancel button and label enhancement
  const invoiceMap = new Map(invoices.map(inv => [inv.id, inv]))

  // Enhance group labels: replace generic labels with subtype info from invoice data
  // Also attach invoice_id to group for linking
  const groups = rawGroups.map(g => {
    if (g.isInitialStock || !g.movements[0]) return { ...g, invoiceId: null as string | null }
    const invoiceId = g.movements[0].invoice_id
    if (!invoiceId) return { ...g, invoiceId: null as string | null }
    const inv = invoiceMap.get(invoiceId)
    if (!inv) return { ...g, invoiceId }
    const parts: string[] = []
    if (inv.type === 'OUT' && inv.subtype) {
      parts.push(getSubtypeLabel(inv.subtype))
    } else if (inv.type === 'IN') {
      parts.push('📦 Прихід')
    } else {
      parts.push('📤 Видача')
    }
    if (inv.invoice_number) parts.push(`ПН №${inv.invoice_number}`)
    return { ...g, label: parts.join(' — '), invoiceId }
  })

  function toggleCollapse(label: string) {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  // Auto-collapse only initial stock groups
  useEffect(() => {
    const initialLabels = new Set<string>()
    const allGroups = groupByInvoice(movements.filter(m => typeFilter === 'ALL' || m.type === typeFilter))
    allGroups.forEach(g => { if (g.isInitialStock) initialLabels.add(g.label) })
    setCollapsed(initialLabels)
  }, [movements, typeFilter])

  const filterButtons = [
    { key: 'ALL' as const, label: 'Всі' },
    { key: 'IN' as const, label: '📦 Прийом' },
    { key: 'OUT' as const, label: '📤 Видача' },
  ]

  return (
    <div className="overflow-x-hidden">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-bold text-gray-900">📓 Журнал рухів</h1>
        <button onClick={() => navigate('/')}
          className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors h-11">
          ← Склад
        </button>
      </div>

      <div className="flex flex-col sm:flex-row flex-wrap gap-3 items-stretch sm:items-center mb-5 bg-white rounded-xl shadow-sm border border-gray-200 p-3">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          📅 Дата:
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="px-3 py-1.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db] focus:border-[#1a56db]" />
        </label>

        <div className="flex gap-1">
          {filterButtons.map(t => (
            <button key={t.key} onClick={() => setTypeFilter(t.key)}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${
                typeFilter === t.key
                  ? 'bg-[#1a56db] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none sm:ml-auto">
          <input type="checkbox" checked={hideInitial} onChange={e => setHideInitial(e.target.checked)}
            className="rounded border-gray-300 text-[#1a56db] focus:ring-[#1a56db]" />
          Приховати початкові залишки
        </label>
      </div>

      {loading ? (
        <p className="text-gray-400 py-8 text-center">Завантаження...</p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-400 py-8 text-center">Рухів за {date} не знайдено</p>
      ) : (
        <div className="space-y-3">
          {groups.map(g => (
            <div key={g.label} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="flex items-center">
                <button
                  onClick={() => toggleCollapse(g.label)}
                  className={`flex-1 flex items-center justify-between px-4 py-3 text-white text-left ${groupHeaderColor(g.type)}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span>{groupIcon(g.type)}</span>
                    {g.invoiceId ? (
                      <span className="font-semibold truncate underline decoration-white/40 cursor-pointer"
                        onClick={e => { e.stopPropagation(); navigate(`/invoice/${g.invoiceId}`) }}>
                        {g.label}
                      </span>
                    ) : (
                      <span className="font-semibold truncate">{g.label}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">{g.movements.length} поз.</span>
                    <span className="text-sm">{collapsed.has(g.label) ? '▶' : '▼'}</span>
                  </div>
                </button>
              </div>

              {!collapsed.has(g.label) && (
                <div className="divide-y divide-gray-100">
                  {g.movements.map(m => (
                    <div key={m.id} className="flex items-center gap-2 px-4 py-2 text-sm">
                      <span className={`w-8 text-center shrink-0 ${m.type === 'IN' ? 'text-[#057a55]' : m.type === 'OUT' ? 'text-[#e02424]' : 'text-gray-500'}`}>
                        {m.type === 'IN' ? '📦' : m.type === 'OUT' ? '📤' : m.type === 'ADJUST' ? '✏️' : '🔄'}
                      </span>
                      <span className="font-mono text-xs text-gray-400 hidden sm:block w-28 truncate">
                        {m.products?.articles?.length ? m.products.articles.join(', ') : '—'}
                      </span>
                      <span className="cursor-pointer text-[#1a56db] hover:text-[#1648c0] transition-colors flex-1 min-w-0 truncate"
                        onClick={() => navigate(`/product/${m.product_id}`)}>
                        {m.products?.name ?? m.product_id}
                      </span>
                      <span className="font-bold whitespace-nowrap">{quantityDisplay(m)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-sm text-gray-400 mt-3">
        Показано: {filtered.length} рухів за {date}
      </p>
    </div>
  )
}
