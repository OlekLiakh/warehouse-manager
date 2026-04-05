import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Product } from '../types'
import { filterProducts } from '../utils/search'

export default function Products() {
  const navigate = useNavigate()
  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchProducts() }, [showInactive])

  async function fetchProducts() {
    setLoading(true)
    let query = supabase.from('products').select('*').order('name')
    if (!showInactive) query = query.eq('is_active', true)
    const { data, error } = await query
    if (!error && data) setProducts(data)
    setLoading(false)
  }

  const filtered = filterProducts(products, search)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>🏪 Склад</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => navigate('/journal')}>📓 Журнал</button>
          <button onClick={() => navigate('/product/new')}>+ Додати товар</button>
        </div>
      </div>

      <input
        type="text"
        placeholder="Пошук по назві, артикулу, полиці, нотатках..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ width: '100%', padding: 8, marginBottom: 8, boxSizing: 'border-box', fontSize: 15 }}
      />

      <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, fontSize: 13, color: '#666', cursor: 'pointer' }}>
        <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
        Показати неактивні
      </label>

      {loading ? <p>Завантаження...</p> : filtered.length === 0 ? <p>Нічого не знайдено</p> : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f0f0f0' }}>
              <th style={th}>Назва</th>
              <th style={th}>Артикул</th>
              <th style={th}>Полиця</th>
              <th style={th}>Залишок</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr
                key={p.id}
                onClick={() => navigate(`/product/${p.id}`)}
                style={{ cursor: 'pointer', borderBottom: '1px solid #eee' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f9f9f9')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}
              >
                <td style={td}>
                  {p.name}
                  {!p.is_active && <span style={{ color: '#c0392b', fontSize: 12, marginLeft: 6 }}>[неактивний]</span>}
                  {p.notes && <span style={{ color: '#999', fontSize: 12, marginLeft: 6 }}>({p.notes})</span>}
                </td>
                <td style={td}>{p.articles.join(', ') || '—'}</td>
                <td style={td}>{p.shelf_location || '—'}</td>
                <td style={{ ...td, fontWeight: 'bold', color: p.current_stock === 0 ? 'red' : 'inherit' }}>
                  {p.current_stock}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p style={{ color: '#999', fontSize: 13, marginTop: 8 }}>Показано: {filtered.length} з {products.length}</p>
    </div>
  )
}

const th: React.CSSProperties = { textAlign: 'left', padding: '8px 12px', borderBottom: '2px solid #ddd' }
const td: React.CSSProperties = { padding: '8px 12px' }
