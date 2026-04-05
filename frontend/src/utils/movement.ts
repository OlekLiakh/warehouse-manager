import type { StockMovement } from '../types'

export function validateMovement(
  type: 'IN' | 'OUT' | 'MOVE' | 'ADJUST',
  quantity: number,
  currentStock: number
): string | null {
  if (type === 'ADJUST' && quantity === 0) return null
  if (!quantity || quantity <= 0) return 'Кількість має бути більше 0'
  if (type === 'OUT' && quantity > currentStock)
    return `Недостатньо товару. На складі: ${currentStock} шт`
  if (type === 'ADJUST' && quantity < 0)
    return 'Кількість після уточнення не може бути від\'ємним'
  return null
}

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
