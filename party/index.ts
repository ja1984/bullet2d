// ─── Bullet 2D PartyKit Server ────────────────────────────────────────────────
// Simple relay: each player sends their state, server forwards it to the other.

import type * as Party from "partykit/server"

export default class GameRelay implements Party.Server {
  constructor(readonly room: Party.Room) {}

  nextIndex = 0

  onConnect(conn: Party.Connection) {
    const count = [...this.room.getConnections()].length
    if (count > 4) {
      conn.send(JSON.stringify({ type: 'error', message: 'Room is full' }))
      conn.close()
      return
    }
    const playerIndex = this.nextIndex++
    conn.setState({ playerIndex })
    conn.send(JSON.stringify({ type: 'welcome', playerIndex, roomCode: this.room.id }))

    // Tell new player about existing players
    for (const other of this.room.getConnections()) {
      if (other.id !== conn.id) {
        const otherIndex = (other.state as any)?.playerIndex ?? -1
        conn.send(JSON.stringify({ type: 'player_joined', playerIndex: otherIndex }))
      }
    }

    // Notify existing players about the new player
    for (const other of this.room.getConnections()) {
      if (other.id !== conn.id) {
        other.send(JSON.stringify({ type: 'player_joined', playerIndex }))
      }
    }
  }

  onMessage(message: string, sender: Party.Connection) {
    // Support targeted messages — only send to a specific player
    try {
      const parsed = JSON.parse(message)
      if (parsed._target != null) {
        for (const conn of this.room.getConnections()) {
          if ((conn.state as any)?.playerIndex === parsed._target) {
            conn.send(message)
          }
        }
        return
      }
    } catch {}

    // Default: relay to all OTHER connections
    for (const conn of this.room.getConnections()) {
      if (conn.id !== sender.id) {
        conn.send(message)
      }
    }
  }

  onClose(conn: Party.Connection) {
    const pi = (conn.state as any)?.playerIndex ?? -1
    for (const other of this.room.getConnections()) {
      if (other.id !== conn.id) {
        other.send(JSON.stringify({ type: 'player_left', playerIndex: pi }))
      }
    }
  }
}
