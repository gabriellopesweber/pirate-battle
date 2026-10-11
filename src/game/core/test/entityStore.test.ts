import { describe, expect, it } from 'vitest'
import { createIdAllocator, EntityStore, type EntityId } from '@/game/core/entityStore'

interface Ship {
  readonly id: EntityId
  health: number
}

const createShip = (id: EntityId): Ship => ({ id, health: 100 })

describe('EntityStore', () => {
  it('gives unique ids across stores sharing an allocator', () => {
    const nextId = createIdAllocator()
    const ships = new EntityStore<Ship>(nextId)
    const enemies = new EntityStore<Ship>(nextId)

    const a = ships.add(createShip)
    const b = enemies.add(createShip)

    expect(a.id).not.toBe(b.id)
  })

  it('hides a removed entity immediately and deletes it on flush', () => {
    const store = new EntityStore<Ship>(createIdAllocator())
    const ship = store.add(createShip)
    store.add(createShip)

    store.remove(ship.id)

    expect(store.has(ship.id)).toBe(false)
    expect(store.get(ship.id)).toBeUndefined()
    expect([...store].map((s) => s.id)).not.toContain(ship.id)
    expect(store.size).toBe(1)
    expect(store.flush()).toEqual([ship])
    expect(store.size).toBe(1)
  })

  it('allows removing while iterating', () => {
    const store = new EntityStore<Ship>(createIdAllocator())
    for (let i = 0; i < 5; i++) store.add(createShip)

    for (const ship of store) store.remove(ship.id)

    expect(store.size).toBe(0)
    expect(store.flush()).toHaveLength(5)
  })

  it('ignores removing an unknown id', () => {
    const store = new EntityStore<Ship>(createIdAllocator())
    store.add(createShip)

    store.remove(999)

    expect(store.size).toBe(1)
    expect(store.flush()).toEqual([])
  })
})
