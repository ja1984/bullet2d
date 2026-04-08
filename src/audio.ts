// ─── Audio System ────────────────────────────────────────────────────────────

let audioCtx: AudioContext | null = null

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
    playNoise(0.08, 0.3, 3000)
    playTone(800, 0.05, 0.15, 'square')
  },
  shotgunShot() {
    playNoise(0.15, 0.5, 2000)
    playTone(200, 0.1, 0.2, 'sawtooth')
    playTone(120, 0.12, 0.15, 'square')
  },
  m16Shot() {
    playNoise(0.05, 0.25, 4000)
    playTone(1200, 0.03, 0.1, 'square')
  },
  sniperShot() {
    playNoise(0.2, 0.6, 1500)
    playTone(150, 0.15, 0.3, 'sawtooth')
    playTone(80, 0.2, 0.2, 'square')
  },
  bulletImpact() {
    playNoise(0.04, 0.15, 2500)
    playTone(400, 0.03, 0.08, 'square')
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
  enemyDeath() {
    playNoise(0.1, 0.2, 1500)
    playTone(300, 0.08, 0.12, 'sawtooth')
    playTone(150, 0.12, 0.1, 'square')
  },
  playerHit() {
    playNoise(0.08, 0.3, 1800)
    playTone(200, 0.1, 0.2, 'square')
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
    playTone(4000 + Math.random() * 2000, 0.015, 0.04, 'sine')
  },
  pickup() {
    playTone(800, 0.08, 0.12, 'sine')
    setTimeout(() => playTone(1200, 0.08, 0.1, 'sine'), 60)
  },
}
