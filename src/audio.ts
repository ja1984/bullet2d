// ─── Audio System ────────────────────────────────────────────────────────────

let audioCtx: AudioContext | null = null
let bulletTimeActive = false

export function setAudioBulletTime(active: boolean) {
  bulletTimeActive = active
}

// Pause/resume all audio when tab visibility changes
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    audioCtx?.suspend()
    bgMusic.pause()
    ambientSiren.pause()
  } else {
    audioCtx?.resume()
    if (ambientActive) {
      bgMusic.play().catch(() => {})
    }
  }
})

export function updateMusicIntensity(enemiesAlive: number) {
  bgMusic.volume = enemiesAlive === 1 ? 0.2 : 0.08
}

// Preloaded MP3 sounds
const soundCache: Record<string, HTMLAudioElement> = {}

function preloadSound(name: string, path: string) {
  const audio = new Audio(path)
  audio.preload = 'auto'
  soundCache[name] = audio
}

export function playSound(name: string, volume = 1) {
  const cached = soundCache[name]
  if (!cached) return
  const sound = cached.cloneNode() as HTMLAudioElement
  sound.volume = volume * (bulletTimeActive ? 0.3 : 1)
  sound.play().catch(() => {})
}

preloadSound('empty', 'sounds/weapons/empty.mp3')
preloadSound('pistol', 'sounds/weapons/pistol.mp3')
preloadSound('m16', 'sounds/weapons/m16.mp3')
preloadSound('sniper', 'sounds/weapons/sniper.mp3')
preloadSound('shotgun', 'sounds/weapons/shotgun.mp3')
preloadSound('hit', 'sounds/weapons/hit.mp3')
preloadSound('headshot', 'sounds/fx/headshot.mp3')
preloadSound('pickup', 'sounds/fx/pickup.mp3')
preloadSound('grunt_death', 'sounds/enemies/grunt.mp3')
preloadSound('thug_death', 'sounds/enemies/thug.mp3')
preloadSound('reload', 'sounds/weapons/reload.mp3')

// Bullet time sound — preload as AudioBuffer for reverse playback
let slowdownBuffer: AudioBuffer | null = null
let slowdownReversedBuffer: AudioBuffer | null = null

fetch('sounds/fx/slowdown.mp3')
  .then(r => r.arrayBuffer())
  .then(buf => {
    const ctx = getAudio()
    return ctx.decodeAudioData(buf)
  })
  .then(decoded => {
    slowdownBuffer = decoded
    // Create reversed copy
    const ctx = getAudio()
    slowdownReversedBuffer = ctx.createBuffer(decoded.numberOfChannels, decoded.length, decoded.sampleRate)
    for (let ch = 0; ch < decoded.numberOfChannels; ch++) {
      const src = decoded.getChannelData(ch)
      const dst = slowdownReversedBuffer.getChannelData(ch)
      for (let i = 0; i < src.length; i++) {
        dst[i] = src[src.length - 1 - i]
      }
    }
  })
  .catch(() => {})

function playBuffer(buffer: AudioBuffer, volume: number) {
  const ctx = getAudio()
  const source = ctx.createBufferSource()
  source.buffer = buffer
  const gain = ctx.createGain()
  gain.gain.value = volume * (bulletTimeActive ? 0.3 : 1)
  source.connect(gain).connect(ctx.destination)
  source.start()
}

// Background music
const bgMusic = new Audio('sounds/environment/background.mp3')
bgMusic.loop = true
bgMusic.volume = 0.08

// Ambient — random siren
const ambientSiren = new Audio('sounds/environment/siren.mp3')
ambientSiren.volume = 0.025

let ambientActive = false
let ambientTimeout: ReturnType<typeof setTimeout> | null = null

function scheduleSiren() {
  if (!ambientActive) return
  const delay = 15000 + Math.random() * 30000 // 15-45 seconds between sirens
  ambientTimeout = setTimeout(() => {
    if (!ambientActive) return
    ambientSiren.currentTime = 0
    ambientSiren.play().catch(() => {})
    // Schedule next one after this one finishes
    ambientSiren.onended = () => scheduleSiren()
  }, delay)
}

function getAudio(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext()
  if (audioCtx.state === 'suspended') audioCtx.resume()
  return audioCtx
}

function playNoise(duration: number, volume: number, filterFreq: number) {
  const ctx = getAudio()
  const bufferSize = Math.floor(ctx.sampleRate * duration)
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2)
  }
  const source = ctx.createBufferSource()
  source.buffer = buffer
  const gain = ctx.createGain()
  gain.gain.value = volume * (bulletTimeActive ? 0.3 : 1)
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = filterFreq
  source.connect(filter).connect(gain).connect(ctx.destination)
  source.start()
}

function playTone(freq: number, duration: number, volume: number, type: OscillatorType = 'square', decay = true) {
  const ctx = getAudio()
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.value = freq
  gain.gain.setValueAtTime(volume * (bulletTimeActive ? 0.3 : 1), ctx.currentTime)
  if (decay) gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
  osc.connect(gain).connect(ctx.destination)
  osc.start()
  osc.stop(ctx.currentTime + duration)
}

export const SFX = {
  pistolShot() {
    playSound('pistol', 0.1)
  },
  shotgunShot() {
    playSound('shotgun', 0.4)
  },
  m16Shot() {
    playSound('m16', 0.35)
  },
  sniperShot() {
    playSound('sniper', 0.3)
  },
  bulletImpact() {
    playSound('hit', 0.3)
  },
  headshot() {
    playSound('headshot', 0.9)
  },
  reload() {
    playSound('reload', 0.3)
  },
  bulletTimeOn() {
    if (slowdownBuffer) playBuffer(slowdownBuffer, 0.5)
  },
  bulletTimeOff() {
  },
  enemyDeath(type?: string) {
    if (type === 'thug') playSound('thug_death', 0.15)
    else playSound('grunt_death', 0.15)
  },
  playerHit() {
    playSound('hit', 0.3)
  },
  waveCleared() {
    const ctx = getAudio()
    // Little victory jingle — 3 ascending tones
    ;[523, 659, 784].forEach((freq, i) => {
      setTimeout(() => {
        if (ctx.state === 'running') {
          playTone(freq, 0.2, 0.15, 'square')
          playTone(freq * 2, 0.15, 0.08, 'sine')
        }
      }, i * 120)
    })
  },
  explosion() {
    playNoise(0.25, 0.5, 1200)
    playTone(60, 0.2, 0.3, 'sawtooth')
    playTone(40, 0.25, 0.2, 'square')
  },
  shellCasing() {
    setTimeout(() => playTone(4000 + Math.random() * 2000, 0.015, 0.04, 'sine'), 200)
  },
  pickup() {
    playSound('pickup', 0.3)
  },
  emptyClick() {
    playSound('empty', 0.5)
  },
  startAmbient() {
    if (!ambientActive) {
      ambientActive = true
      bgMusic.play().catch(() => {})
      scheduleSiren()
    }
  },
  stopAmbient() {
    ambientActive = false
    bgMusic.pause()
    bgMusic.currentTime = 0
    ambientSiren.pause()
    ambientSiren.currentTime = 0
    if (ambientTimeout) { clearTimeout(ambientTimeout); ambientTimeout = null }
  },
}
