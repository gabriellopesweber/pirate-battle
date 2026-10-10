import { describe, expect, it } from 'vitest'
import type { ArenaConfig, ShipStats } from '@/game/config/gameConfig'
import { FixedStepLoop } from '@/game/core/fixedStepLoop'
import { vec, wrapAngle } from '@/game/core/vector'
import { createShip, type ShipControls } from '@/game/entities/ship'
import { moveShip } from '@/game/systems/movement'
import { circleHitsLand, createArena } from '@/game/world/arena'

const DT = 1 / 60

const stats: ShipStats = { maxHealth: 100, maxSpeed: 120, acceleration: 240, turnSpeed: 2, radius: 20 }

// 12 × 8 tiles of 100 units with a single 2 × 2 island at cols 6-7, rows 3-4.
const arenaConfig: ArenaConfig = {
  tileSize: 100,
  cols: 12,
  rows: 8,
  islands: [[{ col: 6, row: 3, cols: 2, rows: 2 }]],
  playerSpawn: { x: 200, y: 200 },
}
const arena = createArena(arenaConfig)

const THRUST: ShipControls = { thrust: true, turn: 0 }
const COAST: ShipControls = { thrust: false, turn: 0 }

function run(seconds: number, update: () => void) {
  for (let i = 0; i < Math.round(seconds / DT); i++) update()
}

describe('moveShip', () => {
  it('accelerates up to max speed and no further', () => {
    const ship = createShip(1, 'player', stats, vec(200, 200), 0)

    run(0.25, () => {
      moveShip(ship, THRUST, stats, arena, DT)
    })
    expect(ship.speed).toBeCloseTo(60, 6)

    run(2, () => {
      moveShip(ship, THRUST, stats, arena, DT)
    })
    expect(ship.speed).toBe(stats.maxSpeed)
  })

  it('coasts to a stop and never moves backwards', () => {
    const ship = createShip(1, 'player', stats, vec(200, 200), 0)
    ship.speed = stats.maxSpeed

    run(2, () => {
      moveShip(ship, COAST, stats, arena, DT)
    })

    expect(ship.speed).toBe(0)
  })

  it('moves along its heading', () => {
    const ship = createShip(1, 'player', stats, vec(200, 600), -Math.PI / 2)
    ship.speed = stats.maxSpeed

    run(1, () => {
      moveShip(ship, { thrust: true, turn: 0 }, stats, arena, DT)
    })

    expect(ship.position.x).toBeCloseTo(200, 6)
    expect(ship.position.y).toBeCloseTo(480, 6)
  })

  it('turns at turnSpeed in both directions, with or without thrust', () => {
    const right = createShip(1, 'player', stats, vec(200, 200), 0)
    const left = createShip(2, 'player', stats, vec(200, 200), 0)

    run(0.5, () => {
      moveShip(right, { thrust: false, turn: 1 }, stats, arena, DT)
      moveShip(left, { thrust: true, turn: -1 }, stats, arena, DT)
    })

    expect(right.heading).toBeCloseTo(1, 6)
    expect(left.heading).toBeCloseTo(-1, 6)
  })

  it('stops at the arena edge instead of leaving it', () => {
    const ship = createShip(1, 'player', stats, vec(200, 200), Math.PI)

    run(5, () => {
      moveShip(ship, THRUST, stats, arena, DT)
    })

    expect(ship.position.x).toBeCloseTo(stats.radius, 6)
    expect(ship.speed).toBeCloseTo(0, 6)
  })

  it('never overlaps an island while ramming it', () => {
    // Heading straight east into the island's west coast at x = 600.
    const ship = createShip(1, 'player', stats, vec(300, 400), 0)

    run(10, () => {
      moveShip(ship, THRUST, stats, arena, DT)
      expect(circleHitsLand(arena, ship.position, ship.radius)).toBe(false)
    })

    expect(ship.position.x).toBeCloseTo(600 - stats.radius, 6)
    expect(ship.speed).toBeCloseTo(0, 6)
  })

  it('slides along a coast when hitting it at an angle', () => {
    // Heading south-east against the west coast: blocked on x, free on y.
    const ship = createShip(1, 'player', stats, vec(560, 320), Math.PI / 4)

    run(1, () => {
      moveShip(ship, THRUST, stats, arena, DT)
      expect(circleHitsLand(arena, ship.position, ship.radius)).toBe(false)
    })

    expect(ship.position.x).toBeCloseTo(600 - stats.radius, 6)
    expect(ship.position.y).toBeGreaterThan(360)
    expect(ship.speed).toBeGreaterThan(0)
  })

  it('reaches the same state at 30 Hz and 144 Hz', () => {
    const simulate = (frameSeconds: number) => {
      const ship = createShip(1, 'player', stats, vec(200, 600), 0)
      const loop = new FixedStepLoop({
        stepSeconds: DT,
        maxStepsPerFrame: 5,
        step: (dt) => {
          moveShip(ship, { thrust: true, turn: 1 }, stats, arena, dt)
        },
      })
      for (let i = 0; i < Math.round(2 / frameSeconds); i++) loop.advance(frameSeconds)
      return ship
    }

    const slow = simulate(1 / 30)
    const fast = simulate(1 / 144)

    expect(fast.position.x).toBeCloseTo(slow.position.x, 6)
    expect(fast.position.y).toBeCloseTo(slow.position.y, 6)
    expect(wrapAngle(fast.heading - slow.heading)).toBeCloseTo(0, 6)
  })
})
