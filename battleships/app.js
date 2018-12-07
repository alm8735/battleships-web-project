const express = require("express");
const http = require("http");
const websocket = require("websocket");

// function to generate player id (source: https://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid-in-javascript)
function guidGenerator() {
  var S4 = function() {
     return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
  };
  return (S4()+S4()+"-"+S4()+"-"+S4()+"-"+S4()+"-"+S4()+S4()+S4());
}

///////////// Data Structures ///////////////////

// list of unpaired players
unpairedPlayers = {};
pairedPlayers = [];

/////////////////////////////////////////////////

// get websocket server interface
var WebSocketServer = websocket.server;

// get port from given arguments
var port = process.argv[2];

// create express object
var app = express();
app.use(express.static(__dirname + "/public"));

// create and open http server
var server = http.createServer(app);
server.listen(port, () => {
  console.log(`Server listening at port ${port}`);
});

// basic express routes
app.get("/splash", (req, res, next) => {
  res.sendFile("splash.html", {root: "./public"});
});

app.get("/game", (req, res, next) => {
  res.sendFile("game.html", {root: "./public"});
});

// create WebSocket server using http server
var wsServer = new WebSocketServer({
  httpServer: server
});

// Accept any requests for connection to the websocket server
wsServer.on('request', function(request) {
  var connection = request.accept(null, request.origin);
  
  // add connection to unpaired players
  unpairedPlayers[guidGenerator()] = connection;
  
  // if two players are waiting, pair them
  var unpairedKeys = Object.keys(unpairedPlayers);
  if (unpairedKeys.length >= 2) {
  }

});