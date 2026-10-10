import type { PlayerInput } from '@/game/world/state'

export type Action = 'thrust' | 'turnLeft' | 'turnRight' | 'fireFront' | 'fireLeft' | 'fireRight'

const ACTIONS: readonly Action[] = ['thrust', 'turnLeft', 'turnRight', 'fireFront', 'fireLeft', 'fireRight']

/**
 * What the player is holding, from every source at once.
 *
 * Each action counts its holders — a key, a finger on a touch button — so
 * releasing one source does not cancel another still holding the same
 * action. The simulation reads it once per step.
 */
export class InputState {
  private readonly held = new Map<Action, number>(ACTIONS.map((action) => [action, 0]))

  press(action: Action): void {
    this.held.set(action, (this.held.get(action) ?? 0) + 1)
  }

  release(action: Action): void {
    this.held.set(action, Math.max(0, (this.held.get(action) ?? 0) - 1))
  }

  /** Drops everything held — on pause, focus loss and match end, so nothing carries over. */
  reset(): void {
    for (const action of ACTIONS) this.held.set(action, 0)
  }

  isHeld(action: Action): boolean {
    return (this.held.get(action) ?? 0) > 0
  }

  read(): PlayerInput {
    const left = this.isHeld('turnLeft')
    const right = this.isHeld('turnRight')
    return {
      thrust: this.isHeld('thrust'),
      // Both turn directions held cancel out.
      turn: left === right ? 0 : left ? -1 : 1,
      fireFront: this.isHeld('fireFront'),
      fireLeft: this.isHeld('fireLeft'),
      fireRight: this.isHeld('fireRight'),
    }
  }
}
