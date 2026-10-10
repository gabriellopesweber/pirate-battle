import { AssetGate } from '@/ui/assets/AssetGate'

export function App() {
  return (
    <main className="app">
      <h1>Pirate Battle</h1>
      {/* Temporary: the gate moves in front of the game screen with the screen flow (#11). */}
      <AssetGate>{() => <p role="status">Assets loaded.</p>}</AssetGate>
    </main>
  )
}
