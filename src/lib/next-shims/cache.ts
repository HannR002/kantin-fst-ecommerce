export function revalidatePath(_path: string, _type?: 'layout' | 'page'): void {
  // In Next.js, this invalidates the server component data cache.
  // In client / Vite environment, this is a no-op.
}

export function revalidateTag(_tag: string): void {
  // In Next.js, this invalidates cache tags.
}
