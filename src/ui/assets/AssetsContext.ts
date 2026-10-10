import { createContext, useContext } from 'react'
import type { GameAssets } from '@/render/assets'

export const AssetsContext = createContext<GameAssets | null>(null)

/** The loaded atlases. Only usable below the asset gate, which provides them. */
export function useAssets(): GameAssets {
  const assets = useContext(AssetsContext)
  if (!assets) throw new Error('useAssets() used before the assets loaded')
  return assets
}
