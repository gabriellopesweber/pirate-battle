import type { ButtonHTMLAttributes, CSSProperties } from 'react'
import { useAssets } from '@/ui/assets/AssetsContext'
import { AtlasSprite } from '@/ui/atlas/AtlasSprite'
import { frameImage } from '@/ui/atlas/frameImage'
import './kit.css'

interface RoundButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** An icon frame of the UI atlas… */
  icon?: string
  /** …or an image of its own, for icons the atlas does not have. */
  image?: string
  /** Accessible name: the button shows only an icon. */
  label: string
  size?: number
}

/** The round atlas button with an icon, laid out as the atlas metadata says (icon at half size, centred). */
export function RoundButton({
  icon,
  image,
  label,
  size = 48,
  className,
  style,
  type = 'button',
  ...props
}: RoundButtonProps) {
  const { ui } = useAssets()
  const states: CSSProperties & Record<`--${string}`, string> = {
    '--frame-normal': `url("${frameImage(ui, 'button_round_normal')}")`,
    '--frame-hover': `url("${frameImage(ui, 'button_round_hover')}")`,
    '--frame-pressed': `url("${frameImage(ui, 'button_round_pressed')}")`,
    width: `${String(size)}px`,
    height: `${String(size)}px`,
  }
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={`round-button ${className ?? ''}`}
      style={{ ...states, ...style }}
      {...props}
    >
      {image ? (
        <img src={image} alt="" width={size / 2} height={size / 2} draggable={false} />
      ) : (
        icon && <AtlasSprite sheet={ui} frame={icon} width={size / 2} />
      )}
    </button>
  )
}
