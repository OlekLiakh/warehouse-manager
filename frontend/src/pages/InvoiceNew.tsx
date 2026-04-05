import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Product, InvoiceSubtype } from '../types'
import type { InvoiceItem, OrderDraft } from '../utils/invoice'
import { validateInvoice } from '../utils/invoice'
import { fetchPaginated } from '../utils/fetch-paginated'
import ProductPicker from '../components/ProductPicker'

const SUBTYPES: { key: InvoiceSubtype; label: string }[] = [
  { key: 'DNIPRO', label: '🚚 Дніпро' },
  { key: 'PICKUP', label: '🧍 Самовивіз' },
  { key: 'NOVA_POSHTA', label: '📮 Нова Пошта' },
]

function emptyOrder(): OrderDraft {
  return { delivery_details: '', note: '', items: [] }
}

export default function InvoiceNew() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const type = (searchParams.get('type') === 'OUT' ? 'OUT' : 'IN') as 'IN' | 'OUT'
  const isIn = type === 'IN'

  const [products, setProducts] = useState<Product[]>([])
  // IN fields
  const [items, setItems] = useState<InvoiceItem[]>([])
  // OUT fields
  const [orders, setOrders] = useState<OrderDraft[]>([emptyOrder()])
  // Shared fields
  const [subtype, setSubtype] = useState<InvoiceSubtype | null>(null)
  const [counterparty, setCounterparty] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [note, setNote] = useState('')
  // Picker state
  const [pickerOpen, setPickerOpen] = useState<number | null>(null) // null=closed, -1=IN items, 0+=order index
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  async function fetchProducts() {
    const all = await fetchPaginated<Product>((from, to) =>
      supabase.from('products').select('*').order('name').range(from, to)
    )
    setProducts(all)
    setLoading(false)
  }

  useEffect(() => { fetchProducts() }, [])

  // Compute all used product IDs across all orders (for OUT) or items (for IN)
  const excludeIds = new Set(
    isIn
      ? items.map(i => i.product_id)
      : orders.flatMap(o => o.items.map(i => i.product_id))
  )

  function handlePickForIn(product: Product) {
    setItems(prev => [...prev, {
      product_id: product.id,
      product_name: product.name,
      quantity: 1,
      current_stock: product.current_stock,
    }])
    setPickerOpen(null)
  }

  function handlePickForOrder(orderIndex: number, product: Product) {
    setOrders(prev => prev.map((o, i) =>
      i === orderIndex
        ? { ...o, items: [...o.items, { product_id: product.id, product_name: product.name, quantity: 1, current_stock: product.current_stock }] }
        : o
    ))
    setPickerOpen(null)
  }

  function handlePick(product: Product) {
    if (pickerOpen === -1) handlePickForIn(product)
    else if (pickerOpen != null && pickerOpen >= 0) handlePickForOrder(pickerOpen, product)
  }

  function updateInQuantity(index: number, value: number) {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, quantity: value } : item))
  }

  function removeInItem(index: number) {
    setItems(prev => prev.filter((_, i) => i !== index))
  }

  function updateOrderItem(orderIdx: number, itemIdx: number, quantity: number) {
    setOrders(prev => prev.map((o, oi) =>
      oi === orderIdx
        ? { ...o, items: o.items.map((item, ii) => ii === itemIdx ? { ...item, quantity } : item) }
        : o
    ))
  }

  function removeOrderItem(orderIdx: number, itemIdx: number) {
    setOrders(prev => prev.map((o, oi) =>
      oi === orderIdx
        ? { ...o, items: o.items.filter((_, ii) => ii !== itemIdx) }
        : o
    ))
  }

  function updateOrderField(orderIdx: number, field: 'delivery_details' | 'note', value: string) {
    setOrders(prev => prev.map((o, i) => i === orderIdx ? { ...o, [field]: value } : o))
  }

  function addOrder() {
    setOrders(prev => [...prev, emptyOrder()])
  }

  function removeOrder(index: number) {
    setOrders(prev => prev.filter((_, i) => i !== index))
  }

  async function handleSave() {
    const validationError = validateInvoice(type, items, subtype, isIn ? undefined : orders)
    if (validationError) {
      setError(validationError)
      return
    }

    setSaving(true)
    setError(null)

    // 1. Create invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        type,
        subtype: type === 'OUT' ? subtype : null,
        counterparty: counterparty.trim() || null,
        invoice_number: invoiceNumber.trim() || null,
        note: note.trim() || null,
      })
      .select('id')
      .single()

    if (invoiceError || !invoice) {
      setError('Помилка створення накладної: ' + (invoiceError?.message ?? 'невідома помилка'))
      setSaving(false)
      return
    }

    if (isIn) {
      // 2a. IN: insert stock_movements directly
      const movements = items.map(item => ({
        product_id: item.product_id,
        type: 'IN' as const,
        quantity: item.quantity,
        counterparty: counterparty.trim() || null,
        invoice_number: invoiceNumber.trim() || null,
        invoice_id: invoice.id,
        note: note.trim() || null,
      }))
      const { error: movError } = await supabase.from('stock_movements').insert(movements)
      if (movError) {
        setError('Помилка збереження рухів: ' + movError.message)
        setSaving(false)
        return
      }
    } else {
      // 2b. OUT: create orders, then movements per order
      for (const order of orders) {
        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .insert({
            invoice_id: invoice.id,
            subtype,
            delivery_details: order.delivery_details.trim() || null,
            note: order.note.trim() || null,
          })
          .select('id')
          .single()

        if (orderError || !orderData) {
          setError('Помилка створення замовлення: ' + (orderError?.message ?? 'невідома помилка'))
          setSaving(false)
          return
        }

        const movements = order.items.map(item => ({
          product_id: item.product_id,
          type: 'OUT' as const,
          quantity: item.quantity,
          counterparty: counterparty.trim() || null,
          invoice_number: invoiceNumber.trim() || null,
          invoice_id: invoice.id,
          order_id: orderData.id,
          note: null,
        }))
        const { error: movError } = await supabase.from('stock_movements').insert(movements)
        if (movError) {
          setError('Помилка збереження рухів: ' + movError.message)
          setSaving(false)
          return
        }
      }
    }

    navigate('/journal')
  }

  const title = isIn ? '📦 Новий прихід' : '📤 Нова видача'
  const totalItems = isIn
    ? items.reduce((sum, i) => sum + i.quantity, 0)
    : orders.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0), 0)
  const totalPositions = isIn ? items.length : orders.reduce((sum, o) => sum + o.items.length, 0)

  if (loading) return <p className="text-gray-400 py-8 text-center">Завантаження...</p>

  return (
    <div>
      <button onClick={() => navigate('/')}
        className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block transition-colors">
        ← Склад
      </button>

      <h1 className="text-2xl font-bold mb-5">{title}</h1>

      <div className="lg:flex lg:gap-6">
        <div className="flex-1 min-w-0">
          {/* Subtype selection for OUT */}
          {!isIn && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
              <span className="text-sm font-medium text-gray-700 block mb-2">Тип видачі *</span>
              <div className="flex gap-2">
                {SUBTYPES.map(s => (
                  <button key={s.key} onClick={() => setSubtype(s.key)}
                    className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      subtype === s.key
                        ? 'bg-orange-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Header fields */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Контрагент</span>
                <input type="text" value={counterparty}
                  onChange={e => setCounterparty(e.target.value)}
                  placeholder="напр. ФОП Іванов"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Номер накладної</span>
                <input type="text" value={invoiceNumber}
                  onChange={e => setInvoiceNumber(e.target.value)}
                  placeholder="напр. ПН-00123"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </label>
            </div>
            <label className="block mt-3">
              <span className="text-sm font-medium text-gray-700">Нотатка</span>
              <input type="text" value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="необов'язково"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </label>
          </div>

          {/* IN: flat items list */}
          {isIn && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-700">Товари ({items.length})</h2>
                <button onClick={() => setPickerOpen(-1)}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                  + Додати товар
                </button>
              </div>
              {items.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-6">Додайте товари до накладної</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {items.map((item, index) => (
                    <div key={item.product_id} className="flex items-center gap-3 py-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-gray-900 truncate">{item.product_name}</div>
                        <div className="text-xs text-gray-400">На складі: {item.current_stock}</div>
                      </div>
                      <input type="number" min={1} value={item.quantity}
                        onChange={e => updateInQuantity(index, Number(e.target.value))}
                        className="w-20 px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                      <button onClick={() => removeInItem(index)}
                        className="text-red-400 hover:text-red-600 text-lg leading-none transition-colors">&times;</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* OUT: orders list */}
          {!isIn && (
            <div className="space-y-4 mb-4">
              {orders.map((order, orderIdx) => (
                <div key={orderIdx} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 bg-orange-50 border-b border-orange-200">
                    <h3 className="text-sm font-semibold text-orange-800">Замовлення {orderIdx + 1}</h3>
                    {orders.length > 1 && (
                      <button onClick={() => removeOrder(orderIdx)}
                        className="text-xs text-red-500 border border-red-300 rounded px-2 py-0.5 hover:bg-red-50 transition-colors">
                        🗑️ Видалити
                      </button>
                    )}
                  </div>
                  <div className="p-4">
                    <label className="block mb-3">
                      <span className="text-sm font-medium text-gray-700">Деталі доставки</span>
                      <textarea value={order.delivery_details}
                        onChange={e => updateOrderField(orderIdx, 'delivery_details', e.target.value)}
                        placeholder="Адреса, ТТН, телефон..."
                        rows={2}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                    </label>

                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">Товари ({order.items.length})</span>
                      <button onClick={() => setPickerOpen(orderIdx)}
                        className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors">
                        + Додати товар
                      </button>
                    </div>

                    {order.items.length === 0 ? (
                      <p className="text-gray-400 text-xs text-center py-4">Додайте товари до замовлення</p>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {order.items.map((item, itemIdx) => (
                          <div key={item.product_id} className="flex items-center gap-3 py-2">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm text-gray-900 truncate">{item.product_name}</div>
                              <div className="text-xs text-gray-400">На складі: {item.current_stock}</div>
                            </div>
                            <input type="number" min={1} max={item.current_stock} value={item.quantity}
                              onChange={e => updateOrderItem(orderIdx, itemIdx, Number(e.target.value))}
                              className="w-20 px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                            <button onClick={() => removeOrderItem(orderIdx, itemIdx)}
                              className="text-red-400 hover:text-red-600 text-lg leading-none transition-colors">&times;</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              <button onClick={addOrder}
                className="w-full px-4 py-2.5 border-2 border-dashed border-gray-300 rounded-lg text-sm font-medium text-gray-500 hover:border-gray-400 hover:text-gray-600 transition-colors">
                + Додати замовлення
              </button>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
              {error}
            </div>
          )}

          {/* Save */}
          <div className="flex items-center gap-4">
            <button onClick={handleSave} disabled={saving || totalPositions === 0}
              className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                isIn
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-orange-600 text-white hover:bg-orange-700'
              }`}>
              {saving ? 'Збереження...' : `✅ Зберегти накладну (${totalPositions} поз., ${totalItems} шт.)`}
            </button>
          </div>
        </div>

        {/* Desktop picker panel */}
        {pickerOpen != null && (
          <div className="hidden lg:block w-80 shrink-0">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sticky top-4 max-h-[calc(100vh-2rem)]">
              <ProductPicker products={products} excludeIds={excludeIds} onPick={handlePick} onClose={() => setPickerOpen(null)} />
            </div>
          </div>
        )}
      </div>

      {/* Mobile picker overlay */}
      {pickerOpen != null && (
        <div className="lg:hidden fixed inset-0 z-50 bg-white p-4 flex flex-col">
          <ProductPicker products={products} excludeIds={excludeIds} onPick={handlePick} onClose={() => setPickerOpen(null)} />
        </div>
      )}
    </div>
  )
}
