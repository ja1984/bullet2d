// ─── Keybindings System ──────────────────────────────────────────────────────

export type GameAction = 'moveLeft' | 'moveRight' | 'jump' | 'crouch' | 'bulletTime' | 'reload' | 'pause'

interface KeyBinding {
  primary: string   // KeyboardEvent.code
  secondary: string // alternate key
}

const DEFAULT_BINDINGS: Record<GameAction, KeyBinding> = {
  moveLeft:   { primary: 'KeyA',   secondary: 'ArrowLeft' },
  moveRight:  { primary: 'KeyD',   secondary: 'ArrowRight' },
  jump:       { primary: 'KeyW',   secondary: 'ArrowUp' },
  crouch:     { primary: 'KeyS',   secondary: 'ArrowDown' },
  bulletTime: { primary: 'Space',  secondary: '' },
  reload:     { primary: 'KeyR',   secondary: '' },
  pause:      { primary: 'Escape', secondary: '' },
}

const ACTION_LABELS: Record<GameAction, string> = {
  moveLeft: 'Move Left',
  moveRight: 'Move Right',
  jump: 'Jump',
  crouch: 'Crouch',
  bulletTime: 'Bullet Time',
  reload: 'Reload',
  pause: 'Pause',
}

const STORAGE_KEY = 'bulletTime2d_keybindings'

let bindings: Record<GameAction, KeyBinding> = loadBindings()

function loadBindings(): Record<GameAction, KeyBinding> {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      // Merge with defaults in case new actions were added
      return { ...DEFAULT_BINDINGS, ...parsed }
    }
  } catch {}
  return { ...DEFAULT_BINDINGS }
}

function saveBindings() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bindings))
}

export function isAction(action: GameAction, keys: Record<string, boolean>): boolean {
  const b = bindings[action]
  return !!(keys[b.primary] || (b.secondary && keys[b.secondary]))
}

export function getKeyName(code: string): string {
  if (!code) return '—'
  // Pretty-print common key codes
  const map: Record<string, string> = {
    'Space': 'SPACE', 'Escape': 'ESC', 'ShiftLeft': 'L-SHIFT', 'ShiftRight': 'R-SHIFT',
    'ControlLeft': 'L-CTRL', 'ControlRight': 'R-CTRL',
    'ArrowUp': '↑', 'ArrowDown': '↓', 'ArrowLeft': '←', 'ArrowRight': '→',
    'Tab': 'TAB', 'Enter': 'ENTER', 'Backspace': 'BKSP',
    'Mouse0': 'LMB', 'Mouse1': 'MMB', 'Mouse2': 'RMB',
    'Mouse3': 'MOUSE4', 'Mouse4': 'MOUSE5',
  }
  if (map[code]) return map[code]
  if (code.startsWith('Key')) return code.slice(3)
  if (code.startsWith('Digit')) return code.slice(5)
  return code
}

export function getBindings() { return bindings }
export function getActionLabel(action: GameAction) { return ACTION_LABELS[action] }
export function getActions(): GameAction[] { return Object.keys(DEFAULT_BINDINGS) as GameAction[] }

export function setBinding(action: GameAction, slot: 'primary' | 'secondary', code: string) {
  bindings[action][slot] = code
  saveBindings()
}

export function resetBindings() {
  bindings = { ...DEFAULT_BINDINGS }
  // Deep copy to avoid shared refs
  for (const key of Object.keys(bindings) as GameAction[]) {
    bindings[key] = { ...DEFAULT_BINDINGS[key] }
  }
  saveBindings()
}
