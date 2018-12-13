const express = require("express");
const http = require("http");
const websocket = require("ws");

///////////////// Data Structures and Helper Functions  ////////////////////////

// function to generate player id 
// (source: https://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid-in-javascript)
function guidGenerator() {
  var S4 = function() {
     return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
  };
  return (S4()+S4()+"-"+S4()+"-"+S4()+"-"+S4()+"-"+S4()+S4()+S4());
}

// randomly generate who gets the first turn.
function firstPlayerTurn() {
  return 0.5 < Math.random();
}

// check if two Cell objects are equal.
function equalCells(cell1, cell2) {
  return cell1.row === cell2.row && cell1.column === cell2.column;
}

// All ships of a given type to be placed by the player.
function Squadron(name, length, quantity) {
  this.name = name;
  this.shipLength = length;
  this.initNum = quantity;
  this.ships = [];
}

 function Fleet() {
  this.values = {
    aircraftCarrier: new Squadron("Aircraft Carrier", 5, 1),
    battleship: new Squadron("Battleship", 4, 1),
    cruiser: new Squadron("Cruiser", 3, 2),
    submarine: new Squadron("Submarine", 3, 1),
    destroyer: new Squadron("Destroyer", 2, 2)
   }
};

// function to check if Fleet object is a correct populated version of this one.
Fleet.prototype.validPlacedMatch = function(other) {  
  // ensure given fleet is a fleet with same number of shiptypes
  if (!other || Object.keys(this.values).length !== Object.keys(other).length)  {
    return false;
  }

  for (let key in this.values) {
    let thisSquadron = this.values[key];
    let otherSquadron = other[key];

    // ensure given squadron has correct name, ship quantity
    // and ship length attribute
    if (!otherSquadron ||
      otherSquadron.name !== thisSquadron.name ||
      otherSquadron.ships.length !== thisSquadron.initNum ||
      otherSquadron.shipLength !== thisSquadron.shipLength) {
      return false;
    }

    // ensure ships in squadron have correct length
    for (let i=0; i<thisSquadron.ships.length; i++) {
      console.log(otherSquadron.ships[i]);
      if (otherSquadron.ships[i].cells.length !== thisSquadron.shipLength) {
        return false;
      }
    }
  }

  return true;
}

// check if no ship cells are remaining (i.e. all ships sunk)
Fleet.prototype.cellsEmpty = function() {
  for (let key in this.values) {
    if (this.values[key].ships.length !== 0)
      return false;
  }
  return true;
}

// function to locate a cell in the ships, and remove from the relevant ship.
// returns "hit" if the cell was located, "sunk" if the cell was the last 
// of an array, "obliterated" if the cell was the last remaining, or "miss" otherwise
Fleet.prototype.attackCell = function(cell) {
  var result = {hit: false};

  for (let key in this.values) {
    let squadron = this.values[key], ship;

    for (let i=0; i<squadron.ships.length; i++) {
      ship = squadron.ships[i];

      for (let j=0; j<ship.cells.length; j++) {

        if ( equalCells(cell, ship.cells[j]) ) {
          // Found a match for the cell in ships! Remove cell
          ship.cells.splice(j, 1);

          // Now check if ship sunk
          if (ship.cells.length === 0) {
            squadron.ships.splice(i, 1);
            // Check if oppoenent obliterated
            if (this.cellsEmpty()) {
              result.obliterated = true;
            }
            result.sunk = true;
          }
          // return hit result
          result.hit = true;
          result.shipKey = key;
          return result;
        }

      }
    }
  }
  // return a miss if there are no matches
  return result;
}

// "class" for a player object.
function Player(ws){
  this.ws = ws;
  this.ready = false;
  this.turn = false;
  this.opponent = null;
  this.ships = new Fleet();
}

// function to pair player with an opponent
Player.prototype.pairWith = function(other) {
  this.opponent = other;
  other.opponent = this;
}

// function to send the Ships values to the client.
Player.prototype.sendInitParams = function() {
  var json = JSON.stringify({'ships': this.ships.values, 'width':boardWidth, 'height':boardHeight});
  this.ws.send(json);
}

// function to confirm or deny a ready request
Player.prototype.respondReadyRequest = function(accepted) {
  var json = JSON.stringify({'readyAccepted': accepted});
  this.ws.send(json);
}

// function to send when player is paired with an opponent
Player.prototype.sendNextTurnMessage = function() {
  this.ws.send( JSON.stringify({'yourTurn':this.turn}));
}

// function to send the status of player's last attack on opponent
Player.prototype.sendHitOpponentStatus = function(hitStatus) {
  this.ws.send(JSON.stringify({'hitOpponentStatus': hitStatus}));
}

// function to send the status of opponent's last attack on player
Player.prototype.sendHitSelfStatus = function(hitStatus, cell) {
  this.ws.send(JSON.stringify({'hitSelfStatus': hitStatus, 'cell': cell}));
}

// dictionary pairing ids to players
//var players = {};

// variable to store a waiting player
var waitingPlayer = null;

var boardWidth = 10; var boardHeight = 10;

//////////////////////// Port, HTTP and Express Setup /////////////////////////

var port = process.argv[2];
var app = express();

app.use(express.static(__dirname + "/public"));

// create and open http server
var server = http.createServer(app);

// basic express routes
app.get("/home(page)?", (req, res, next) => {
  res.sendFile("splash.html", {root: "./public"});
});

app.get("/game", (req, res, next) => {
  res.sendFile("game.html", {root: "./public"});
});

/////////////////////// WebSocket Initialization /////////////////////

// create WebSocket server using http server
var wsServer = new websocket.Server({ server });

wsServer.on('connection', function(ws) {
  
  console.log("websocket open");

  // Set websocket to a Player object with a unique ID
  //var newID = guidGenerator();
  //ws.id = newID;
  var player = new Player(ws);
  //players[newID] = player;

  // Send player ships to client
  player.sendInitParams();

  ///////////////// Messages from Client to Sever////////////////
  ws.on("message", function incoming(event) {
     // assume message is a JSON
     var message = JSON.parse(event);
    
     if (message) {

      // Message Recieved: Request for Player Ready status
      if (message.ships != undefined) {
        // Ensure ships have all been placed and not tampered with
        let readyAccepted = player.ships.validPlacedMatch(message.ships);
        player.respondReadyRequest(readyAccepted);

        // If player is ready, try to pair player or set player to wait.
        if (readyAccepted) {
          player.ready = true;

          // replace default ship values with placed ship values
          player.ships.values = message.ships;

          // Start a new game between waiting player and new player
          if (waitingPlayer) {
            player.pairWith(waitingPlayer);

            let isNewPlayerTurn = firstPlayerTurn();
            player.turn = isNewPlayerTurn;
            waitingPlayer.turn = !isNewPlayerTurn;

            player.sendNextTurnMessage();
            waitingPlayer.sendNextTurnMessage();
            waitingPlayer = null;
          
          // if no player is waiting, this player has to wait
          } else {
            waitingPlayer = player;
          }
        }
      }

      // Message Received: Chosen Position
      else if (message.cellAttacked != undefined && player.turn) {
        // find out what attacking the cell does, and send to both players
        var hitStatus = player.opponent.ships.attackCell(message.cellAttacked);
        console.log(hitStatus);
        player.sendHitOpponentStatus(hitStatus);
        player.opponent.sendHitSelfStatus(hitStatus, message.cellAttacked);

        // swap which player's turn it is and start next turn
        player.turn = !player.turn;
        player.opponent.turn = !player.opponent.turn;
        player.sendNextTurnMessage();
        player.opponent.sendNextTurnMessage();
      }

     }

     // [Experimental code for disconnecting from a game]
     ws.on("close", function () {
      console.log("WebSocket closed.");

      // check if player was ready
      if (player.ready) {
        // if the player was playing with an opponent
        if (player.opponent) {
          // [Terminate game code here]
          player.opponent.opponent = null;
        } else {
          // If this player was ready but not playing, they were waiting
          // so set waiting player to null
          waitingPlayer = null;
        }
      }

      // ignore messages from the closed websocket
      ws.on("message", () => {});
     });

  });
});

/////////////////////////// Open the Server /////////////////////////////

server.listen(port, () => {
  console.log(`Server listening at port ${port}`);
});