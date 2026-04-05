import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Product, StockMovement, MovementForm } from '../types'
import { canUndo, quantityDisplay, typeColor, typeLabel, validateMovement } from '../utils/movement'
import { fetchPaginated } from '../utils/fetch-paginated'

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [product, setProduct] = useState<Product | null>(null)
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState<'IN' | 'OUT' | 'ADJUST' | null>(null)
  const [activeTab, setActiveTab] = useState<'info' | 'movements' | 'details'>('info')
  const [editingDetails, setEditingDetails] = useState(false)
  const [detailsForm, setDetailsForm] = useState({ description: '', photo_urls: [] as string[], external_url: '' })
  const [form, setForm] = useState<Partial<MovementForm>>({ quantity: 1 })
  const [saving, setSaving] = useState(false)

  async function fetchData() {
    setLoading(true)
    const [{ data: prod }, movs] = await Promise.all([
      supabase.from('products').select('*').eq('id', id).single(),
      fetchPaginated<StockMovement>((from, to) =>
        supabase.from('stock_movements').select('*').eq('product_id', id)
          .order('created_at', { ascending: false }).range(from, to)
      ),
    ])
    if (prod) {
      setProduct(prod)
      setDetailsForm({ description: prod.description ?? '', photo_urls: prod.photo_urls ?? [], external_url: prod.external_url ?? '' })
    }
    setMovements(movs)
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData() }, [id])

  async function handleSaveDetails() {
    const { error } = await supabase.from('products').update(detailsForm).eq('id', id)
    if (!error) { setEditingDetails(false); fetchData() }
    else alert('Помилка: ' + error.message)
  }

  async function handleMovement() {
    if (!showForm || form.quantity == null || !id || !product) return
    if (showForm === 'ADJUST' && !form.note?.trim()) return alert('Вкажіть причину уточнення')
    const validationError = validateMovement(showForm, form.quantity, product.current_stock)
    if (validationError) { alert(validationError); return }
    setSaving(true)
    const { error } = await supabase.from('stock_movements').insert({
      product_id: id,
      type: showForm,
      quantity: form.quantity,
      counterparty: form.counterparty || null,
      invoice_number: form.invoice_number || null,
      note: form.note || null,
    })
    if (!error) {
      setShowForm(null)
      setForm({ quantity: 1 })
      fetchData()
    } else {
      alert('Помилка: ' + error.message)
    }
    setSaving(false)
  }

  async function handleUndoLastMovement() {
    const lastMovement = movements[0]
    if (!lastMovement) return
    if (lastMovement.invoice_id) {
      alert('Цей рух створено через накладну. Скасуйте накладну в Журналі.')
      return
    }
    const today = new Date().toDateString()
    const movementDate = new Date(lastMovement.created_at).toDateString()
    if (today !== movementDate) {
      alert('Можна скасувати тільки операції зроблені сьогодні')
      return
    }
    if (!confirm(`Скасувати останню операцію "${typeLabel(lastMovement.type)}" (${quantityDisplay(lastMovement)})?`)) return
    const { error } = await supabase.from('stock_movements').delete().eq('id', lastMovement.id)
    if (!error) fetchData()
    else alert('Помилка: ' + error.message)
  }

  if (loading) return <p className="text-gray-400 py-8 text-center">Завантаження...</p>
  if (!product) return <p className="text-gray-400 py-8 text-center">Товар не знайдено</p>

  const tabs = [
    { key: 'info' as const, label: '📋 Інфо' },
    { key: 'movements' as const, label: '📊 Рухи' },
    { key: 'details' as const, label: '📝 Деталі' },
  ]

  return (
    <div>
      <button onClick={() => navigate('/')}
        className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block transition-colors">
        ← Назад до списку
      </button>

      {/* Product card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 mb-4">
        <div className="flex justify-between items-start gap-4">
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-gray-900 mb-1">{product.name}</h2>
            {product.notes && <p className="text-sm text-gray-500 mb-1">📝 {product.notes}</p>}
            <p className="text-sm text-gray-600 mb-0.5">🏷 Артикул: {product.articles.join(', ') || '—'}</p>
            <p className="text-sm text-gray-600 mb-0.5">📍 Полиця: {product.shelf_location || '—'}</p>
            {product.boss_quantity != null && (
              <p className="text-sm text-gray-400">БОСС: {product.boss_quantity}</p>
            )}
          </div>
          <div className="text-right shrink-0">
            <div className={`text-4xl font-bold ${product.current_stock === 0 ? 'text-red-600' : 'text-green-700'}`}>
              {product.current_stock}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">залишок (шт)</div>
            <button onClick={() => navigate(`/product/${id}/edit`)}
              className="mt-2 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              ✏️ Редагувати
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-4">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium -mb-px transition-colors ${
              activeTab === tab.key
                ? 'border-b-2 border-gray-900 text-gray-900'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Info tab */}
      {activeTab === 'info' && (
        <>
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => { setShowForm('IN'); setForm({ quantity: 1 }) }}
              className="px-4 py-2 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-800 transition-colors">
              📦 Прийом
            </button>
            <button
              onClick={() => { setShowForm('OUT'); setForm({ quantity: 1 }) }}
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors">
              📤 Видача
            </button>
            <button
              onClick={() => { setShowForm('ADJUST'); setForm({ quantity: product.current_stock }) }}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg text-sm font-medium hover:bg-gray-600 transition-colors">
              ✏️ Уточнити кількість
            </button>
          </div>

          {showForm && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
              <h3 className="text-lg font-semibold mb-3">
                {showForm === 'IN' ? '📦 Прийом товару' : showForm === 'OUT' ? '📤 Видача товару' : '✏️ Ручне уточнення кількості'}
              </h3>
              <div className="grid gap-3">
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">
                    {showForm === 'ADJUST' ? 'Фактична кількість на складі *' : 'Кількість (шт) *'}
                  </span>
                  <input type="number" min={showForm === 'ADJUST' ? 0 : 1} value={form.quantity ?? ''}
                    onChange={e => setForm(f => ({ ...f, quantity: Number(e.target.value) }))}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                  {showForm === 'ADJUST' && (
                    <span className="text-xs text-gray-400 mt-1 block">Введи фактичну кількість на складі зараз</span>
                  )}
                </label>
                {showForm !== 'ADJUST' && (
                  <>
                    <label className="block">
                      <span className="text-sm font-medium text-gray-700">
                        {showForm === 'IN' ? 'Постачальник' : 'Покупець / Кому'}
                      </span>
                      <input type="text" value={form.counterparty ?? ''}
                        onChange={e => setForm(f => ({ ...f, counterparty: e.target.value }))}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                    </label>
                    <label className="block">
                      <span className="text-sm font-medium text-gray-700">Номер накладної (ПН№)</span>
                      <input type="text" value={form.invoice_number ?? ''}
                        onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                    </label>
                  </>
                )}
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">
                    {showForm === 'ADJUST' ? 'Причина уточнення *' : 'Нотатка'}
                  </span>
                  <input type="text" value={form.note ?? ''}
                    onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                    placeholder={showForm === 'ADJUST' ? 'напр. перерахунок після інвентаризації, виявлено пошкоджений товар' : ''}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                </label>
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={handleMovement} disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  {saving ? 'Збереження...' : '✅ Зберегти'}
                </button>
                <button onClick={() => setShowForm(null)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                  Скасувати
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Movements tab */}
      {activeTab === 'movements' && (
        <>
          <h3 className="text-lg font-semibold mb-3">📊 Історія рухів</h3>
          {movements.length === 0 ? (
            <p className="text-gray-400 py-4">Рухів ще немає</p>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Дата</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Тип</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Кількість</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">Контрагент</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Накладна</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Нотатка</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {movements.map((m, index) => (
                    <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{new Date(m.created_at).toLocaleString('uk-UA')}</td>
                      <td className="px-4 py-3 text-sm font-medium whitespace-nowrap" style={{ color: typeColor(m.type) }}>
                        {typeLabel(m.type)}
                      </td>
                      <td className="px-4 py-3 text-sm font-bold">{quantityDisplay(m)}</td>
                      <td className="px-4 py-3 text-sm text-gray-500 hidden sm:table-cell">{m.counterparty || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-500 hidden md:table-cell">{m.invoice_number || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-500 hidden md:table-cell">{m.note || '—'}</td>
                      <td className="px-4 py-3">
                        {index === 0 && canUndo(m) && (
                          m.invoice_id ? (
                            <span className="text-xs text-gray-400 border border-gray-200 rounded px-2 py-0.5"
                              title="Скасуйте накладну в Журналі">
                              🔒 накладна
                            </span>
                          ) : (
                            <button onClick={handleUndoLastMovement}
                              className="text-xs text-red-500 border border-red-300 rounded px-2 py-0.5 hover:bg-red-50 transition-colors"
                              title="Скасувати цю операцію">
                              ↩️ скасувати
                            </button>
                          )
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Details tab */}
      {activeTab === 'details' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">📝 Деталі товару</h3>
            {!editingDetails
              ? <button onClick={() => setEditingDetails(true)}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                  ✏️ Редагувати
                </button>
              : <div className="flex gap-2">
                  <button onClick={handleSaveDetails}
                    className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                    💾 Зберегти
                  </button>
                  <button onClick={() => setEditingDetails(false)}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                    Скасувати
                  </button>
                </div>
            }
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Опис:</label>
              {editingDetails
                ? <textarea
                    value={detailsForm.description ?? ''}
                    onChange={e => setDetailsForm(f => ({ ...f, description: e.target.value }))}
                    rows={4}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Детальний опис товару, особливості, сумісність..."
                  />
                : <p className={`mt-1 text-sm ${product.description ? 'text-gray-700' : 'text-gray-400'}`}>
                    {product.description || 'Опис не заповнено'}
                  </p>
              }
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">Посилання (каталог/магазин):</label>
              {editingDetails
                ? <input
                    type="url"
                    value={detailsForm.external_url ?? ''}
                    onChange={e => setDetailsForm(f => ({ ...f, external_url: e.target.value }))}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="https://..."
                  />
                : product.external_url
                  ? <a href={product.external_url} target="_blank" rel="noreferrer"
                      className="mt-1 block text-sm text-blue-600 hover:text-blue-800 transition-colors">
                      🔗 {product.external_url}
                    </a>
                  : <p className="mt-1 text-sm text-gray-400">Посилання не додано</p>
              }
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">Посилання на фото (кожне з нового рядка):</label>
              {editingDetails
                ? <textarea
                    value={detailsForm.photo_urls?.join('\n') ?? ''}
                    onChange={e => setDetailsForm(f => ({ ...f, photo_urls: e.target.value.split('\n').filter(Boolean) }))}
                    rows={3}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="https://example.com/photo1.jpg"
                  />
                : product.photo_urls.length > 0
                  ? <div className="flex gap-2 flex-wrap mt-2">
                      {product.photo_urls.map((url, i) => (
                        <img key={i} src={url} alt={`фото ${i+1}`}
                          className="w-28 h-28 object-cover rounded-lg border border-gray-200"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />
                      ))}
                    </div>
                  : <p className="mt-1 text-sm text-gray-400">Фото не додано</p>
              }
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
