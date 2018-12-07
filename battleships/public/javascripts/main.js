
var main = function() {
    "use strict";

    //////////////////////// Client-Side Game Data /////////////////////

    // variable to save whether player is ready and waiting to start
    var playerReady = false;

    // variable to save whether the game has commenced
    var gameCommenced = false;

    var playerTurn = false;
    
    var ships = {};

    var selectedOpponentSquare;

    //////////////////// Server-Independent Processing ////////////////

    // generate boards made up from divs
    var generateBoard = function(width, height) {
        var board = $("<div>").addClass("board");
        board.attr("width", width);
        board.attr("height", height);

        var rowDiv;
        var el;
        for (let row=0; row<height; row++) {
            rowDiv = $("<div>").addClass("row");
            for(let column=0; column<width; column++) {
                el = $("<div>").addClass("cell");
                el.attr("row", row);
                el.attr("column", column);
                rowDiv.append(el);
            }
            board.append(rowDiv);
        }

        return board;
    }

    // generate the boards
    $(".board-parent").append( generateBoard(10, 10) );

    // Processing to set ship positions
    var placeShips = function() {

        // constructs an array of cells from cell to cell + horizontal steps
        var cellHorizontalArray = function($cell, steps) {
            var cells = [];
    
            for (let i=0; i<steps; i++) {
                cells.push($cell[0]);
                $cell = $cell.next();
            }
            return cells;
        }
    
        // constructs an array of cells from cell to cell + vertical steps
        var cellVerticalArray = function($cell, steps) {
            var cells = [];
    
            var $row = $cell.parent();
            for (let i=0; i<steps; i++) {
                cells.push($cell[0]);
    
                $row = $row.next();
                $cell = $row.children("[column='" + $cell.attr("column") + "']")
            }
    
            return cells;
        }
    
        // function to check if one or more cells in an array contain a ship.
        var containsShip = function(cells) {
            for (let i=0; i<cells.length; i++) {
                if ($(cells[i]).hasClass("ship")) {
                    return true;
                }
            }
            return false;
        }
    
        // function to set a ship at all cells in the given array.
        var setShip = function(cells) {
            cells.forEach( (cell) => {
                $(cell).addClass("ship");
            });
        }
    
        // add a ship to the player board when the board is clicked
        $("#player-board .cell").click((event) => {
            let $cell = $(event.currentTarget);
            let shipKey = $("#ship-pallet input[name=ships]:checked").val();
            let rotated = $("#ship-pallet input[name=rotate]:checked").val();
            let ship = ships[shipKey];
    
            // ensure ship has been selected and ships of that type are left
            if (ship && ship.unplaced > 0) {
    
                // ensure ship fits horizontally or vertically
                var horizontalFit = !rotated && Number($cell.attr("column")) + ship.length <= $cell.closest(".board").attr("width");
                var verticalFit = rotated && Number($cell.attr("row")) + ship.length <= $cell.closest(".board").attr("height");
    
                if (horizontalFit || verticalFit) {
    
                    var cellArray;
                    if (horizontalFit) {
                        cellArray = cellHorizontalArray($cell, ship.length);
    
                    } else {
                        cellArray = cellVerticalArray($cell, ship.length);
                    }
                    
                    if (!containsShip(cellArray)) {
                        ship.places.push(cellArray);
                        setShip(cellArray);
                        ship.unplaced -= 1;
                        $("#ship-pallet #" + shipKey + " .quantity").text(ship.unplaced);
                    }
                }
            }
        });
    }

    placeShips();

    ////////////////////// WebSocket Initialization ////////////////////

    // use built-in websocket for mozilla
    window.WebSocket = window.WebSocket || window.MozWebSocket

    // find location of server to open websocket to
    var loc = window.location, new_uri;
    new_uri = "ws://" + loc.host;
    new_uri += loc.pathname + "/to/ws";

    // open connection to server
    var socket = new WebSocket(new_uri);

    // function to call when websocket connection is open.
    socket.onopen = function() {
        console.log("connection to server opened");
    }

    ////////////////// Recieving Messages from Server ////////////////

    // generate ship radio buttons
    var generateRadioButtons = function() {
        for (let key in ships) {
            let ship = ships[key];
            let input = $("<input>")
            input.attr("type", "radio").attr("name", "ships").attr("value", key);

            let label = $("<label>").attr("id", key);
            label.append(input).append(ship.name);
            label.append(" (<span class=quantity>" + ship.unplaced + "</span>) ");

            $("#ship-pallet").append(label);
        }
    }

    // function to set everything to ready-to-start status
    var setPlayerReady = function() {
        $("#ready-button").hide();
        $("#ship-pallet").hide();
        $("#player-board .cell").off('click');
        $("#message p").text("Waiting for another player...");
        playerReady = true;
    }

    // function to inform the player if the ready request was denied
    var onReadyRequestDenied = function() {
        window.alert("Have you placed all your ships?");
    }

    // function to kick off game
    var startGame = function(myTurn) {
        gameCommenced = true;
        playerTurn = myTurn;
        
        if (playerTurn) {
            $("#message p").text("Choose an opponent square to attack");
            enableOpponentSquare();
        } else {
            $("#message p").text("Opponent's turn...");
        }

    }

    // Server Messages //
    socket.onmessage = function(event) {

        // assume that message is a JSON string
        var message = JSON.parse(event.data);
        console.log("Message:", message);

        if (message) {
            
            // Receive Message: Player Ships
            if (message.ships != undefined) {
                console.log("Received ships");
                ships = message.ships;
                generateRadioButtons();
            }

            // Receive Message: Ready Request Response
            else if (message.readyAccepted != undefined) {
                console.log("Accepted: ", message.readyAccepted);
                if (message.readyAccepted) {
                    setPlayerReady();
                } else {
                    onReadyRequestDenied();
                }
            }

            // Receive Message: Found Opponent
            else if (message.foundOpponent != undefined && message.foundOpponent) {
                startGame(message.yourTurn);
            }

        }
        // Message: Found opponent

        // Message: your go

        // Message: Sunk opponent ship
        // Message: Hit opponent ship
        // Message: Missed opponent ship

        // Message: Sunk your ship
        // Message: Hit your ship
        // Message: Missed your ship

        // Message: Player has won
        // Message: Player has lost
    }

    //////////////////// Sending Messages to Server ///////////////////

    // send request to server to set player as ready to play
    $("#ready-button").click((event => {
        socket.send( JSON.stringify({'ships': ships}) );
    }));

    function enableOpponentSquare() {
        $("#opponent-board .cell").click((event) => {
            var $cell = $(event.currentTarget);
            //if (playerTurn) {
                window.alert(`Attacked Opponent Square (${$cell.attr("row")}, ${$cell.attr("column")})`);
            //}
        });
    }

    function disableOpponentSquare() {
        $("#opponent-board .cell").off('click');
    }
};

$(document).ready(main);