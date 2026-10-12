import type { Cue } from '@/audio/cues'

/** Each cue's files — several take turns, so repeats do not sound mechanical — and its level in the mix. */
const CUE_SOUNDS: Readonly<Record<Cue, { files: readonly string[]; volume: number }>> = {
  cannon: { files: ['cannon_fire_1.wav', 'cannon_fire_2.wav', 'cannon_fire_3.wav'], volume: 0.6 },
  broadside: { files: ['cannon_broadside.wav'], volume: 0.7 },
  woodHit: { files: ['ship_wood_hit_1.wav', 'ship_wood_hit_2.wav'], volume: 0.7 },
  splash: { files: ['cannonball_water_hit_1.wav', 'cannonball_water_hit_2.wav'], volume: 0.4 },
  explosion: { files: ['ship_explosion_1.wav', 'ship_explosion_2.wav'], volume: 0.8 },
  score: { files: ['score_point.wav'], volume: 0.6 },
  collision: { files: ['ship_collision.wav'], volume: 0.8 },
  start: { files: ['game_start.wav'], volume: 0.6 },
  pause: { files: ['game_pause.wav'], volume: 0.6 },
  resume: { files: ['game_resume.wav'], volume: 0.6 },
  healthLow: { files: ['health_low.wav'], volume: 0.7 },
  timeWarning: { files: ['time_warning.wav'], volume: 0.7 },
  complete: { files: ['game_complete.wav'], volume: 0.7 },
  sinking: { files: ['ship_sinking.wav'], volume: 0.8 },
  gameOver: { files: ['game_over.wav'], volume: 0.7 },
}

export type Loop = 'ocean' | 'sailing'

const LOOP_FILES: Readonly<Record<Loop, string>> = {
  ocean: 'ocean_ambience_loop.wav',
  sailing: 'ship_sailing_loop.wav',
}

/** The edges of the Web Audio API the engine touches — replaced in tests. */
export interface AudioBackend {
  createContext: () => AudioContext
  /** The volume every sound passes through: where muting happens. */
  createMaster: (context: AudioContext) => GainNode
  load: (url: string) => Promise<ArrayBuffer>
}

export const browserAudio: AudioBackend = {
  createContext: () => new AudioContext(),
  createMaster: (context) => {
    const master = context.createGain()
    master.connect(context.destination)
    return master
  },
  load: async (url) => {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`${String(response.status)} ${url}`)
    return response.arrayBuffer()
  },
}

export interface SoundEngine {
  /** Called on the first user gesture: browsers only let audio start from one. */
  unlock: () => void
  play: (cue: Cue) => void
  /** A looping sound at `volume`; 0 stops it. */
  setLoop: (loop: Loop, volume: number) => void
  setMuted: (muted: boolean) => void
}

interface Options {
  baseUrl: string
  backend?: AudioBackend
  muted?: boolean
}

/**
 * Plays the match's sounds with the Web Audio API. Nothing exists until the
 * first gesture unlocks it — before that every call is a no-op, so a browser
 * that blocks autoplay never sees an attempt. The files load in the
 * background after unlocking and never hold up the game; a sound whose file
 * has not arrived, or failed to, is simply not played.
 */
export function createSoundEngine({ baseUrl, backend = browserAudio, muted = false }: Options): SoundEngine {
  let context: AudioContext | null = null
  let master: GainNode | null = null
  let isMuted = muted
  const buffers = new Map<string, AudioBuffer>()
  const turns = new Map<Cue, number>()
  const loops = new Map<Loop, { source: AudioBufferSourceNode; gain: GainNode }>()

  const load = async (ctx: AudioContext, file: string) => {
    try {
      buffers.set(file, await ctx.decodeAudioData(await backend.load(`${baseUrl}${file}`)))
    } catch {
      // A missing sound is silence, never a broken game.
    }
  }

  const start = (file: string, volume: number, loop: boolean) => {
    const buffer = buffers.get(file)
    if (!context || !master || !buffer) return null
    const source = context.createBufferSource()
    const gain = context.createGain()
    source.buffer = buffer
    source.loop = loop
    gain.gain.value = volume
    source.connect(gain)
    gain.connect(master)
    source.start()
    return { source, gain }
  }

  return {
    unlock() {
      if (context) return
      try {
        context = backend.createContext()
        master = backend.createMaster(context)
        master.gain.value = isMuted ? 0 : 1
      } catch {
        context = null
        return
      }
      const files = [...Object.values(CUE_SOUNDS).flatMap((s) => s.files), ...Object.values(LOOP_FILES)]
      for (const file of new Set(files)) void load(context, file)
    },

    play(cue) {
      const { files, volume } = CUE_SOUNDS[cue]
      const turn = turns.get(cue) ?? 0
      const file = files[turn % files.length]
      if (file && start(file, volume, false)) turns.set(cue, turn + 1)
    },

    setLoop(loop, volume) {
      const playing = loops.get(loop)
      if (volume <= 0) {
        playing?.source.stop()
        loops.delete(loop)
        return
      }
      if (playing) {
        playing.gain.gain.value = volume
        return
      }
      const started = start(LOOP_FILES[loop], volume, true)
      if (started) loops.set(loop, started)
    },

    setMuted(next) {
      isMuted = next
      if (master) master.gain.value = next ? 0 : 1
    },
  }
}
