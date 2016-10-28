'use strict'

const express = require('express')
const http = require('http')
const app = express()
const port = process.env.PORT || 3000
const server = http.createServer(app)
const io = require('socket.io')(server)
const rng = require('./app/randomNameGenerator.js')

const TURN_DELAY = 3000 // how many milliseconds before a player can click
const UPDATE_RATE = 1000 // how many milliseconds before each update interval - speed of the game
const BALLOON_RATE = 3000 // how often are new balloons created in milliseconds
const STARTING_RADIUS = 0.1 // what size does a balloon start
const RADIUS_INC = 0.05 // how much does it's radius increase by each update
const MAX_RADIUS = 0.5 // what size before it pops on it's own
const STARTING_LIFE = 0.8 // how much life should a player popped bubble start with - also opacity
const LIFE_DEC = 0.02 // how much life is subtracted from 1 each update
const MAX_BALLOON_SCORE = 100 // how many points for a full sized balloon

var players = {} // keep an object of all players with their socket id as the key
var balloons = [] // an array of all balloons in the game
var nextBalloonId = 0 // we assign this as an id for each new balloon and inc it after
var paused = true // if not current connections then we can pause our loop
var creationInterval
var updateInterval

// We still use express as our web server and configure it to serve everything in out public folder
app.use(express.static('public'))
server.listen(port, () => {
  console.log('Server listening on port: ' + port)
})

/*
  SOCKET MESSAGES USED
  // Our game communications are sent through socket.io

  sent:
  > game-joined: sent to a player when they have been added to the game
  > players-list: sent to all players to show them who else is in the game
  > balloon-update: sent whenever a balloon is popped or every UPDATE_RATE milliseconds, when it increases in size

  received:
  > connection: received when a new web-socket is connected, used to add a player
  > player-click: received from a player when they click
  > disconnect: received when a web socket disconnets, used to remove them from the game
*/

io.on('connection', (socket) => {
  // if first connection then restart the game
  if (paused) startGame()

  // New player - save them to our players object, for lookup later
  let color = rng.generate()
  players[socket.id] = {
    id: socket.id,
    name: color,
    color: color,
    cannot_click_until: new Date().getTime(),
    score: 0
  }
  // tell the player about themselves and the game
  let gameInfo = {
    id: players[socket.id].id,
    name: players[socket.id].name,
    balloons: balloons,
    turnDelay: TURN_DELAY / 1000 // return to the client in seconds as they will just display
  }
  socket.emit('game-joined', gameInfo)

  // notify all players of the current game players
  io.sockets.emit('players-list', players)

  // PLAYER EVENTS
  // if a socket(player) disconnects then remove them from the game
  socket.once('disconnect', () => {
    // remove them from our players object
    delete players[socket.id]

    // ensure that the socket is disconnedted on our side
    socket.disconnect()

    // if this was the last connection then stop the game
    if (Object.keys(players).length === 0) {
      stopGame()
    } else {
      // notify all remaining players of who is left in the game
      io.sockets.emit('players-list', players)
    }
  })

  // listen for the player making a move
  socket.on('player-click', (click) => {
    // first find the player
    let player = players[socket.id]

    let timeNow = new Date().getTime()
    // we only allow a player to click every TURN_DELAY milliseconds, so if they can't click yet, then reject it
    if (player.cannot_click_until > timeNow) {
      console.log('player cannot click for ', player.cannot_click_until - timeNow)
      return
    }

    // set the click delay (in ms) for the player
    player.cannot_click_until = timeNow + TURN_DELAY

    // else where have they clicked? Do we have a balloon there?
    for (let i = 0; i < balloons.length; i++) {
      if (balloons[i].popped) {
        continue
      }

      // use some trigonometry to calculate if click is in circle
      console.log('x', click.x, 'y', click.y)
      console.log('dx', click.x - balloons[i].x, 'dy', click.y - balloons[i].y)
      let a2 = Math.pow(click.x - balloons[i].x, 2)
      let b2 = Math.pow(click.y - balloons[i].y, 2)
      console.log('a2', a2, 'b2', b2)
      let c2 = a2 + b2
      console.log('c2', c2)
      let len = Math.sqrt(c2)
      console.log('r', balloons[i].radius, 'len', len)
      if (len < balloons[i].radius) {
        console.log('balloon popped', balloons[i].id)
        // balloon was popped!
        // increase the player's score based upon how big the balloon was
        balloons[i].scored = Math.round(MAX_BALLOON_SCORE * balloons[i].radius)
        player.score += balloons[i].scored
        // mark the balloon as popped
        balloons[i].popped = true
        balloons[i].lifespan = STARTING_LIFE
        balloons[i].color = player.color
        balloons[i].poppedBy = player.id
        // tell all players the balloon was popped and give them the latest collection
        io.sockets.emit('balloon-update', balloons)
        // at the same time update the player scores
        io.sockets.emit('players-list', players)
        // exit the function so we don't keep checking
        return
      }
    }
  })
})

function stopGame () {
  console.log('game paused')
  paused = true
  players = {}
  balloons = []
  nextBalloonId = 0
  clearInterval(creationInterval)
  clearInterval(updateInterval)
}

function startGame () {
  console.log('game started')
  paused = false

  // set intervals to add new balloons and increase the size of existing ones
  if (creationInterval) clearInterval(creationInterval)
  creationInterval = setInterval(() => {
    // randomly create balloons between 0-1 on the x and y, the client can then scale to display size
    balloons.push({
      id: nextBalloonId++,
      x: Math.random(),
      y: Math.random(),
      radius: STARTING_RADIUS,
      color: 'whitesmoke',
      popped: false,
      poppedBy: null
    })
    if (nextBalloonId === Number.MAX_SAFE_INTEGER) {
      // if we reach the max integer number, then just restart, the original balloons will be long dead
      nextBalloonId = 0
    }
  }, BALLOON_RATE)

  if (updateInterval) clearInterval(updateInterval)
  updateInterval = setInterval(() => {
    // loop through all balloons and increase size
    balloons = balloons.filter((b, i) => {
      // if a balloon was dead on a previous update, it is now safe to remove it from the array
      if (b.dead) {
        return false
      } else if (b.popped) {
        // then decrease life span
        balloons[i].lifespan -= LIFE_DEC
        if (balloons[i].lifespan <= 0) {
          b.dead = true
          // reduce the score of the popper
          if (balloons[i].poppedBy) {
            players[balloons[i].poppedBy].score -= balloons[i].scored
            // update the player scores
            io.sockets.emit('players-list', players)
          }
        }
        return true
      } else {
        // else increase it's radius
        b.radius += RADIUS_INC
        if (b.radius >= MAX_RADIUS) {
          // unless a player popped it, it disappears straight away
          balloons[i].lifespan = 0
          b.popped = true
        }
        return true
      }
    })
    io.sockets.emit('balloon-update', balloons)
  // notify the players about the new balloons
  }, UPDATE_RATE)
}
