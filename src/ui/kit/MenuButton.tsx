import type { ComponentPropsWithRef, CSSProperties } from 'react'
import { useAssets } from '@/ui/assets/AssetsContext'
import { frameImage } from '@/ui/atlas/frameImage'
import './kit.css'

interface MenuButtonProps extends ComponentPropsWithRef<'button'> {
  variant?: 'primary' | 'secondary'
}

/**
 * A menu button drawn from the UI atlas. Each state's frame is a CSS
 * variable, so hover, press and disabled are plain CSS — no re-render.
 */
export function MenuButton({ variant = 'primary', className, style, type = 'button', ...props }: MenuButtonProps) {
  const { ui } = useAssets()
  const url = (state: string) => `url("${frameImage(ui, `button_${variant}_${state}`)}")`
  const states: CSSProperties & Record<`--${string}`, string> = {
    '--frame-normal': url('normal'),
    // The secondary button has no hover or disabled frame in the atlas.
    '--frame-hover': url(variant === 'primary' ? 'hover' : 'normal'),
    '--frame-pressed': url('pressed'),
    '--frame-disabled': url(variant === 'primary' ? 'disabled' : 'normal'),
  }
  return (
    <button
      type={type}
      className={`menu-button menu-button--${variant} ${className ?? ''}`}
      style={{ ...states, ...style }}
      {...props}
    />
  )
}
