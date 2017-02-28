/* globals $ io */
$(function () {
  'use strict'

  var gameInfo = {
    id: -1,
    name: '',
    balloons: [],
    turnDelay: 0
  }
  var players = []
  var delayCounter = 0
  var delayInterval

  var width = $(window).width()
  var height = $(window).height()
  var maxDimension = Math.min(width, height)

  // connect the socket.io client to our webserver (assuming it's running on the same port)
  var socket = io(window.location.host)

  // function for setting the connection status
  function status (isConnected) {
    if (isConnected) {
      $('#join').removeClass('hidden')
      $('#status').addClass('label-success').removeClass('label-danger label-default').text('connected')
    } else {
      $('main').addClass('hidden')
      $('#messages').empty()
      $('#status').addClass('label-danger').removeClass('label-success label-default').text('disconnected')
    }
  }

  // SOCKET EVENTS
  // handle connectting to and disconnecting from the chat server
  socket.on('connect', function () {
    console.log('Connected to Socket')
    status(true)
  })
  socket.on('disconnect', function () {
    console.log('Disconnected from Socket')
    endGame()
    status(false)
  })

  // welcome message received from the server
  socket.on('game-joined', function (msg) {
    console.log('Received game-joined message: ', msg)
    gameInfo = msg
    startGame()
  })
  socket.on('players-list', function (msg) {
    console.log('Received players-list message: ', msg)
    // the players is a object but we want an array, so we map it to that
    players = Object.keys(msg).map(function (key) {
      var obj = msg[key]
      obj.id = key
      return obj
    })
    updatePlayerList()
  })
  socket.on('balloon-update', function (msg) {
    // console.log('Received balloon-update message: ', msg)
    gameInfo.balloons = msg
    updateBalloons()
  })

  function resetDelayCounter () {
    delayCounter = gameInfo.turnDelay
    $('turnDelay').text('Can click again in ' + delayCounter + ' seconds')
  }
  function startGame () {
    // reset everything
    $('#balloons').empty()
    $('#players').empty()
    delayCounter = 0

    // start our Update loop
    if (delayInterval) stopInterval(delayInterval)
    setInterval(function () {
      if (delayCounter <= 0) return

      delayCounter -= 1

      if (delayCounter > 0) {
        $('#turnDelay').text('Can click again in ' + delayCounter + ' seconds')
      } else {
        $('#turnDelay').empty()
      }
    }, 1000)

    // add click handler for the stage
    $(document).off('click')
    $(document).on('click', function (event) {
      event.stopPropagation()
      // if player cannot click yet then don't let them
      if (delayCounter > 0) return
      console.log('clicked', event.pageX / width, event.pageY / height)
      // send the player's click to server but scale it between 0-1 i.e. device independent
      socket.emit('player-click', {x: event.pageX / width, y: event.pageY / height})
      resetDelayCounter()
    })
  }

  function endGame () {
    $('#players').empty()
    $('#balloons').empty()
    $('#turnDelay').empty()
    gameInfo = {
      id: -1,
      name: '',
      balloons: [],
      turnDelay: 0
    }
    players = []
    delayCounter = 0
    if (delayInterval) stopInterval(delayInterval)
  }
  function updatePlayerList () {
    $('#players').empty()
    players.forEach(function (p, i) {
      var playerName = p.name
      var elem = $('<div><div class="icon"></div><div class="player-name">' + playerName + '</div>' + '<span>' + p.score + '</span></div>')
      elem.children('.icon').css('background-color', p.color)
      if (p.id === gameInfo.id) {
        elem.children('.player-name').addClass('current-player')
      }
      // TODO. need to set the text color to complement or think about the design so it doesn't matter
      $('#players').append(elem)
    })
  }
  function updateBalloons () {
    gameInfo.balloons.forEach(function (b, i) {
      // each balloon has an id, so first we try to find it onscreen
      var elem = $('#balloons #balloon' + b.id)
      if (elem.length === 0) {
        // create new
        elem = $('<div class="balloon" id="balloon' + b.id + '"></div>')
        elem.css('background-color', b.color)
        elem.css('z-index', b.id)
        $('#balloons').append(elem)
      }
      // if the balloon is dead we just remove it
      if (b.dead) {
        elem.remove()
        return
      }
      // else update it
      // radius is a 0-1 so we use it a proporition of max balloon size
      var radiusScaled = b.radius * maxDimension
      elem.css('width', Math.round(radiusScaled * 2))
      elem.css('height', Math.round(radiusScaled * 2))
      // set position
      elem.css('left', Math.round(width * b.x) - radiusScaled)
      elem.css('top', Math.round(height * b.y) - radiusScaled)

      if (b.popped) {
        elem.css('background-color', b.color)
        if (b.lifespan) {
          elem.css('opacity', b.lifespan)
        }
      }
    })
  }
})
