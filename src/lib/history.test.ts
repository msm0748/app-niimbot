import { describe, expect, it } from 'vitest'
import {
  deleteHistoryItem,
  hasDuplicateText,
  loadHistory,
  saveHistory,
  sortHistory,
  upsertHistory,
} from './history'
import type { PrintHistoryItem } from './types'

describe('print history', () => {
  it('sorts Korean text in ㄱ ㄴ ㄷ order', () => {
    const items = [
      item('다리', '12x22'),
      item('가방', '12x22'),
      item('나무', '12x30'),
    ]

    expect(sortHistory(items).map((i) => i.text)).toEqual(['가방', '나무', '다리'])
  })

  it('updates matching text and size without duplicating', () => {
    const first = upsertHistory([], '가방', '12x22', '2026-01-01T00:00:00.000Z')
    const second = upsertHistory(first, '가방', '12x22', '2026-01-02T00:00:00.000Z')
    expect(second).toHaveLength(1)
    expect(second[0].printedAt).toBe('2026-01-02T00:00:00.000Z')
  })

  it('blocks duplicate text even if size differs', () => {
    expect(hasDuplicateText([item('가방', '12x22')], '가방')).toBe(true)
  })

  it('deletes one item', () => {
    const target = item('가방', '12x22')
    const items = [target, item('나무', '12x30')]
    expect(deleteHistoryItem(items, target).map((i) => i.text)).toEqual(['나무'])
  })

  it('supports clearing all items', () => {
    const storage = new MemoryStorage()
    saveHistory([item('가방', '12x22'), item('나무', '12x30')], storage)
    saveHistory([], storage)
    expect(loadHistory(storage)).toEqual([])
  })
})

function item(text: string, labelSize: PrintHistoryItem['labelSize']): PrintHistoryItem {
  return { text, labelSize, printedAt: '2026-01-01T00:00:00.000Z' }
}

class MemoryStorage implements Storage {
  private values = new Map<string, string>()
  length = 0

  clear(): void {
    this.values.clear()
    this.length = 0
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null
  }

  removeItem(key: string): void {
    this.values.delete(key)
    this.length = this.values.size
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
    this.length = this.values.size
  }
}
