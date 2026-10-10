import { Container, Graphics, Sprite, type Spritesheet, type Texture } from 'pixi.js'
import type { GameEvent } from '@/game/world/events'
import { EFFECT } from '@/render/frames'

interface Effect {
  readonly view: Sprite | Graphics
  readonly duration: number
  age: number
  /** Called every frame with progress in [0, 1]. */
  readonly animate: (progress: number) => void
}

/**
 * Short-lived visual feedback driven by simulation events: muzzle flashes,
 * hits, splashes and explosions.
 *
 * Effects advance with the time they are given, not with Pixi's own ticker,
 * so they freeze while the match is paused like everything else.
 */
export class EffectsLayer extends Container {
  private readonly ships: Spritesheet
  private readonly active: Effect[] = []

  constructor(ships: Spritesheet) {
    super({ label: 'effects' })
    this.ships = ships
  }

  handle(event: GameEvent): void {
    switch (event.type) {
      case 'shot':
        this.flash(event.position.x, event.position.y, event.side === 'player' ? 0.45 : 0.35)
        break
      case 'hit':
        this.flash(event.position.x, event.position.y, 0.5)
        this.debris(event.position.x, event.position.y)
        break
      case 'splash':
        this.ring(event.position.x, event.position.y, event.onLand ? 0xd9b77a : 0xffffff)
        break
      case 'destroyed':
        this.explosion(event.position.x, event.position.y)
        break
    }
  }

  /** Adds a sinking wreck that fades out where a ship was destroyed. */
  wreck(texture: Texture, x: number, y: number, rotation: number): void {
    const sprite = new Sprite({ texture, x, y, rotation, anchor: 0.5 })
    this.addChildAt(sprite, 0)
    this.active.push({
      view: sprite,
      duration: 1.4,
      age: 0,
      animate: (p) => {
        sprite.alpha = 1 - p
        sprite.scale.set(1 - 0.25 * p)
      },
    })
  }

  update(dt: number): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const effect = this.active[i]
      if (!effect) continue
      effect.age += dt
      const progress = Math.min(effect.age / effect.duration, 1)
      effect.animate(progress)
      if (progress >= 1) {
        effect.view.destroy()
        this.active.splice(i, 1)
      }
    }
  }

  get count(): number {
    return this.active.length
  }

  clear(): void {
    for (const effect of this.active) effect.view.destroy()
    this.active.length = 0
  }

  private texture(name: string): Texture | undefined {
    return this.ships.textures[name]
  }

  private flash(x: number, y: number, scale: number): void {
    const texture = this.texture(EFFECT.explosion[2])
    if (!texture) return
    const sprite = new Sprite({ texture, x, y, anchor: 0.5 })
    sprite.scale.set(scale)
    this.addChild(sprite)
    this.active.push({
      view: sprite,
      duration: 0.15,
      age: 0,
      animate: (p) => {
        sprite.alpha = 1 - p
      },
    })
  }

  private explosion(x: number, y: number): void {
    const frames = EFFECT.explosion.map((name) => this.texture(name)).filter((t) => t !== undefined)
    const first = frames[0]
    if (!first) return
    const sprite = new Sprite({ texture: first, x, y, anchor: 0.5 })
    this.addChild(sprite)
    this.active.push({
      view: sprite,
      duration: 0.6,
      age: 0,
      animate: (p) => {
        sprite.texture = frames[Math.min(frames.length - 1, Math.floor(p * frames.length))] ?? first
        sprite.scale.set(0.8 + 0.6 * p)
        sprite.alpha = p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3
      },
    })
  }

  private debris(x: number, y: number): void {
    EFFECT.debris.forEach((name, i) => {
      const texture = this.texture(name)
      if (!texture) return
      const angle = (i / EFFECT.debris.length) * Math.PI * 2 + 0.4
      const sprite = new Sprite({ texture, x, y, anchor: 0.5, rotation: angle })
      this.addChild(sprite)
      this.active.push({
        view: sprite,
        duration: 0.5,
        age: 0,
        animate: (p) => {
          sprite.position.set(x + Math.cos(angle) * 30 * p, y + Math.sin(angle) * 30 * p)
          sprite.alpha = 1 - p
        },
      })
    })
  }

  private ring(x: number, y: number, color: number): void {
    const ring = new Graphics({ x, y })
    this.addChild(ring)
    this.active.push({
      view: ring,
      duration: 0.45,
      age: 0,
      animate: (p) => {
        ring.clear().circle(0, 0, 4 + 14 * p).stroke({ width: 3, color, alpha: 0.9 * (1 - p) })
      },
    })
  }
}
