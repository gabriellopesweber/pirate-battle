import { Container, Rectangle, Sprite, type Spritesheet, Texture } from 'pixi.js'

interface BarStyle {
  frame: string
  /** Fill textures by remaining health, from full to critical. */
  fills: readonly [string, ...string[]]
  scale: number
}

// The UI atlas metadata draws each fill as a full-size sprite over the frame,
// clipped along x from the left inside `fill_rect`.
const STYLES = {
  player: { frame: 'health_frame', fills: ['health_fill_green', 'health_fill_amber', 'health_fill_red'], scale: 0.32 },
  enemy: { frame: 'enemy_health_frame', fills: ['enemy_health_fill_green', 'enemy_health_fill_red'], scale: 0.42 },
} satisfies Record<string, BarStyle>

interface FillRect {
  x: number
  y: number
  w: number
  h: number
}

/**
 * A health bar drawn from the UI atlas. The fill texture is re-cut only when
 * health changes — on a hit, not every frame — so a bar costs nothing while
 * nothing happens.
 */
export class HealthBar extends Container {
  private readonly style: BarStyle
  private readonly ui: Spritesheet
  private readonly fill = new Sprite()
  private readonly fillRect: FillRect
  private cropped: Texture | null = null
  private shownRatio = -1

  constructor(ui: Spritesheet, kind: keyof typeof STYLES) {
    super({ label: 'health-bar' })
    this.style = STYLES[kind]
    this.ui = ui
    const frameTexture = ui.textures[this.style.frame] ?? Texture.EMPTY
    const frame = new Sprite(frameTexture)
    this.fillRect = readFillRect(ui, this.style.frame) ?? { x: 0, y: 0, w: frameTexture.width, h: frameTexture.height }
    this.addChild(frame, this.fill)
    this.scale.set(this.style.scale)
    this.pivot.set(frameTexture.width / 2, frameTexture.height)
  }

  setRatio(ratio: number): void {
    const clamped = Math.min(Math.max(ratio, 0), 1)
    if (clamped === this.shownRatio) return
    this.shownRatio = clamped

    const fills = this.style.fills
    const index = Math.min(fills.length - 1, Math.floor((1 - clamped) * fills.length))
    const source = this.ui.textures[fills[index] ?? fills[0]]
    this.cropped?.destroy()
    this.cropped = null
    const width = Math.round(this.fillRect.w * clamped)
    if (!source || width <= 0) {
      this.fill.visible = false
      return
    }
    // Pixi keeps atlas frames in logical units (divided by the atlas
    // resolution), and the UI metadata is logical too, so the same numbers
    // crop the 1× and the 2× atlas.
    const { frame } = source
    this.cropped = new Texture({
      source: source.source,
      frame: new Rectangle(frame.x + this.fillRect.x, frame.y + this.fillRect.y, width, this.fillRect.h),
    })
    this.fill.texture = this.cropped
    this.fill.position.set(this.fillRect.x, this.fillRect.y)
    this.fill.visible = true
  }

  override destroy(): void {
    this.cropped?.destroy()
    this.cropped = null
    super.destroy({ children: true })
  }
}

function readFillRect(ui: Spritesheet, frame: string): FillRect | undefined {
  const data = ui.data.frames[frame] as { ui?: { layout?: { fill_rect?: FillRect } } } | undefined
  return data?.ui?.layout?.fill_rect
}
