import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Invoice, Order, StockMovement } from '../types'
import { getInvoiceLabel, canCancelInvoice } from '../utils/invoice'
import { quantityDisplay } from '../utils/movement'

interface MovementWithProduct extends StockMovement {
  products: { name: string; articles: string[]; shelf_location: string | null } | null
}

interface InvoiceWithRelations extends Invoice {
  orders: Order[]
  stock_movements: MovementWithProduct[]
}

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [invoice, setInvoice] = useState<InvoiceWithRelations | null>(null)
  const [loading, setLoading] = useState(true)

  async function fetchInvoice() {
    setLoading(true)
    const { data } = await supabase
      .from('invoices')
      .select(`
        *,
        orders(*),
        stock_movements(
          *,
          products(name, articles, shelf_location)
        )
      `)
      .eq('id', id)
      .single()
    setInvoice(data as InvoiceWithRelations | null)
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchInvoice() }, [id])

  async function handleCancel() {
    if (!invoice) return
    const label = getInvoiceLabel(invoice)
    if (!confirm(`Скасувати накладну "${label}"?\nВсі рухи та замовлення будуть видалені, залишки повернуться.`)) return
    const { error } = await supabase.from('invoices').delete().eq('id', id)
    if (error) {
      alert('Помилка скасування: ' + error.message)
    } else {
      navigate('/journal')
    }
  }

  if (loading) return <p className="text-gray-400 py-8 text-center">Завантаження...</p>
  if (!invoice) return <p className="text-gray-400 py-8 text-center">Накладну не знайдено</p>

  const label = getInvoiceLabel(invoice)
  const createdAt = new Date(invoice.created_at).toLocaleString('uk-UA')
  const isOut = invoice.type === 'OUT'

  // Group movements by order_id for OUT invoices
  const orderMovements = new Map<string, MovementWithProduct[]>()
  const unlinkedMovements: MovementWithProduct[] = []
  for (const m of invoice.stock_movements) {
    if (m.order_id) {
      if (!orderMovements.has(m.order_id)) orderMovements.set(m.order_id, [])
      orderMovements.get(m.order_id)!.push(m)
    } else {
      unlinkedMovements.push(m)
    }
  }

  return (
    <div className="overflow-x-hidden">
      <button onClick={() => navigate('/journal')}
        className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block transition-colors">
        ← Журнал
      </button>

      {/* Invoice header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900 mb-1">{label}</h1>
            <p className="text-sm text-gray-500">{createdAt}</p>
            {invoice.invoice_number && (
              <p className="text-sm text-gray-600 mt-1">ПН №{invoice.invoice_number}</p>
            )}
            {invoice.note && (
              <p className="text-sm text-gray-500 mt-1">{invoice.note}</p>
            )}
          </div>
          <div className={`shrink-0 px-3 py-1.5 rounded-xl text-sm font-medium text-white ${
            invoice.type === 'IN' ? 'bg-[#057a55]' : 'bg-[#e02424]'
          }`}>
            {invoice.type === 'IN' ? '📦 Прихід' : '📤 Видача'}
          </div>
        </div>
      </div>

      {/* IN invoice: flat list of movements */}
      {!isOut && unlinkedMovements.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-4">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700">Товари ({unlinkedMovements.length})</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {unlinkedMovements.map(m => (
              <div key={m.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="w-8 text-center text-[#057a55]">📦</span>
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
        </div>
      )}

      {/* OUT invoice: orders with their movements */}
      {isOut && invoice.orders.length > 0 && (
        <div className="space-y-4 mb-4">
          {invoice.orders.map((order, idx) => {
            const movements = orderMovements.get(order.id) ?? []
            return (
              <div key={order.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 bg-orange-50 border-b border-orange-200">
                  <h3 className="text-sm font-semibold text-orange-800">
                    Замовлення {idx + 1}
                    {order.delivery_details && (
                      <span className="font-normal text-orange-600 ml-2">— {order.delivery_details}</span>
                    )}
                  </h3>
                  {order.note && <p className="text-xs text-orange-600 mt-0.5">{order.note}</p>}
                </div>
                <div className="divide-y divide-gray-100">
                  {movements.map(m => (
                    <div key={m.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                      <span className="w-8 text-center text-[#e02424]">📤</span>
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
                  {movements.length === 0 && (
                    <p className="px-4 py-3 text-sm text-gray-400">Немає рухів</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Also show unlinked movements for OUT (legacy data) */}
      {isOut && unlinkedMovements.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-4">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700">Інші рухи ({unlinkedMovements.length})</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {unlinkedMovements.map(m => (
              <div key={m.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="w-8 text-center">{m.type === 'IN' ? '📦' : '📤'}</span>
                <span className="cursor-pointer text-[#1a56db] hover:text-[#1648c0] transition-colors flex-1 min-w-0 truncate"
                  onClick={() => navigate(`/product/${m.product_id}`)}>
                  {m.products?.name ?? m.product_id}
                </span>
                <span className="font-bold whitespace-nowrap">{quantityDisplay(m)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cancel button */}
      {canCancelInvoice(invoice) && (
        <button onClick={handleCancel}
          className="px-4 py-2.5 border border-red-300 text-red-600 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors">
          ❌ Скасувати накладну
        </button>
      )}
    </div>
  )
}
