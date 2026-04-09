// ─── Gamepad Input System ─────────────────────────────────────────────────────

export interface GamepadInput {
  moveX: number      // -1 to 1 (left stick X)
  moveY: number      // -1 to 1 (left stick Y)
  aimX: number       // -1 to 1 (right stick X)
  aimY: number       // -1 to 1 (right stick Y)
  jump: boolean      // A button (fresh press)
  jumpHeld: boolean  // A button (held)
  shoot: boolean     // Right trigger (fresh press for semi-auto)
  shootHeld: boolean // Right trigger (held, for auto weapons)
  bulletTime: boolean // Left trigger
  reload: boolean    // X button
  crouch: boolean    // B button / left stick down
  dive: boolean      // double tap left stick
  weaponNext: boolean // Right bumper
  weaponPrev: boolean // Left bumper
  connected: boolean
}

const DEADZONE = 0.15

let lastDiveDir = 0
let diveTimer = 0
let lastMoveX = 0
let jumpWasUp = true
let shootWasUp = true
let bulletTimeWasUp = true
let reloadWasUp = true
let weaponNextWasUp = true
let weaponPrevWasUp = true

export function pollGamepad(dt: number): GamepadInput {
  const gamepads = navigator.getGamepads()
  const gp = gamepads[0] || gamepads[1] || gamepads[2] || gamepads[3]

  const input: GamepadInput = {
    moveX: 0, moveY: 0, aimX: 0, aimY: 0,
    jump: false, jumpHeld: false,
    shoot: false, shootHeld: false,
    bulletTime: false,
    reload: false, crouch: false, dive: false,
    weaponNext: false, weaponPrev: false,
    connected: false,
  }

  if (!gp) return input
  input.connected = true

  // Left stick — movement
  const lx = Math.abs(gp.axes[0]) > DEADZONE ? gp.axes[0] : 0
  const ly = Math.abs(gp.axes[1]) > DEADZONE ? gp.axes[1] : 0
  input.moveX = lx
  input.moveY = ly

  // Right stick — aiming
  const rx = Math.abs(gp.axes[2]) > DEADZONE ? gp.axes[2] : 0
  const ry = Math.abs(gp.axes[3]) > DEADZONE ? gp.axes[3] : 0
  input.aimX = rx
  input.aimY = ry

  // Buttons (standard mapping)
  // A = 0, B = 1, X = 2, Y = 3
  // LB = 4, RB = 5, LT = 6, RT = 7
  const aPressed = gp.buttons[0]?.pressed
  const bPressed = gp.buttons[1]?.pressed
  const xPressed = gp.buttons[2]?.pressed
  const lbPressed = gp.buttons[4]?.pressed
  const rbPressed = gp.buttons[5]?.pressed
  const ltValue = gp.buttons[6]?.value ?? 0
  const rtValue = gp.buttons[7]?.value ?? 0

  // Jump — A button
  if (aPressed && jumpWasUp) {
    input.jump = true
  }
  input.jumpHeld = aPressed
  jumpWasUp = !aPressed

  // Shoot — right trigger
  const rtDown = rtValue > 0.3
  if (rtDown && shootWasUp) {
    input.shoot = true // fresh press (semi-auto)
  }
  input.shootHeld = rtDown // held (auto weapons)
  shootWasUp = !rtDown

  // Bullet time — left trigger (toggle)
  const ltDown = ltValue > 0.3
  if (ltDown && bulletTimeWasUp) {
    input.bulletTime = true
  }
  bulletTimeWasUp = !ltDown

  // Reload — X button (fresh press)
  if (xPressed && reloadWasUp) {
    input.reload = true
  }
  reloadWasUp = !xPressed

  // Crouch — B button or left stick down
  input.crouch = bPressed || ly > 0.5

  // Weapon switching — bumpers (fresh press)
  if (rbPressed && weaponNextWasUp) input.weaponNext = true
  weaponNextWasUp = !rbPressed
  if (lbPressed && weaponPrevWasUp) input.weaponPrev = true
  weaponPrevWasUp = !lbPressed

  // Dive — double tap left stick left or right
  diveTimer -= dt
  if (Math.abs(lx) > 0.7) {
    const dir = lx > 0 ? 1 : -1
    if (lastMoveX === 0 || Math.sign(lastMoveX) !== dir) {
      // Fresh push in this direction
      if (diveTimer > 0 && lastDiveDir === dir) {
        input.dive = true
        diveTimer = 0
      } else {
        lastDiveDir = dir
        diveTimer = 0.3
      }
    }
  }
  lastMoveX = Math.abs(lx) > 0.7 ? lx : 0

  return input
}
