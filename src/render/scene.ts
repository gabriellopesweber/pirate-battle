import { Container, Sprite, type Spritesheet, Texture } from 'pixi.js'
import type { EntityId } from '@/game/core/entityStore'
import type { Ship } from '@/game/entities/ship'
import type { GameEvent } from '@/game/world/events'
import type { World } from '@/game/world/state'
import type { GameAssets } from '@/render/assets'
import { createArenaView } from '@/render/arenaView'
import { EffectsLayer } from '@/render/effects'
import { EFFECT, shipFrame } from '@/render/frames'
import { ShipView } from '@/render/shipView'

/**
 * Everything drawn for one match, in world units.
 *
 * The scene never decides anything: each frame it maps the world's entities
 * to views — creating a view for a new entity, updating existing ones and
 * destroying views whose entity is gone — and turns events into effects.
 */
export class Scene extends Container {
  private readonly ships: Spritesheet
  private readonly ui: Spritesheet
  private readonly shipLayer = new Container({ label: 'ships' })
  private readonly projectileLayer = new Container({ label: 'projectiles' })
  private readonly effectsLayer: EffectsLayer
  private readonly shipViews = new Map<EntityId, ShipView>()
  private readonly projectileViews = new Map<EntityId, Sprite>()
  private readonly cannonball: Texture

  constructor(world: World, assets: GameAssets) {
    super({ label: 'scene' })
    this.ships = assets.ships
    this.ui = assets.ui
    this.cannonball = assets.ships.textures[EFFECT.cannonball] ?? Texture.WHITE
    this.effectsLayer = new EffectsLayer(assets.ships)
    this.addChild(createArenaView(world.arena, assets.tiles), this.shipLayer, this.projectileLayer, this.effectsLayer)
    this.sync(world, 0)
  }

  /** Feeds one simulation step's events to the effects. */
  handleEvents(events: readonly GameEvent[]): void {
    for (const event of events) {
      this.effectsLayer.handle(event)
      // An enemy's view disappears with it, so it leaves a fading wreck. The
      // player stays in the world and its own view already shows the wreck.
      if (event.type === 'destroyed' && event.kind !== 'player') {
        const view = this.shipViews.get(event.shipId)
        const texture = this.ships.textures[shipFrame(event.kind, 3)]
        if (view && texture) this.effectsLayer.wreck(texture, event.position.x, event.position.y, view.hullRotation)
      }
    }
  }

  /** Brings every view in line with the world. `dt` advances animations; 0 freezes them. */
  sync(world: World, dt: number): void {
    const ships: Ship[] = [world.player, ...world.enemies]
    this.syncShips(ships, dt)
    this.syncProjectiles(world)
    this.effectsLayer.update(dt)
  }

  /** Live views, for leak checks: ships, projectiles and effects. */
  get viewCounts(): { ships: number; projectiles: number; effects: number } {
    return { ships: this.shipViews.size, projectiles: this.projectileViews.size, effects: this.effectsLayer.count }
  }

  override destroy(): void {
    for (const view of this.shipViews.values()) view.destroy()
    this.shipViews.clear()
    this.projectileViews.clear()
    this.effectsLayer.clear()
    super.destroy({ children: true })
  }

  private syncShips(ships: readonly Ship[], dt: number): void {
    const alive = new Set<EntityId>()
    for (const ship of ships) {
      alive.add(ship.id)
      let view = this.shipViews.get(ship.id)
      if (!view) {
        view = new ShipView(ship, this.ships, this.ui)
        this.shipViews.set(ship.id, view)
        this.shipLayer.addChild(view)
      }
      view.sync(ship, dt)
    }
    for (const [id, view] of this.shipViews) {
      if (alive.has(id)) continue
      view.destroy()
      this.shipViews.delete(id)
    }
  }

  private syncProjectiles(world: World): void {
    const alive = new Set<EntityId>()
    for (const projectile of world.projectiles) {
      alive.add(projectile.id)
      let sprite = this.projectileViews.get(projectile.id)
      if (!sprite) {
        sprite = new Sprite({ texture: this.cannonball, anchor: 0.5 })
        sprite.setSize(projectile.radius * 2, projectile.radius * 2)
        this.projectileViews.set(projectile.id, sprite)
        this.projectileLayer.addChild(sprite)
      }
      sprite.position.set(projectile.position.x, projectile.position.y)
    }
    for (const [id, sprite] of this.projectileViews) {
      if (alive.has(id)) continue
      sprite.destroy()
      this.projectileViews.delete(id)
    }
  }
}
