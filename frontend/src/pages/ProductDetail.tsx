import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Product, StockMovement, MovementForm } from '../types'
import { quantityDisplay, typeColor, typeLabel } from '../utils/movement'

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

  useEffect(() => { fetchData() }, [id])

  async function fetchData() {
    setLoading(true)
    const [{ data: prod }, { data: movs }] = await Promise.all([
      supabase.from('products').select('*').eq('id', id).single(),
      supabase.from('stock_movements').select('*').eq('product_id', id).order('created_at', { ascending: false }),
    ])
    if (prod) {
      setProduct(prod)
      setDetailsForm({ description: prod.description ?? '', photo_urls: prod.photo_urls ?? [], external_url: prod.external_url ?? '' })
    }
    if (movs) setMovements(movs)
    setLoading(false)
  }

  async function handleSaveDetails() {
    const { error } = await supabase.from('products').update(detailsForm).eq('id', id)
    if (!error) { setEditingDetails(false); fetchData() }
    else alert('Помилка: ' + error.message)
  }

  async function handleMovement() {
    if (!showForm || form.quantity == null || !id) return
    if (showForm === 'ADJUST' && !form.note?.trim()) return alert('Вкажіть причину уточнення')
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

  if (loading) return <p>Завантаження...</p>
  if (!product) return <p>Товар не знайдено</p>


  return (
    <div>
      <button onClick={() => navigate('/')} style={{ marginBottom: 16 }}>← Назад</button>

      <div style={{ background: '#f9f9f9', padding: 16, borderRadius: 8, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ margin: '0 0 8px' }}>{product.name}</h2>
            {product.notes && <p style={{ margin: '0 0 4px', color: '#666' }}>📝 {product.notes}</p>}
            <p style={{ margin: '0 0 4px' }}>🏷 Артикул: {product.articles.join(', ') || '—'}</p>
            <p style={{ margin: '0 0 4px' }}>📍 Полиця: {product.shelf_location || '—'}</p>
            {product.boss_quantity != null && (
              <p style={{ margin: '0 0 4px', color: '#999' }}>БОСС: {product.boss_quantity}</p>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 36, fontWeight: 'bold', color: product.current_stock === 0 ? 'red' : '#2d7a2d' }}>
              {product.current_stock}
            </div>
            <div style={{ color: '#999', fontSize: 13 }}>залишок (шт)</div>
            <button onClick={() => navigate(`/product/${id}/edit`)} style={{ marginTop: 8 }}>✏️ Редагувати</button>
          </div>
        </div>
      </div>

      {/* Вкладки */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '2px solid #eee' }}>
        {(['info', 'movements', 'details'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 16px',
              border: 'none',
              background: activeTab === tab ? '#fff' : 'transparent',
              borderBottom: activeTab === tab ? '2px solid #333' : '2px solid transparent',
              cursor: 'pointer',
              fontWeight: activeTab === tab ? 'bold' : 'normal',
              marginBottom: -2
            }}
          >
            {tab === 'info' ? '📋 Інфо' : tab === 'movements' ? '📊 Рухи' : '📝 Деталі'}
          </button>
        ))}
      </div>

      {/* Вкладка Інфо */}
      {activeTab === 'info' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button
              onClick={() => { setShowForm('IN'); setForm({ quantity: 1 }) }}
              style={{ background: '#2d7a2d', color: 'white', padding: '8px 16px', border: 'none', borderRadius: 4, cursor: 'pointer' }}
            >📦 Прийом</button>
            <button
              onClick={() => { setShowForm('OUT'); setForm({ quantity: 1 }) }}
              style={{ background: '#c0392b', color: 'white', padding: '8px 16px', border: 'none', borderRadius: 4, cursor: 'pointer' }}
            >📤 Видача</button>
            <button
              onClick={() => { setShowForm('ADJUST'); setForm({ quantity: product.current_stock }) }}
              style={{ background: '#7f8c8d', color: 'white', padding: '8px 16px', border: 'none', borderRadius: 4, cursor: 'pointer' }}
            >✏️ Уточнити кількість</button>
          </div>

          {showForm && (
            <div style={{ background: '#fff3cd', padding: 16, borderRadius: 8, marginBottom: 16, border: '1px solid #ffc107' }}>
              <h3 style={{ margin: '0 0 12px' }}>
                {showForm === 'IN' ? '📦 Прийом товару' : showForm === 'OUT' ? '📤 Видача товару' : '✏️ Ручне уточнення кількості'}
              </h3>
              <div style={{ display: 'grid', gap: 8 }}>
                <label>{showForm === 'ADJUST' ? 'Фактична кількість на складі *' : 'Кількість (шт) *'}
                  <input type="number" min={showForm === 'ADJUST' ? 0 : 1} value={form.quantity ?? ''}
                    onChange={e => setForm(f => ({ ...f, quantity: Number(e.target.value) }))}
                    style={{ display: 'block', width: '100%', padding: 6, marginTop: 4, boxSizing: 'border-box' }} />
                  {showForm === 'ADJUST' && (
                    <span style={{ fontSize: 12, color: '#999' }}>Введи фактичну кількість на складі зараз</span>
                  )}
                </label>
                {showForm !== 'ADJUST' && (
                  <>
                    <label>{showForm === 'IN' ? 'Постачальник' : 'Покупець / Кому'}
                      <input type="text" value={form.counterparty ?? ''}
                        onChange={e => setForm(f => ({ ...f, counterparty: e.target.value }))}
                        style={{ display: 'block', width: '100%', padding: 6, marginTop: 4, boxSizing: 'border-box' }} />
                    </label>
                    <label>Номер накладної (ПН№)
                      <input type="text" value={form.invoice_number ?? ''}
                        onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))}
                        style={{ display: 'block', width: '100%', padding: 6, marginTop: 4, boxSizing: 'border-box' }} />
                    </label>
                  </>
                )}
                <label>{showForm === 'ADJUST' ? 'Причина уточнення *' : 'Нотатка'}
                  <input type="text" value={form.note ?? ''}
                    onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                    placeholder={showForm === 'ADJUST' ? 'напр. перерахунок після інвентаризації, виявлено пошкоджений товар' : ''}
                    style={{ display: 'block', width: '100%', padding: 6, marginTop: 4, boxSizing: 'border-box' }} />
                </label>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button onClick={handleMovement} disabled={saving}>
                  {saving ? 'Збереження...' : '✅ Зберегти'}
                </button>
                <button onClick={() => setShowForm(null)}>Скасувати</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Вкладка Рухи */}
      {activeTab === 'movements' && (
        <>
          <h3>📊 Історія рухів</h3>
          {movements.length === 0 ? <p style={{ color: '#999' }}>Рухів ще немає</p> : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f0f0f0' }}>
                  <th style={th}>Дата</th>
                  <th style={th}>Тип</th>
                  <th style={th}>Кількість</th>
                  <th style={th}>Контрагент</th>
                  <th style={th}>Накладна</th>
                  <th style={th}>Нотатка</th>
                </tr>
              </thead>
              <tbody>
                {movements.map(m => (
                  <tr key={m.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={td}>{new Date(m.created_at).toLocaleString('uk-UA')}</td>
                    <td style={{ ...td, color: typeColor(m.type) }}>
                      {typeLabel(m.type)}
                    </td>
                    <td style={{ ...td, fontWeight: 'bold' }}>
                      {quantityDisplay(m)}
                    </td>
                    <td style={td}>{m.counterparty || '—'}</td>
                    <td style={td}>{m.invoice_number || '—'}</td>
                    <td style={td}>{m.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {/* Вкладка Деталі */}
      {activeTab === 'details' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ margin: 0 }}>📝 Деталі товару</h3>
            {!editingDetails
              ? <button onClick={() => setEditingDetails(true)}>✏️ Редагувати</button>
              : <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={handleSaveDetails}>💾 Зберегти</button>
                  <button onClick={() => setEditingDetails(false)}>Скасувати</button>
                </div>
            }
          </div>

          <label style={{ display: 'block', marginBottom: 12 }}>
            <strong>Опис:</strong>
            {editingDetails
              ? <textarea
                  value={detailsForm.description ?? ''}
                  onChange={e => setDetailsForm(f => ({ ...f, description: e.target.value }))}
                  rows={4}
                  style={{ display: 'block', width: '100%', marginTop: 4, padding: 8, boxSizing: 'border-box' }}
                  placeholder="Детальний опис товару, особливості, сумісність..."
                />
              : <p style={{ marginTop: 4, color: product.description ? 'inherit' : '#999' }}>
                  {product.description || 'Опис не заповнено'}
                </p>
            }
          </label>

          <label style={{ display: 'block', marginBottom: 12 }}>
            <strong>Посилання (каталог/магазин):</strong>
            {editingDetails
              ? <input
                  type="url"
                  value={detailsForm.external_url ?? ''}
                  onChange={e => setDetailsForm(f => ({ ...f, external_url: e.target.value }))}
                  style={{ display: 'block', width: '100%', marginTop: 4, padding: 8, boxSizing: 'border-box' }}
                  placeholder="https://..."
                />
              : product.external_url
                ? <a href={product.external_url} target="_blank" rel="noreferrer" style={{ display: 'block', marginTop: 4 }}>
                    🔗 {product.external_url}
                  </a>
                : <p style={{ marginTop: 4, color: '#999' }}>Посилання не додано</p>
            }
          </label>

          <label style={{ display: 'block', marginBottom: 12 }}>
            <strong>Посилання на фото (кожне з нового рядка):</strong>
            {editingDetails
              ? <textarea
                  value={detailsForm.photo_urls?.join('\n') ?? ''}
                  onChange={e => setDetailsForm(f => ({ ...f, photo_urls: e.target.value.split('\n').filter(Boolean) }))}
                  rows={3}
                  style={{ display: 'block', width: '100%', marginTop: 4, padding: 8, boxSizing: 'border-box' }}
                  placeholder="https://example.com/photo1.jpg"
                />
              : product.photo_urls.length > 0
                ? <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                    {product.photo_urls.map((url, i) => (
                      <img key={i} src={url} alt={`фото ${i+1}`}
                        style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 4, border: '1px solid #ddd' }}
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                    ))}
                  </div>
                : <p style={{ marginTop: 4, color: '#999' }}>Фото не додано</p>
            }
          </label>
        </div>
      )}
    </div>
  )
}

const th: React.CSSProperties = { textAlign: 'left', padding: '8px 12px', borderBottom: '2px solid #ddd' }
const td: React.CSSProperties = { padding: '8px 12px' }
