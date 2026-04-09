// ─── Audio System ────────────────────────────────────────────────────────────

let audioCtx: AudioContext | null = null

// Preloaded MP3 sounds
const soundCache: Record<string, HTMLAudioElement> = {}

function preloadSound(name: string, path: string) {
  const audio = new Audio(path)
  audio.preload = 'auto'
  soundCache[name] = audio
}

function playSound(name: string, volume = 1) {
  const cached = soundCache[name]
  if (!cached) return
  const sound = cached.cloneNode() as HTMLAudioElement
  sound.volume = volume
  sound.play().catch(() => {})
}

preloadSound('empty', 'sounds/weapons/empty.mp3')
preloadSound('pistol', 'sounds/weapons/pistol.mp3')
preloadSound('m16', 'sounds/weapons/m16.mp3')
preloadSound('sniper', 'sounds/weapons/sniper.mp3')
preloadSound('shotgun', 'sounds/weapons/shotgun.mp3')
preloadSound('hit', 'sounds/weapons/hit.mp3')
preloadSound('grunt_death', 'sounds/enemies/grunt.mp3')
preloadSound('thug_death', 'sounds/enemies/thug.mp3')

// Ambient loops
const ambientSiren = new Audio('sounds/environment/siren.mp3')
ambientSiren.loop = true
ambientSiren.volume = 0.010

let ambientPlaying = false

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
  gain.gain.value = volume
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
  gain.gain.setValueAtTime(volume, ctx.currentTime)
  if (decay) gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
  osc.connect(gain).connect(ctx.destination)
  osc.start()
  osc.stop(ctx.currentTime + duration)
}

export const SFX = {
  pistolShot() {
    playSound('pistol', 0.2)
  },
  shotgunShot() {
    playSound('shotgun', 0.4)
  },
  m16Shot() {
    playSound('m16', 0.35)
  },
  sniperShot() {
    playSound('sniper', 0.5)
  },
  bulletImpact() {
    playSound('hit', 0.3)
  },
  headshot() {
    playNoise(0.06, 0.3, 3500)
    playTone(1500, 0.08, 0.2, 'square')
    playTone(2000, 0.06, 0.15, 'sine')
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
    if (type === 'thug') playSound('thug_death', 0.4)
    else playSound('grunt_death', 0.4)
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
    playTone(800, 0.08, 0.12, 'sine')
    setTimeout(() => playTone(1200, 0.08, 0.1, 'sine'), 60)
  },
  emptyClick() {
    playSound('empty', 0.5)
  },
  startAmbient() {
    if (!ambientPlaying) {
      ambientSiren.play().catch(() => {})
      ambientPlaying = true
    }
  },
  stopAmbient() {
    ambientSiren.pause()
    ambientSiren.currentTime = 0
    ambientPlaying = false
  },
}
