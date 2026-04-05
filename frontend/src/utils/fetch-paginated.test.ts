import { describe, it, expect, vi } from 'vitest'
import { fetchPaginated } from './fetch-paginated'

describe('fetchPaginated', () => {
  it('fetches 1000 + 560 = 1560 rows across two pages', async () => {
    const page1 = Array.from({ length: 1000 }, (_, i) => ({ id: i }))
    const page2 = Array.from({ length: 560 }, (_, i) => ({ id: 1000 + i }))

    const fetcher = vi.fn<(from: number, to: number) => Promise<{ data: { id: number }[] | null; error: null }>>()
      .mockResolvedValueOnce({ data: page1, error: null })
      .mockResolvedValueOnce({ data: page2, error: null })

    const result = await fetchPaginated(fetcher)

    expect(result).toHaveLength(1560)
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(fetcher).toHaveBeenCalledWith(0, 999)
    expect(fetcher).toHaveBeenCalledWith(1000, 1999)
  })

  it('returns all rows when less than page size', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce({ data: [{ id: 1 }, { id: 2 }], error: null })

    const result = await fetchPaginated(fetcher)

    expect(result).toHaveLength(2)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('stops on error', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce({ data: Array.from({ length: 1000 }, (_, i) => ({ id: i })), error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'timeout' } })

    const result = await fetchPaginated(fetcher)

    expect(result).toHaveLength(1000)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('returns empty array when first page is empty', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce({ data: [], error: null })

    const result = await fetchPaginated(fetcher)

    expect(result).toHaveLength(0)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
})
