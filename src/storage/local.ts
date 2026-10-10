/**
 * JSON in Web Storage that never throws.
 *
 * Storage can be missing, full or blocked (private mode, disabled site data);
 * the game must keep working then, just without persistence. Reads validate
 * their shape, so an old or hand-edited value falls back instead of crashing.
 */
export function readJson<T>(storage: () => Storage, key: string, isValid: (value: unknown) => value is T): T | null {
  try {
    const raw = storage().getItem(key)
    if (raw === null) return null
    const value: unknown = JSON.parse(raw)
    return isValid(value) ? value : null
  } catch {
    return null
  }
}

export function writeJson(storage: () => Storage, key: string, value: unknown): void {
  try {
    storage().setItem(key, JSON.stringify(value))
  } catch {
    // Persistence is best-effort; the game state in memory stays correct.
  }
}

export function removeKey(storage: () => Storage, key: string): void {
  try {
    storage().removeItem(key)
  } catch {
    // See writeJson.
  }
}

export const local = () => window.localStorage
export const session = () => window.sessionStorage
