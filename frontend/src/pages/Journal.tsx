import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { StockMovement } from '../types'
import { quantityDisplay, typeColor, typeLabel } from '../utils/movement'
import { groupByInvoice } from '../utils/journal'
import { fetchPaginated } from '../utils/fetch-paginated'

interface MovementWithProduct extends StockMovement {
  products: { name: string; articles: string[] } | null
}

function todayString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function Journal() {
  const navigate = useNavigate()
  const [date, setDate] = useState(todayString())
  const [movements, setMovements] = useState<MovementWithProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'IN' | 'OUT'>('ALL')
  const [groupedView, setGroupedView] = useState(false)

  useEffect(() => { fetchMovements() }, [date])

  async function fetchMovements() {
    setLoading(true)
    const start = new Date(`${date}T00:00:00`)
    const end = new Date(`${date}T23:59:59.999`)

    const all = await fetchPaginated<MovementWithProduct>((from, to) =>
      supabase
        .from('stock_movements')
        .select('*, products(name, articles)')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .order('created_at', { ascending: false })
        .range(from, to)
    )

    setMovements(all)
    setLoading(false)
  }

  const filtered = movements.filter(m => typeFilter === 'ALL' || m.type === typeFilter)
  const groups = groupByInvoice(filtered)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>📓 Журнал рухів</h1>
        <button onClick={() => navigate('/')}>← Склад</button>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          📅 Дата:
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            style={{ padding: 6, fontSize: 15 }} />
        </label>

        <div style={{ display: 'flex', gap: 4 }}>
          {(['ALL', 'IN', 'OUT'] as const).map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              style={{
                padding: '6px 12px',
                border: '1px solid #ccc',
                borderRadius: 4,
                background: typeFilter === t ? '#333' : '#fff',
                color: typeFilter === t ? '#fff' : '#333',
                cursor: 'pointer',
              }}>
              {t === 'ALL' ? 'Всі' : t === 'IN' ? '📦 Прийом' : '📤 Видача'}
            </button>
          ))}
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input type="checkbox" checked={groupedView} onChange={e => setGroupedView(e.target.checked)} />
          По замовленнях
        </label>
      </div>

      {loading ? <p>Завантаження...</p> : filtered.length === 0 ? (
        <p style={{ color: '#999' }}>Рухів за {date} не знайдено</p>
      ) : groupedView ? (
        <div>
          {groups.map((g, i) => (
            <div key={i} style={{ background: '#f9f9f9', padding: 12, borderRadius: 8, marginBottom: 12, border: '1px solid #eee' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <strong>
                  {g.counterparty || 'Без контрагента'}
                  {g.invoice_number && <span style={{ color: '#666', marginLeft: 8 }}>ПН№ {g.invoice_number}</span>}
                </strong>
                <span style={{ color: '#999', fontSize: 13 }}>{g.movements.length} поз.</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {g.movements.map(m => (
                    <tr key={m.id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={td}>
                        <span style={{ cursor: 'pointer', color: '#2980b9', textDecoration: 'underline' }}
                          onClick={() => navigate(`/product/${m.product_id}`)}>
                          {m.products?.name ?? m.product_id}
                        </span>
                      </td>
                      <td style={{ ...td, color: typeColor(m.type), whiteSpace: 'nowrap' }}>{typeLabel(m.type)}</td>
                      <td style={{ ...td, fontWeight: 'bold', whiteSpace: 'nowrap' }}>{quantityDisplay(m)}</td>
                      <td style={{ ...td, color: '#999', fontSize: 13 }}>{m.note || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f0f0f0' }}>
              <th style={th}>Час</th>
              <th style={th}>Тип</th>
              <th style={th}>Товар</th>
              <th style={th}>Кількість</th>
              <th style={th}>Контрагент</th>
              <th style={th}>Накладна</th>
              <th style={th}>Нотатка</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(m => (
              <tr key={m.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ ...td, whiteSpace: 'nowrap' }}>
                  {new Date(m.created_at).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}
                </td>
                <td style={{ ...td, color: typeColor(m.type), whiteSpace: 'nowrap' }}>{typeLabel(m.type)}</td>
                <td style={td}>
                  <span style={{ cursor: 'pointer', color: '#2980b9', textDecoration: 'underline' }}
                    onClick={() => navigate(`/product/${m.product_id}`)}>
                    {m.products?.name ?? m.product_id}
                  </span>
                </td>
                <td style={{ ...td, fontWeight: 'bold' }}>{quantityDisplay(m)}</td>
                <td style={td}>{m.counterparty || '—'}</td>
                <td style={td}>{m.invoice_number || '—'}</td>
                <td style={td}>{m.note || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p style={{ color: '#999', fontSize: 13, marginTop: 8 }}>
        Показано: {filtered.length} рухів за {date}
      </p>
    </div>
  )
}

const th: React.CSSProperties = { textAlign: 'left', padding: '8px 12px', borderBottom: '2px solid #ddd' }
const td: React.CSSProperties = { padding: '8px 12px' }
