import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { ProductForm as ProductFormType } from '../types'

const empty: ProductFormType = {
  name: '',
  articles: [],
  shelf_location: '',
  boss_quantity: null,
  notes: '',
  description: null,
  photo_urls: [],
  external_url: null,
}

export default function ProductForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const [form, setForm] = useState<ProductFormType>(empty)
  const [articlesText, setArticlesText] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(isEdit)

  useEffect(() => { if (isEdit) fetchProduct() }, [id])

  async function fetchProduct() {
    const { data } = await supabase.from('products').select('*').eq('id', id).single()
    if (data) {
      setForm({
        name: data.name,
        articles: data.articles,
        shelf_location: data.shelf_location || '',
        boss_quantity: data.boss_quantity,
        notes: data.notes || '',
        description: data.description ?? null,
        photo_urls: data.photo_urls ?? [],
        external_url: data.external_url ?? null,
      })
      setArticlesText(data.articles.join(', '))
    }
    setLoading(false)
  }

  async function handleSave() {
    if (!form.name.trim()) return alert('Введіть назву товару')
    setSaving(true)
    const articles = articlesText.split(',').map(a => a.trim()).filter(Boolean)
    const payload = { ...form, articles }
    const { error } = isEdit
      ? await supabase.from('products').update(payload).eq('id', id)
      : await supabase.from('products').insert(payload)
    if (!error) navigate(isEdit ? `/product/${id}` : '/')
    else alert('Помилка: ' + error.message)
    setSaving(false)
  }

  async function handleDeactivate() {
    if (!confirm('Деактивувати товар? Він зникне зі списку, але дані збережуться.')) return
    const { error } = await supabase.from('products').update({ is_active: false }).eq('id', id)
    if (!error) navigate('/')
    else alert('Помилка: ' + error.message)
  }

  if (loading) return <p>Завантаження...</p>

  return (
    <div>
      <button onClick={() => navigate(isEdit ? `/product/${id}` : '/')} style={{ marginBottom: 16 }}>← Назад</button>
      <h2>{isEdit ? '✏️ Редагувати товар' : '+ Новий товар'}</h2>
      <div style={{ display: 'grid', gap: 12, maxWidth: 500 }}>
        <label>Назва *
          <input type="text" value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="напр. Захист Переднього Підрамника MS/X Plaid"
            style={inp} />
        </label>
        <label>Артикули (через кому)
          <input type="text" value={articlesText}
            onChange={e => setArticlesText(e.target.value)}
            placeholder="напр. 1585229-00-D, 1585229-00-D АНАЛОГ"
            style={inp} />
          <span style={{ fontSize: 12, color: '#999' }}>Можна вказати кілька через кому</span>
        </label>
        <label>Полиця
          <input type="text" value={form.shelf_location ?? ''}
            onChange={e => setForm(f => ({ ...f, shelf_location: e.target.value }))}
            placeholder="напр. А-1_2, Т-3_5, С-2_3"
            style={inp} />
        </label>
        <label>Кількість по програмі БОСС
          <input type="number" min={0} value={form.boss_quantity ?? ''}
            onChange={e => setForm(f => ({ ...f, boss_quantity: e.target.value ? Number(e.target.value) : null }))}
            style={inp} />
        </label>
        <label>Нотатки
          <input type="text" value={form.notes ?? ''}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="напр. АНАЛОГ, БУ, УВАГА! 2 ПОЗИЦІЇ"
            style={inp} />
        </label>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button onClick={handleSave} disabled={saving}>
            {saving ? 'Збереження...' : isEdit ? '💾 Зберегти' : '✅ Додати товар'}
          </button>
          {isEdit && (
            <button onClick={handleDeactivate} style={{ color: '#c0392b' }}>⛔ Деактивувати</button>
          )}
        </div>
      </div>
    </div>
  )
}

const inp: React.CSSProperties = {
  display: 'block', width: '100%', padding: 8,
  marginTop: 4, boxSizing: 'border-box', fontSize: 14
}
