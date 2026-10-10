export type EntityId = number

/** Hands out ids that are never reused within a match, across every store. */
export function createIdAllocator(): () => EntityId {
  let next = 1
  return () => next++
}

/**
 * Entities of one kind, keyed by a stable id.
 *
 * Removal is deferred: systems mark entities while iterating and `flush()`
 * applies the removals once per step. A marked entity is already invisible to
 * `get`, `has` and iteration, so a destroyed ship cannot collide, deal damage
 * or fire later in the same step.
 */
export class EntityStore<T extends { readonly id: EntityId }> {
  private readonly items = new Map<EntityId, T>()
  private readonly removed = new Set<EntityId>()
  private readonly nextId: () => EntityId

  constructor(nextId: () => EntityId) {
    this.nextId = nextId
  }

  add(create: (id: EntityId) => T): T {
    const entity = create(this.nextId())
    this.items.set(entity.id, entity)
    return entity
  }

  get(id: EntityId): T | undefined {
    return this.removed.has(id) ? undefined : this.items.get(id)
  }

  has(id: EntityId): boolean {
    return this.items.has(id) && !this.removed.has(id)
  }

  remove(id: EntityId): void {
    if (this.items.has(id)) this.removed.add(id)
  }

  /** Applies pending removals. Returns the removed entities, e.g. to spawn effects. */
  flush(): T[] {
    const gone: T[] = []
    for (const id of this.removed) {
      const entity = this.items.get(id)
      if (entity) gone.push(entity)
      this.items.delete(id)
    }
    this.removed.clear()
    return gone
  }

  clear(): void {
    this.items.clear()
    this.removed.clear()
  }

  get size(): number {
    return this.items.size - this.removed.size
  }

  *[Symbol.iterator](): IterableIterator<T> {
    for (const [id, entity] of this.items) {
      if (!this.removed.has(id)) yield entity
    }
  }
}
