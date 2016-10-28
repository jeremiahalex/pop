const colors = require('../colors')
var usedNames = {}

function clear () {
  usedNames = {}
}
function randomName () {
  let rand = Math.floor(Math.random() * colors.length)
  let name = colors[rand]

  return name
}
// TODO. change this to return an object with color and animal
function generate () {
  let name = randomName()
  while (usedNames[name]) {
    name = randomName()
  }
  usedNames[name] = true
  return name
}

module.exports = {
  generate,
clear}
