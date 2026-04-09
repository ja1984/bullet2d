// ─── Bullet 2D PartyKit Server ────────────────────────────────────────────────
// Simple relay: each player sends their state, server forwards it to the other.

import type * as Party from "partykit/server"

export default class GameRelay implements Party.Server {
  constructor(readonly room: Party.Room) {}

  onConnect(conn: Party.Connection) {
    const count = [...this.room.getConnections()].length
    if (count > 2) {
      conn.send(JSON.stringify({ type: 'error', message: 'Room is full' }))
      conn.close()
      return
    }
    // Assign player index (0 or 1)
    const playerIndex = count - 1 // first connection = 0, second = 1
    conn.setState({ playerIndex })
    conn.send(JSON.stringify({ type: 'welcome', playerIndex, roomCode: this.room.id }))

    // Notify existing players
    for (const other of this.room.getConnections()) {
      if (other.id !== conn.id) {
        other.send(JSON.stringify({ type: 'player_joined', playerIndex }))
      }
    }
  }

  onMessage(message: string, sender: Party.Connection) {
    // Relay to all OTHER connections
    for (const conn of this.room.getConnections()) {
      if (conn.id !== sender.id) {
        conn.send(message)
      }
    }
  }

  onClose(conn: Party.Connection) {
    for (const other of this.room.getConnections()) {
      if (other.id !== conn.id) {
        other.send(JSON.stringify({ type: 'player_left' }))
      }
    }
  }
}
