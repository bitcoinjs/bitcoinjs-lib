module.exports = function (obj){
  return obj.constructor.toString().match(/function (.*)\(/)[1]
}
