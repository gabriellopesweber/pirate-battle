import { describe, expect, it } from 'vitest'
import { type AudioBackend, createSoundEngine } from '@/audio/soundEngine'

/** A stand-in for the Web Audio API: records what would have played. */
function fakeAudio(failing: string[] = []) {
  const started: { file: string; loop: boolean; source: FakeSource }[] = []
  const buffers = new Map<object, string>()
  const master = { gain: { value: 1 }, connect: () => undefined }

  interface FakeSource {
    buffer: object | null
    loop: boolean
    stopped: boolean
    /** The node it was connected to: its own volume. */
    output: { gain: { value: number } } | null
  }

  const context = {
    destination: {},
    createGain: () => ({ gain: { value: 1 }, connect: () => undefined }),
    createBufferSource: () => {
      const source = {
        buffer: null as object | null,
        loop: false,
        stopped: false,
        output: null as { gain: { value: number } } | null,
        connect: (node: { gain: { value: number } }) => {
          source.output = node
        },
        start: () => {
          started.push({ file: buffers.get(source.buffer ?? {}) ?? '?', loop: source.loop, source })
        },
        stop: () => {
          source.stopped = true
        },
      }
      return source
    },
    decodeAudioData: (data: ArrayBuffer) => {
      const buffer = {}
      buffers.set(buffer, new TextDecoder().decode(data))
      return Promise.resolve(buffer)
    },
  }
  let created = 0
  const backend: AudioBackend = {
    createContext: () => {
      created++
      return context as unknown as AudioContext
    },
    load: (url) =>
      failing.some((name) => url.endsWith(name))
        ? Promise.reject(new Error('404'))
        : Promise.resolve(new TextEncoder().encode(url.split('/').pop() ?? '').buffer),
    createMaster: () => master as unknown as GainNode,
  }
  return { backend, started, master, contextsCreated: () => created }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('createSoundEngine', () => {
  it('stays silent and creates nothing before the first gesture unlocks it', () => {
    const audio = fakeAudio()
    const engine = createSoundEngine({ baseUrl: '/game/sounds/', backend: audio.backend })

    engine.play('cannon')
    engine.setLoop('ocean', 0.3)

    expect(audio.contextsCreated()).toBe(0)
    expect(audio.started).toEqual([])
  })

  it('plays each cue from its file once loaded, taking turns between variants', async () => {
    const audio = fakeAudio()
    const engine = createSoundEngine({ baseUrl: '/game/sounds/', backend: audio.backend })
    engine.unlock()
    await flush()

    engine.play('cannon')
    engine.play('cannon')
    engine.play('broadside')

    expect(audio.started.map((s) => s.file)).toEqual(['cannon_fire_1.wav', 'cannon_fire_2.wav', 'cannon_broadside.wav'])
  })

  it('starts a loop once, follows its volume, and stops it at zero', async () => {
    const audio = fakeAudio()
    const engine = createSoundEngine({ baseUrl: '/game/sounds/', backend: audio.backend })
    engine.unlock()
    await flush()

    engine.setLoop('sailing', 0.2)
    engine.setLoop('sailing', 0.4)

    expect(audio.started).toHaveLength(1)
    const loop = audio.started[0]
    expect(loop).toMatchObject({ file: 'ship_sailing_loop.wav', loop: true })
    expect(loop?.source.output?.gain.value).toBeCloseTo(0.4)

    engine.setLoop('sailing', 0)
    expect(loop?.source.stopped).toBe(true)
  })

  it('mutes through the master volume', async () => {
    const audio = fakeAudio()
    const engine = createSoundEngine({ baseUrl: '/game/sounds/', backend: audio.backend })
    engine.unlock()
    await flush()

    engine.setMuted(true)
    expect(audio.master.gain.value).toBe(0)
    engine.setMuted(false)
    expect(audio.master.gain.value).toBe(1)
  })

  it('keeps going when a file fails to load: that sound is silent, the rest play', async () => {
    const audio = fakeAudio(['cannon_broadside.wav'])
    const engine = createSoundEngine({ baseUrl: '/game/sounds/', backend: audio.backend })
    engine.unlock()
    await flush()

    engine.play('broadside')
    engine.play('splash')

    expect(audio.started.map((s) => s.file)).toEqual(['cannonball_water_hit_1.wav'])
  })
})
