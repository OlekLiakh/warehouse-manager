const PAGE_SIZE = 1000

export async function fetchPaginated<T>(
  query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  let all: T[] = []
  let from = 0

  while (true) {
    const { data, error } = await query(from, from + PAGE_SIZE - 1)
    if (error || !data || data.length === 0) break
    all = [...all, ...data]
    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return all
}
