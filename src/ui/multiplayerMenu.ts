// ─── Multiplayer Menu UI ──────────────────────────────────────────────────────

import { state } from '../state'
import { hostGame, joinGame, disconnect, isConnected, isOnline, getRoomCode, getRole, setOnStatusChange, setOnRoomListUpdate, getLocalNickname, setLocalNickname } from '../systems/network'

let menuEl: HTMLDivElement | null = null
let statusEl: HTMLDivElement | null = null
let buttonsEl: HTMLDivElement | null = null
let roomInfoEl: HTMLDivElement | null = null
let visible = false

const btnStyle = `
  padding: 8px 18px;
  margin: 4px;
  background: rgba(255,255,255,0.1);
  color: #fff;
  border: 1px solid rgba(255,255,255,0.3);
  border-radius: 4px;
  font: bold 13px Audiowide, monospace;
  cursor: pointer;
  transition: background 0.15s;
`

export function createMultiplayerMenu() {
  if (menuEl) return

  menuEl = document.createElement('div')
  menuEl.id = 'mp-menu'
  menuEl.style.cssText = `
    display: none;
    position: fixed;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%);
    text-align: center;
    z-index: 100;
    font-family: Audiowide, monospace;
  `

  statusEl = document.createElement('div')
  statusEl.style.cssText = 'color: #888; font-size: 11px; margin-bottom: 8px;'
  menuEl.appendChild(statusEl)

  buttonsEl = document.createElement('div')
  menuEl.appendChild(buttonsEl)

  roomInfoEl = document.createElement('div')
  roomInfoEl.style.cssText = 'color: #ffcc44; font-size: 14px; margin-top: 8px;'
  menuEl.appendChild(roomInfoEl)

  document.body.appendChild(menuEl)

  setOnStatusChange((s) => {
    if (statusEl) statusEl.textContent = s
    updateButtons()
  })

  setOnRoomListUpdate(() => updateButtons())
}

function makeBtn(label: string, onClick: () => void): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.textContent = label
  btn.style.cssText = btnStyle
  btn.addEventListener('mouseenter', () => { btn.style.background = 'rgba(255,255,255,0.25)' })
  btn.addEventListener('mouseleave', () => { btn.style.background = 'rgba(255,255,255,0.1)' })
  btn.addEventListener('mousedown', (e) => {
    e.stopPropagation()
    e.preventDefault()
  })
  btn.addEventListener('click', (e) => {
    e.stopPropagation()
    e.preventDefault()
    onClick()
  })
  return btn
}

function updateButtons() {
  if (!buttonsEl || !roomInfoEl) return
  buttonsEl.innerHTML = ''
  roomInfoEl.textContent = ''

  const role = getRole()

  if (role === 'none') {
    // Nickname input
    const nickWrap = document.createElement('div')
    nickWrap.style.cssText = 'margin-bottom: 8px;'
    const nickInput = document.createElement('input')
    nickInput.type = 'text'
    nickInput.placeholder = 'Nickname'
    nickInput.maxLength = 16
    nickInput.value = getLocalNickname()
    nickInput.style.cssText = `
      padding: 6px 12px; width: 140px; text-align: center;
      background: rgba(255,255,255,0.08); color: #fff;
      border: 1px solid rgba(255,255,255,0.2); border-radius: 4px;
      font: bold 13px Audiowide, monospace; outline: none;
    `
    nickInput.addEventListener('input', () => setLocalNickname(nickInput.value))
    nickInput.addEventListener('mousedown', (e) => e.stopPropagation())
    nickInput.addEventListener('keydown', (e) => e.stopPropagation())
    nickWrap.appendChild(nickInput)
    buttonsEl.appendChild(nickWrap)

    buttonsEl.appendChild(makeBtn('HOST GAME', () => hostGame()))
    buttonsEl.appendChild(makeBtn('JOIN GAME', () => {
      const code = prompt('Enter room code:')
      if (code) joinGame(code)
    }))
  } else if (role === 'host') {
    roomInfoEl.textContent = `Room: ${getRoomCode()} — Waiting for player...`
    buttonsEl.appendChild(makeBtn('CANCEL', () => disconnect()))
  } else if (role === 'guest') {
    roomInfoEl.textContent = `Joined room: ${getRoomCode()}`
    buttonsEl.appendChild(makeBtn('LEAVE', () => disconnect()))
  }
}

export function showMultiplayerMenu() {
  if (!menuEl) createMultiplayerMenu()
  if (menuEl && !visible) {
    menuEl.style.display = 'block'
    visible = true
    updateButtons()
  }
}

export function hideMultiplayerMenu() {
  if (menuEl) menuEl.style.display = 'none'
  visible = false
}

export function isMultiplayerMenuVisible() { return visible }
