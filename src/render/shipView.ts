import { Container, Sprite, type Spritesheet } from 'pixi.js'
import type { Ship } from '@/game/entities/ship'
import { type DamageStage, damageStage, EFFECT, shipFrame, SPRITE_FACING } from '@/render/frames'
import { HealthBar } from '@/render/healthBar'

// Gap between the top of the hull's bounding circle and the health bar.
const BAR_GAP = 18

/**
 * One ship on screen: the hull, which rotates and changes texture as the
 * ship loses health, a fire that appears when it is badly damaged, and a
 * health bar that stays upright above it.
 */
export class ShipView extends Container {
  private readonly ships: Spritesheet
  private readonly hull = new Sprite()
  private readonly fire = new Sprite()
  private readonly bar: HealthBar
  private stage: DamageStage | -1 = -1
  private fireClock = 0

  constructor(ship: Ship, ships: Spritesheet, ui: Spritesheet) {
    super({ label: `ship-${ship.kind}` })
    this.ships = ships
    this.hull.anchor.set(0.5)
    this.fire.anchor.set(0.5, 0.9)
    this.fire.visible = false
    this.bar = new HealthBar(ui, ship.kind === 'player' ? 'player' : 'enemy')
    this.bar.y = -ship.radius - BAR_GAP
    this.addChild(this.hull, this.fire, this.bar)
    this.sync(ship, 0)
  }

  sync(ship: Ship, dt: number): void {
    this.position.set(ship.position.x, ship.position.y)
    this.hull.rotation = ship.heading - SPRITE_FACING

    const stage = damageStage(ship.health, ship.maxHealth)
    if (stage !== this.stage) {
      this.stage = stage
      this.hull.texture = this.ships.textures[shipFrame(ship.kind, stage)] ?? this.hull.texture
      this.fire.visible = stage === 2
    }
    if (this.fire.visible) {
      this.fireClock += dt
      const frame = EFFECT.fire[Math.floor(this.fireClock * 8) % EFFECT.fire.length] ?? EFFECT.fire[0]
      this.fire.texture = this.ships.textures[frame] ?? this.fire.texture
    }
    this.bar.setRatio(ship.health / ship.maxHealth)
  }

  get hullRotation(): number {
    return this.hull.rotation
  }

  override destroy(): void {
    this.bar.destroy()
    super.destroy({ children: true })
  }
}
