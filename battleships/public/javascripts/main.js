
var main = function() {
    "use strict";

    ////////////////////// WebSocket Initialization ////////////////////

    // use built-in websocket for mozilla
    window.WebSocket = window.WebSocket || window.MozWebSocket;

    // find location of server to open websocket
    var new_uri = "ws://" + window.location.host;
    new_uri += window.location.pathname + "/to/ws";

    // open connection to server
    var socket = new WebSocket(new_uri);

    // function to call when websocket connection is open.
    socket.onopen = function() {
        console.log("connection to server opened");
    };

    //////////////// Module: Client-Side Data for Gameplay ///////////////
    var gameDataModule = ( function() {

        // game data about player boards (fetched from server)
        var board = {
            width: 0,
            height: 0,
        };
        
        // data about player ships - initial value fetched from server
        var ships = {};

        return {
            // object to represent board cell
            Cell: function(row, column) {
                this.row = row;
                this.column = column;
            },

            // public object to encapsulate board
            gameBoard: {
                setSize: function(width, height) {
                    board.width = width;
                  	board.height = height;
                },
                getWidth: () => {return board.width;},
                getHeight: () => {return board.height;}
            },
            
            // ship manipulation
            getShips: () => {return ships;},

            setShips: (newShips) => {ships = newShips;},

            forEachShipKey: function(callback) {
                for (let key in ships) {
                    callback(key);
                }
            },

            getShip: (key) => {return ships[key];},
        };
    })();

    ////////////// Module: Sending Messages to Server ///////////////////

    // Requires the Web Socket and gameData (for ships)
    var sendToServerModule = ( function(socket, gameData) {
        return {

            // send a Cell to the server to represent the player's move
            attackOpponentCell: function($cell) {
                var cellObject = new gameData.Cell($cell.attr("row"), $cell.attr("column"));
                socket.send( JSON.stringify({"cellAttacked": cellObject}) );
            },
            
            // send the ships to the server to indicate that the player is ready
            playerReady: function() {
                socket.send( JSON.stringify({"ships": gameData.getShips() }) );
            }
        };
    })(socket, gameDataModule);

    //////////////// Module: Game State Variables and Functions ////////////////

    // Requires sendToServer module for enabling Ready button and attacking opponent board
    var gameStateModule = ( function (sendToServer) {

        // most recent cell selected on the opponent board
        var $selectedOppCell;
        return {

            // opponent cell selected by player
            selectOppCell: function($cell) {
                $selectedOppCell = $cell;
            },

            // modify a cell when attacked depending on the consequence of the attack
            handleCellAttacked: function($cell, status, onMiss, onHit, onSunk, onObliterated) {
                $cell.removeClass("default");

                if (status.hit) {
                    $cell.addClass("hit");
                    onHit(status.shipKey);

                    if (status.sunk) {
                        onSunk(status.shipKey);
                        if (status.obliterated) {
                            onObliterated(status.shipKey);
                        }
                    }
                }

                else {
                    $cell.addClass("miss");
                    onMiss();
                }
            },

            handleOppCellAttacked: function(status, onMiss, onHit, onSunk, onObliterated) {
                this.handleCellAttacked($selectedOppCell, status, onMiss, onHit, onSunk, onObliterated);
            },

            // function to set everything to ready-to-start status
            setPlayerReady: function() {
                $("#ready-button").hide();
                $("#ship-pallet").hide();
                $("#player-board .cell").off("click");
                $("#message p").text("Waiting for another player...");
            },

            // function to inform the player if the ready request was denied
            onReadyRequestDenied: function() {
                window.alert("Have you placed all your ships?");
            },

            // function to indicate the start of the next turn
            nextTurn: function(myTurn) {        
                if (myTurn) {
                    $("#message p").text("Choose an opponent square to attack");
                    this.attackEnabled(true);
                } else {
                    $("#message p").text("Opponent's turn...");
                    this.attackEnabled(false);
                }
            },

            // function to set the enable of the ready button
            readyButtonEnabled: function(value) {
                if (value) {
                    $("#ready-button").click((event) => {
                        sendToServer.playerReady();
                    });
                } else {
                    $("#ready-button").off("click");
                }
            },

            // function to set the enable of attacking the opponent 
            attackEnabled: function(value) {
                if (value) {
                    $("#opponent-board .cell").click((event) => {
                        var $cell = $(event.currentTarget);
                        //don't bother sending request if cell has already been attacked
                        if (!$cell.hasClass("miss") && !$cell.hasClass("hit")) {
                            this.selectOppCell($cell);
                            sendToServer.attackOpponentCell( $(event.currentTarget) );
                        }
                    });
                } else {
                    $("#opponent-board .cell").off("click");
                }
            }
        };
    })(sendToServerModule);

    ////////////////// Module: Domain Object Model Setup /////////////////////

    // relies on gameData Module for ships
    var generateDOMModule = (function (gameData) {

        return {
            // generate boards made up from divs
            board: function(width, height) {
                var board = $("<div>").addClass("board");
                board.attr("width", width);
                board.attr("height", height);
        
                var rowDiv;
                var el;
                for (let row=0; row<height; row++) {
                    rowDiv = $("<div>").addClass("row");
                    for(let column=0; column<width; column++) {
                        el = $("<div>").addClass("cell").addClass("default");
                        el.attr("row", row);
                        el.attr("column", column);
                        rowDiv.append(el);
                    }
                    board.append(rowDiv);
                }
        
                return board;
            },

            // generate ship radio buttons
            shipRadioButtons: () => {
                gameData.forEachShipKey((key) => {
                    let ship = gameData.getShip(key);
                    let input = $("<input>");
                    input.attr("type", "radio").attr("name", "ships").attr("value", key);

                    let label = $("<label>").attr("id", key);
                    label.append(input).append(ship.name);
                    label.append(" (<span class=quantity>" + ship.unplaced + "</span>) ");

                    $("#ship-pallet").append(label);
                });
            }
        };
    })(gameDataModule);

    ///////////////// Module: Ship Placement by Player ////////////////

    // Relies on gameData module for ships
    var shipPlacementModule = ( function(gameData) {

        // constructs an array of cells from cell to cell + horizontal steps
        var cellHorizontalArray = function($cell, steps) {
            var cells = [];
    
            for (let i=0; i<steps; i++) {
                cells.push($cell[0]);
                $cell = $cell.next();
            }
            return cells;
        };
    
        // constructs an array of cells from cell to cell + vertical steps
        var cellVerticalArray = function($cell, steps) {
            var cells = [];
    
            var $row = $cell.parent();
            for (let i=0; i<steps; i++) {
                cells.push($cell[0]);
    
                $row = $row.next();
                $cell = $row.children("[column='" + $cell.attr("column") + "']");
            }
    
            return cells;
        };
    
        // function to check if one or more cells in an array contain a ship.
        var containsShip = function(cells) {
            for (let i=0; i<cells.length; i++) {
                if ($(cells[i]).hasClass("ship")) {
                    return true;
                }
            }
            return false;
        };
    
        // function to set a ship at all cells in the given array.
        var setShip = function(cells) {
            cells.forEach( (cell) => {
                $(cell).removeClass("default").addClass("ship");
            });
        };
        
        // function to construct an array of Cell objects from an array of cell DOM elements
        var toCellObjectArray = function(DOMCells) {
            var cellObjects = [];
            var row; var column;
            DOMCells.forEach((cell => {
                row = $(cell).attr("row");
                column = $(cell).attr("column");
                cellObjects.push(new gameData.Cell(row, column));
            }));
            return cellObjects;
        };
        
        return {
            placePlayerShips: function() {
                // add a ship to the player board when the board is clicked
                $("#player-board .cell").click((event) => {

                    let $cell = $(event.currentTarget);
                    let shipKey = $("#ship-pallet input[name=ships]:checked").val();
                    let rotated = $("#ship-pallet input[name=rotate]:checked").val();
                    let ship = gameData.getShip(shipKey);
            
                    // ensure ship has been selected and ships of that type are left
                    if (ship && ship.unplaced > 0) {
            
                        // ensure ship fits horizontally or vertically
                        var horizontalFit = !rotated && 
                  					( Number($cell.attr("column")) + ship.length ) <=
                            gameData.gameBoard.getWidth();
                            
                        var verticalFit = rotated && 
                  					( Number($cell.attr("row")) + ship.length ) <=
                  					gameData.gameBoard.getHeight();
            
                        if (horizontalFit || verticalFit) {
            
                            var cellArray;
                            if (horizontalFit) {
                                cellArray = cellHorizontalArray($cell, ship.length);
            
                            } else {
                                cellArray = cellVerticalArray($cell, ship.length);
                            }
                            
                            if (!containsShip(cellArray)) {
                                ship.cells.push( toCellObjectArray(cellArray) );
                                setShip(cellArray);
                                ship.unplaced -= 1;
                                $("#ship-pallet #" + shipKey + " .quantity").text(ship.unplaced);
                            }
                        }
                    }
                });
            }
        };
    })(gameDataModule);

    ////////////////// Recieving Messages from Server ////////////////

    // Server Messages //
    socket.onmessage = function(event) {

        // assume that message is a JSON string
        var message = JSON.parse(event.data);

        if (message) {
            
            // Receive Message: Game Init Variables
            if (message.ships != undefined) {
                gameDataModule.setShips(message.ships);
                generateDOMModule.shipRadioButtons();
                // generate the boards
                $(".board-parent").append( generateDOMModule.board(message.width, message.height) );
                gameDataModule.gameBoard.setSize(message.width, message.height);
                // allow user to place ships
                shipPlacementModule.placePlayerShips();
                gameStateModule.readyButtonEnabled(true);
            }

            // Receive Message: Ready Request Response
            else if (message.readyAccepted != undefined) {
                if (message.readyAccepted) {
                    gameStateModule.setPlayerReady();
                } else {
                    gameStateModule.onReadyRequestDenied();
                }
            }

            // Receive Message: Next Turn
            else if (message.yourTurn != undefined) {
                gameStateModule.nextTurn(message.yourTurn);
            }

            // Note: replace with on-screen messages
            // Receive Message: Opponent has been hit
            else if (message.hitOpponentStatus != undefined) {
                gameStateModule.handleOppCellAttacked(message.hitOpponentStatus,
                    () => {console.log("You missed the opponent ships.")},
                    (key) => {console.log("You hit the opponent's " + gameDataModule.getShip(key).name + "!")},
                    (key) => {console.log("You sunk the opponent's " + gameDataModule.getShip(key).name + "!");},
                    (key) => {console.log("Your opponent has been obliterated!!");});
            }

            // Receive Message: Player has been hit
            else if (message.hitSelfStatus != undefined) {
                let $cellAttacked = $(
                    `#player-board [row="${message.cell.row}"][column="${message.cell.column}"]`
                );
                gameStateModule.handleCellAttacked($cellAttacked, message.hitSelfStatus, 
                    () => {console.log("Opponent missed your ships.");},
                    (key) => {console.log("Your " + gameDataModule.getShip(key).name + " has been hit!");},
                    (key) => {console.log("Your " + gameDataModule.getShip(key).name + " has been sunk.");},
                    (key) => {console.log("You have been defeated.");});
            }
        }
    };
};

$(document).ready(main);