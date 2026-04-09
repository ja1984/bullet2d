// ─── Bullet 2D WebSocket Relay Server ──────────────────────────────────────────

import { WebSocketServer } from 'ws'

const PORT = process.env.PORT || 3001
const wss = new WebSocketServer({ port: PORT })

// Room management
const rooms = new Map() // roomCode -> { host: ws, guest: ws }

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

function broadcastRoomList() {
  const openRooms = []
  for (const [code, room] of rooms) {
    if (!room.guest) openRooms.push(code)
  }
  // Broadcast to all unassigned connections
  for (const client of wss.clients) {
    if (client.readyState === 1 && !client.roomCode) {
      client.send(JSON.stringify({ type: 'room_list', rooms: openRooms }))
    }
  }
}

wss.on('connection', (ws) => {
  console.log('Client connected')
  ws.roomCode = null
  ws.role = null

  ws.on('message', (data) => {
    let msg
    try {
      msg = JSON.parse(data)
    } catch {
      return
    }

    switch (msg.type) {
      case 'host': {
        // Create a new room
        let code = generateRoomCode()
        while (rooms.has(code)) code = generateRoomCode()
        rooms.set(code, { host: ws, guest: null })
        ws.roomCode = code
        ws.role = 'host'
        ws.send(JSON.stringify({ type: 'hosted', roomCode: code }))
        console.log(`Room ${code} created`)
        broadcastRoomList()
        break
      }

      case 'join': {
        const room = rooms.get(msg.roomCode)
        if (!room) {
          ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }))
          break
        }
        if (room.guest) {
          ws.send(JSON.stringify({ type: 'error', message: 'Room is full' }))
          break
        }
        room.guest = ws
        ws.roomCode = msg.roomCode
        ws.role = 'guest'
        ws.send(JSON.stringify({ type: 'joined', roomCode: msg.roomCode }))
        room.host.send(JSON.stringify({ type: 'guest_joined' }))
        console.log(`Guest joined room ${msg.roomCode}`)
        broadcastRoomList()
        break
      }

      case 'list_rooms': {
        const openRooms = []
        for (const [code, room] of rooms) {
          if (!room.guest) openRooms.push(code)
        }
        ws.send(JSON.stringify({ type: 'room_list', rooms: openRooms }))
        break
      }

      // Game messages — relay to the other player
      case 'state_sync': {
        // Host sends state to guest
        const room = rooms.get(ws.roomCode)
        if (room?.guest?.readyState === 1) {
          room.guest.send(data.toString())
        }
        break
      }

      case 'guest_input': {
        // Guest sends input to host
        const room = rooms.get(ws.roomCode)
        if (room?.host?.readyState === 1) {
          room.host.send(data.toString())
        }
        break
      }

      case 'game_event': {
        // Relay game events (kills, pickups, etc.) to the other player
        const room = rooms.get(ws.roomCode)
        if (!room) break
        const target = ws.role === 'host' ? room.guest : room.host
        if (target?.readyState === 1) {
          target.send(data.toString())
        }
        break
      }
    }
  })

  ws.on('close', () => {
    console.log('Client disconnected')
    if (ws.roomCode) {
      const room = rooms.get(ws.roomCode)
      if (room) {
        if (ws.role === 'host') {
          // Host left — notify guest and destroy room
          if (room.guest?.readyState === 1) {
            room.guest.send(JSON.stringify({ type: 'host_left' }))
            room.guest.roomCode = null
            room.guest.role = null
          }
          rooms.delete(ws.roomCode)
          console.log(`Room ${ws.roomCode} destroyed (host left)`)
        } else if (ws.role === 'guest') {
          room.guest = null
          if (room.host?.readyState === 1) {
            room.host.send(JSON.stringify({ type: 'guest_left' }))
          }
          console.log(`Guest left room ${ws.roomCode}`)
        }
        broadcastRoomList()
      }
    }
  })
})

console.log(`Bullet 2D relay server running on port ${PORT}`)
