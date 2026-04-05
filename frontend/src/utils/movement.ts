import type { StockMovement } from '../types'

export function quantityDisplay(m: StockMovement): string {
  if (m.type === 'ADJUST') return `=${m.quantity}`
  if (m.type === 'OUT') return `−${m.quantity}`
  return `+${m.quantity}`
}

export function typeColor(type: StockMovement['type']): string {
  if (type === 'IN') return '#2d7a2d'
  if (type === 'OUT') return '#c0392b'
  if (type === 'ADJUST') return '#7f8c8d'
  return '#555'
}

export function typeLabel(type: StockMovement['type']): string {
  const labels: Record<string, string> = {
    IN: '📦 Прийом',
    OUT: '📤 Видача',
    MOVE: '🔄 Переміщення',
    ADJUST: '✏️ Уточнення',
  }
  return labels[type] ?? type
}
