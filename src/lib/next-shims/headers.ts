export interface ReadonlyRequestCookies {
  get(name: string): { name: string; value: string } | undefined
  getAll(): { name: string; value: string }[]
  has(name: string): boolean
  set(name: string, value: string, options?: unknown): void
  delete(name: string): void
}

class MemoryCookies implements ReadonlyRequestCookies {
  private store: Map<string, string> = new Map()

  get(name: string) {
    const val = this.store.get(name)
    return val !== undefined ? { name, value: val } : undefined
  }

  getAll() {
    return Array.from(this.store.entries()).map(([name, value]) => ({ name, value }))
  }

  has(name: string) {
    return this.store.has(name)
  }

  set(name: string, value: string) {
    this.store.set(name, value)
  }

  delete(name: string) {
    this.store.delete(name)
  }
}

const globalCookies = new MemoryCookies()

export function cookies(): ReadonlyRequestCookies {
  return globalCookies
}
