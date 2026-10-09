declare module 'next/headers' {
  export interface ReadonlyRequestCookies {
    get(name: string): { name: string; value: string } | undefined;
    getAll(): { name: string; value: string }[];
    has(name: string): boolean;
    set(name: string, value: string, options?: unknown): void;
    delete(name: string): void;
  }
  export function cookies(): ReadonlyRequestCookies;
}

declare module 'next/cache' {
  export function revalidatePath(path: string, type?: 'layout' | 'page'): void;
  export function revalidateTag(tag: string): void;
}
