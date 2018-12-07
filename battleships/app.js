const express = require("express");
const http = require("http");
const websocket = require("ws");

///////////////// Data Structures and Helper Functions  ////////////////////////

// function to generate player id (source: https://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid-in-javascript)
function guidGenerator() {
  var S4 = function() {
     return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
  };
  return (S4()+S4()+"-"+S4()+"-"+S4()+"-"+S4()+"-"+S4()+S4()+S4());
}

function firstPlayerTurn() {
  return 0.5 < Math.random();
}

// ships to be placed by the player.
function ShipType(name, length, quantity) {
  this.name = name;
  this.length = length;
  this.unplaced = quantity;
  this.places = [];
}

 function Ships() {
  this.values = {
    aircraftCarrier: new ShipType("Aircraft Carrier", 5, 1),
    battleship: new ShipType("Battleship", 4, 1),
    cruiser: new ShipType("Cruiser", 3, 2),
    submarine: new ShipType("Submarine", 3, 1),
    destroyer: new ShipType("Destroyer", 2, 2)
   }
};

// function to check if Ships object is a correct placed version of this one.
Ships.prototype.validPlacedMatch = function(other) {
  if (!other) return false;
  
  for (let key in this.values) {
    let thisShip = this.values[key];
    let otherShip = other[key];

    if (!otherShip ||
        otherShip.name !== thisShip.name ||
        otherShip.length !== thisShip.length ||
        otherShip.places.length !== thisShip.unplaced ||
        otherShip.unplaced !== 0) {
          return false;
        }
  }

  return true;
}

// "class" for a player object.
function Player(ws){
  this.ws = ws;
  this.ready = false;
  this.turn = false;
  this.opponent = null;
  this.ships = new Ships();
}

// function to send the Ships values to the client.
Player.prototype.sendShips = function() {
  var json = JSON.stringify({'ships': this.ships.values});
  this.ws.send(json);
}

// function to confirm or deny a ready request
Player.prototype.respondReadyRequest = function(accepted) {
  var json = JSON.stringify({'readyAccepted': accepted});
  this.ws.send(json);
}

// function to pair player with an opponent
Player.prototype.pairWith = function(other) {
  this.opponent = other;
  other.opponent = this;
}

// function to send when player is paired with an opponent
Player.prototype.sendPairedMessage = function() {
  this.ws.send( JSON.stringify({'foundOpponent': true, 'yourTurn':this.turn}));
}

// dictionary pairing ids to players
var players = {};

// variable to store a waiting player
var waitingPlayer = null;

//////////////////////// Port, HTTP and Express Setup /////////////////////////

var port = process.argv[2];
var app = express();

app.use(express.static(__dirname + "/public"));

var server = http.createServer(app);

// create and open http server
var server = http.createServer(app);

// basic express routes
app.get("/splash", (req, res, next) => {
  res.sendFile("splash.html", {root: "./public"});
});

app.get("/game", (req, res, next) => {
  res.sendFile("game.html", {root: "./public"});
});

/////////////////////// WebSocket Initialization /////////////////////

// create WebSocket server using http server
var wsServer = new websocket.Server({ server });

wsServer.on('connection', function(ws) {
  
  // Set websocket to a Player object with a unique ID
  var newID = guidGenerator();
  ws.id = newID;
  var newPlayer = new Player(ws);
  players[newID] = newPlayer;

  // Send player ships to client
  newPlayer.sendShips();

  ///////////////// Messages from Client to Sever////////////////
  ws.on("message", function incoming(event) {
    var player = players[ws.id];

     // assume message is a JSON (rather low security)
     var message = JSON.parse(event);
    
     if (message) {

      // Message Recieved: Request for Player Ready status
      if (message.ships !== null) {
        let readyAccepted = player.ships.validPlacedMatch(message.ships);
        player.respondReadyRequest(readyAccepted);

        // If player is ready, try to pair player or set player to wait.
        if (readyAccepted) {

          // Start a new game between waiting player and new player
          if (waitingPlayer) {
            newPlayer.pairWith(waitingPlayer);

            let isNewPlayerTurn = firstPlayerTurn();
            newPlayer.turn = isNewPlayerTurn;
            waitingPlayer.turn = !isNewPlayerTurn;

            newPlayer.sendPairedMessage();
            waitingPlayer.sendPairedMessage();
            waitingPlayer = null;
          
          // if no player is waiting, this player has to wait
          } else {
            waitingPlayer = newPlayer;
          }
        }
      }

      // Message Received: Chosen Position
     } 

  });
});

/////////////////////////// Open the Server /////////////////////////////

server.listen(port, () => {
  console.log(`Server listening at port ${port}`);
});