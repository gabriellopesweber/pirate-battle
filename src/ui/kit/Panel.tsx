import type { CSSProperties, ReactNode } from 'react'
import { useAssets } from '@/ui/assets/AssetsContext'
import { frameImage } from '@/ui/atlas/frameImage'
import './kit.css'

interface PanelProps {
  children: ReactNode
  className?: string
}

/**
 * The wood-and-brass menu panel, 9-sliced so it fits any content. The slice
 * (32 left/right, 40 top/bottom) is panel_menu's border metadata, in kit.css.
 */
export function Panel({ children, className }: PanelProps) {
  const { ui } = useAssets()
  const style: CSSProperties = {
    borderImageSource: `url("${frameImage(ui, 'panel_menu')}")`,
  }
  return (
    <div className={`panel ${className ?? ''}`} style={style}>
      {children}
    </div>
  )
}

