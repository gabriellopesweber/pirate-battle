import { local, readJson, writeJson } from '@/storage/local'

/**
 * Who plays on this browser. The game is single-player with no sign-in, so
 * the identity is created on first use and kept locally; the history and the
 * ranking recognise the player's matches by its id.
 */
export interface Player {
  id: string
  name: string
}

const KEY = 'pirate-battle:player'

const isPlayer = (value: unknown): value is Player =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as Player).id === 'string' &&
  (value as Player).id !== '' &&
  typeof (value as Player).name === 'string'

export function loadPlayer(): Player {
  const stored = readJson(local, KEY, isPlayer)
  if (stored) return stored
  const id = crypto.randomUUID()
  const player = { id, name: `Captain ${id.slice(0, 4).toUpperCase()}` }
  writeJson(local, KEY, player)
  return player
}
