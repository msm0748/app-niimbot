import { type LabelSize, type PrintHistoryItem } from './types'

export const HISTORY_STORAGE_KEY = 'niimbot-d11-history'

export function loadHistory(storage: Storage = localStorage): PrintHistoryItem[] {
  try {
    const raw = storage.getItem(HISTORY_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as PrintHistoryItem[]
    return sortHistory(parsed.filter(isHistoryItem))
  } catch {
    return []
  }
}

export function saveHistory(items: PrintHistoryItem[], storage: Storage = localStorage) {
  storage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(sortHistory(items)))
}

export function upsertHistory(
  items: PrintHistoryItem[],
  text: string,
  labelSize: LabelSize,
  printedAt = new Date().toISOString(),
) {
  const existing = items.find((item) => item.text === text && item.labelSize === labelSize)
  const next = existing
    ? items.map((item) =>
        item.text === text && item.labelSize === labelSize ? { ...item, printedAt } : item,
      )
    : [...items, { text, labelSize, printedAt }]

  return sortHistory(next)
}

export function hasDuplicateText(items: PrintHistoryItem[], text: string) {
  const normalized = text.trim()
  return items.some((item) => item.text === normalized)
}

export function deleteHistoryItem(items: PrintHistoryItem[], target: PrintHistoryItem) {
  return items.filter(
    (item) =>
      !(item.text === target.text && item.labelSize === target.labelSize && item.printedAt === target.printedAt),
  )
}

export function sortHistory(items: PrintHistoryItem[]) {
  return [...items].sort((a, b) =>
    a.text.localeCompare(b.text, 'ko-KR', {
      sensitivity: 'base',
      numeric: true,
    }),
  )
}

function isHistoryItem(value: PrintHistoryItem) {
  return (
    typeof value?.text === 'string' &&
    (value.labelSize === '12x22' || value.labelSize === '12x30') &&
    typeof value.printedAt === 'string'
  )
}
