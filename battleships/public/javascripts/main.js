// ships to be placed by the player. Sent to server on ready signal.
var ships = {
    
    aircraftCarrier: {
        name: "Aircraft Carrier",
        length: 5,
        unplaced: 1,
        places: []
    },

    battleship: {
        name: "Battleship",
        length: 4,
        unplaced: 2,
        places: []
    },

    cruiser: {
        name: "Cruiser",
        length: 3,
        unplaced: 1,
        places: []
    },

    submarine: {
        name: "Submarine",
        length: 3,
        unplaced: 2,
        places: []
    },

    destroyer: {
        name: "Destroyer",
        length: 2,
        unplaced: 2,
        places: []
    }
};

var main = function() {
    "use strict";

    // generate the boards
    $(".board-parent").append( generateBoard(10, 10) );

    // allow the user to place ships and indicate when they are ready to begin
    shipPlacement();
};


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
    

var shipPlacement = function() {

    // function to check if ships are all placed
    var shipsPlaced = function() {
        for (let key in ships) {
            if (ships[key].unplaced > 0) {
                return false;
            }
        }
        return true;
    }

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

    // generate ship radio buttons
    for (let key in ships) {
        let ship = ships[key];
        let input = $("<input>")
        input.attr("type", "radio").attr("name", "ships").attr("value", key);

        let label = $("<label>").attr("id", key);
        label.append(input).append(ship.name);
        label.append(" (<span class=quantity>" + ship.unplaced + "</span>) ");

        $("#ship-pallet").append(label);
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

    // hide ready button, turn off clicks for player board and change status to ready when clicked
    $("#ready-button").click((event => {
        if (!shipsPlaced()) {
            window.alert("Please place all of your ships.");
        } else {
            $(event.currentTarget).hide();
            $("#ship-pallet").hide();
            $("#player-board .cell").off('click');
            $("#message").text("Waiting for opponent to be ready...");
            
            // start up the web sockets!
            gameplay();
        }
    }));
}

var gameplay = function() {
    // use built-in websocket for mozilla
    window.WebSocket = window.WebSocket || window.MozWebSocket

    // find location of server to open websocket to
    var loc = window.location, new_uri;
    if (loc.protocol === "https:") {
        new_uri = "wss:";
    } else {
        new_uri = "ws:";
    }
    new_uri += "//" + loc.host;
    new_uri += loc.pathname + "/to/ws";

    // open connection to server
    var connection = new WebSocket(new_uri);

    // function to call when websocket connection is open.
    connection.onopen = function() {
        console.log("connection to server opened");
    }


}


$(document).ready(main);