// ─── Keybindings Settings UI ─────────────────────────────────────────────────

import { getActions, getActionLabel, getBindings, getKeyName, setBinding, resetBindings, type GameAction } from '../keybindings'

let menuEl: HTMLDivElement | null = null
let visible = false
let waitingForKey: { action: GameAction; slot: 'primary' | 'secondary' } | null = null

export function createKeybindingsMenu() {
  if (menuEl) return

  menuEl = document.createElement('div')
  menuEl.id = 'kb-menu'
  menuEl.style.cssText = `
    display: none; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
    background: rgba(10,10,30,0.95); border: 1px solid rgba(255,255,255,0.15);
    border-radius: 8px; padding: 24px 32px; z-index: 200;
    font-family: Audiowide, monospace; color: #ccc; min-width: 380px;
  `

  menuEl.addEventListener('contextmenu', (e) => e.preventDefault())
  document.body.appendChild(menuEl)
  renderMenu()
}

function renderMenu() {
  if (!menuEl) return
  const bindings = getBindings()
  const actions = getActions()

  let html = `<div style="font-size:16px;color:#fff;margin-bottom:16px;text-align:center">KEY BINDINGS</div>`
  html += `<table style="width:100%;border-collapse:collapse">`
  html += `<tr style="color:#888;font-size:10px"><td>ACTION</td><td style="text-align:center">PRIMARY</td><td style="text-align:center">ALT</td></tr>`

  for (const action of actions) {
    const b = bindings[action]
    const label = getActionLabel(action)
    const isWaitingPri = waitingForKey?.action === action && waitingForKey?.slot === 'primary'
    const isWaitingSec = waitingForKey?.action === action && waitingForKey?.slot === 'secondary'

    html += `<tr style="border-top:1px solid rgba(255,255,255,0.05)">`
    html += `<td style="padding:8px 0;font-size:12px;color:#aaa">${label}</td>`
    html += `<td style="text-align:center"><button class="kb-btn" data-action="${action}" data-slot="primary" style="${btnStyle(isWaitingPri)}">${isWaitingPri ? 'Press key...' : getKeyName(b.primary)}</button></td>`
    html += `<td style="text-align:center"><button class="kb-btn" data-action="${action}" data-slot="secondary" style="${btnStyle(isWaitingSec)}">${isWaitingSec ? 'Press key...' : getKeyName(b.secondary)}</button></td>`
    html += `</tr>`
  }

  html += `</table>`
  html += `<div style="margin-top:16px;text-align:center">`
  html += `<button id="kb-reset" style="${resetBtnStyle()}">RESET TO DEFAULT</button>`
  html += `<button id="kb-close" style="${closeBtnStyle()}">CLOSE</button>`
  html += `</div>`

  menuEl.innerHTML = html

  // Attach click handlers
  menuEl.querySelectorAll('.kb-btn').forEach(btn => {
    btn.addEventListener('mousedown', (e) => {
      e.stopPropagation(); e.preventDefault()
      const el = e.currentTarget as HTMLElement
      const action = el.dataset.action as GameAction
      const slot = el.dataset.slot as 'primary' | 'secondary'
      waitingForKey = { action, slot }
      renderMenu()
    })
  })

  menuEl.querySelector('#kb-reset')?.addEventListener('mousedown', (e) => {
    e.stopPropagation(); e.preventDefault()
    resetBindings()
    waitingForKey = null
    renderMenu()
  })

  menuEl.querySelector('#kb-close')?.addEventListener('mousedown', (e) => {
    e.stopPropagation(); e.preventDefault()
    hideKeybindingsMenu()
  })
}

function btnStyle(active: boolean): string {
  return `
    padding: 4px 12px; margin: 2px; min-width: 60px;
    background: ${active ? 'rgba(255,200,50,0.3)' : 'rgba(255,255,255,0.08)'};
    color: ${active ? '#ffcc44' : '#fff'}; border: 1px solid ${active ? '#ffcc44' : 'rgba(255,255,255,0.2)'};
    border-radius: 4px; font: bold 11px Audiowide, monospace; cursor: pointer;
  `
}

function resetBtnStyle(): string {
  return `padding:6px 14px;margin:4px;background:rgba(255,80,80,0.15);color:#ff6666;border:1px solid rgba(255,80,80,0.3);border-radius:4px;font:bold 11px Audiowide, monospace;cursor:pointer;`
}

function closeBtnStyle(): string {
  return `padding:6px 14px;margin:4px;background:rgba(255,255,255,0.1);color:#fff;border:1px solid rgba(255,255,255,0.3);border-radius:4px;font:bold 11px Audiowide, monospace;cursor:pointer;`
}

// Listen for key or mouse button when rebinding
function onKeyDown(e: KeyboardEvent) {
  if (!waitingForKey || !visible) return
  e.preventDefault()
  e.stopPropagation()

  if (e.code === 'Escape') {
    waitingForKey = null
    renderMenu()
    return
  }

  setBinding(waitingForKey.action, waitingForKey.slot, e.code)
  waitingForKey = null
  renderMenu()
}

function onMouseDown(e: MouseEvent) {
  if (!waitingForKey || !visible) return
  e.preventDefault()
  e.stopPropagation()

  setBinding(waitingForKey.action, waitingForKey.slot, `Mouse${e.button}`)
  waitingForKey = null
  renderMenu()
}

export function showKeybindingsMenu() {
  if (!menuEl) createKeybindingsMenu()
  if (menuEl && !visible) {
    menuEl.style.display = 'block'
    visible = true
    waitingForKey = null
    renderMenu()
    window.addEventListener('keydown', onKeyDown, { capture: true })
    window.addEventListener('mousedown', onMouseDown, { capture: true })
  }
}

export function hideKeybindingsMenu() {
  if (menuEl) menuEl.style.display = 'none'
  visible = false
  waitingForKey = null
  window.removeEventListener('keydown', onKeyDown, { capture: true })
  window.removeEventListener('mousedown', onMouseDown, { capture: true })
}

export function isKeybindingsMenuVisible() { return visible }

// ─── Title Screen Button ────────────────────────────────────────────────────

let btnEl: HTMLButtonElement | null = null
let btnVisible = false

function createBtn() {
  if (btnEl) return
  btnEl = document.createElement('button')
  btnEl.textContent = 'CONTROLS'
  btnEl.style.cssText = `
    display: none; position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%);
    padding: 8px 18px; background: rgba(255,255,255,0.1); color: #fff;
    border: 1px solid rgba(255,255,255,0.3); border-radius: 4px;
    font: bold 13px Audiowide, monospace; cursor: pointer; z-index: 100;
    transition: background 0.15s;
  `
  btnEl.addEventListener('mouseenter', () => { if (btnEl) btnEl.style.background = 'rgba(255,255,255,0.25)' })
  btnEl.addEventListener('mouseleave', () => { if (btnEl) btnEl.style.background = 'rgba(255,255,255,0.1)' })
  btnEl.addEventListener('mousedown', (e) => { e.stopPropagation(); e.preventDefault() })
  btnEl.addEventListener('click', (e) => {
    e.stopPropagation(); e.preventDefault()
    showKeybindingsMenu()
  })
  document.body.appendChild(btnEl)
}

export function showKeybindingsBtn() {
  if (!btnEl) createBtn()
  if (btnEl && !btnVisible) { btnEl.style.display = 'block'; btnVisible = true }
}

export function hideKeybindingsBtn() {
  if (btnEl) btnEl.style.display = 'none'
  btnVisible = false
}
