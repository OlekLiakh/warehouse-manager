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

const inputClass = 'mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500'

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

  if (loading) return <p className="text-gray-400 py-8 text-center">Завантаження...</p>

  return (
    <div>
      <button onClick={() => navigate(isEdit ? `/product/${id}` : '/')}
        className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block transition-colors">
        ← Назад
      </button>

      <h2 className="text-xl font-bold mb-5">{isEdit ? '✏️ Редагувати товар' : '+ Новий товар'}</h2>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 max-w-lg">
        <div className="grid gap-4">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Назва *</span>
            <input type="text" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="напр. Захист Переднього Підрамника MS/X Plaid"
              className={inputClass} />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">Артикули (через кому)</span>
            <input type="text" value={articlesText}
              onChange={e => setArticlesText(e.target.value)}
              placeholder="напр. 1585229-00-D, 1585229-00-D АНАЛОГ"
              className={inputClass} />
            <span className="text-xs text-gray-400 mt-1 block">Можна вказати кілька через кому</span>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">Полиця</span>
            <input type="text" value={form.shelf_location ?? ''}
              onChange={e => setForm(f => ({ ...f, shelf_location: e.target.value }))}
              placeholder="напр. А-1_2, Т-3_5, С-2_3"
              className={inputClass} />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">Кількість по програмі БОСС</span>
            <input type="number" min={0} value={form.boss_quantity ?? ''}
              onChange={e => setForm(f => ({ ...f, boss_quantity: e.target.value ? Number(e.target.value) : null }))}
              className={inputClass} />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">Нотатки</span>
            <input type="text" value={form.notes ?? ''}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="напр. АНАЛОГ, БУ, УВАГА! 2 ПОЗИЦІЇ"
              className={inputClass} />
          </label>
        </div>

        <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {saving ? 'Збереження...' : isEdit ? '💾 Зберегти' : '✅ Додати товар'}
          </button>
          {isEdit && (
            <button onClick={handleDeactivate}
              className="px-5 py-2 border border-red-300 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors">
              ⛔ Деактивувати
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
