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
    const ctx = getAudio()
    // Click
    setTimeout(() => playTone(1800, 0.02, 0.15, 'square'), 0)
    // Clack
    setTimeout(() => {
      if (ctx.state === 'running') playTone(1200, 0.03, 0.15, 'square')
    }, 100)
  },
  bulletTimeOn() {
    const ctx = getAudio()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(200, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.3)
    gain.gain.setValueAtTime(0.2, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.4)
    playNoise(0.3, 0.1, 500)
  },
  bulletTimeOff() {
    const ctx = getAudio()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(80, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.2)
    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25)
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.25)
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
