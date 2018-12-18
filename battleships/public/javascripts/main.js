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
        var fleet = {};

        return {
            // object to represent board cell
            Cell: function(row, column) {
                this.row = row;
                this.column = column;
            },

            // A basic player Ship object
            Ship: function(cells, adjCells) {
                this.cells = cells;
                this.adjacentCells = adjCells;
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
            getFleet: () => {return fleet;},

            setFleet: (newFleet) => {fleet = newFleet;},

            forEachSquadron: function(callback) {
                for (let key in fleet) {
                    callback(key);
                }
            },

            getSquadron: (key) => {return fleet[key];},
        };
    })();

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
                gameData.forEachSquadron((key) => {
                    let squadron = gameData.getSquadron(key);
                    let input = $("<input>");
                    input.attr("type", "radio").attr("name", "ships").attr("value", key);

                    let label = $("<label>").attr("id", key);
                    label.append(input).append(squadron.name);
                    label.append(" (<span class=quantity>" + squadron.initNum + "</span>) ");

                    $("#ship-pallet").append(label);
                });
            }
        };
    })(gameDataModule);

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
                socket.send( JSON.stringify({"ships": gameData.getFleet() }) );
            }
        };
    })(socket, gameDataModule);

    //////////////// Module: Game State Variables and Functions ////////////////

    // Requires sendToServer module for enabling Ready button and attacking opponent board
    var gameStateModule = ( function (sendToServer) {

        // most recent cell selected on the opponent board
        var $selectedOppCell;
        return {

            // function to set everything to ready-to-start status
            setPlayerReady: function() {
                this.readyButtonEnabled(false);
                $("#ship-pallet").hide();
                $("#player-board .cell").off("click");
                $("#main-message").text("Waiting for another player...");
            },

            // function to inform the player if the ready request was denied
            onReadyRequestDenied: function() {
                window.alert("Have you placed all your ships?");
            },

            // function to indicate the start of the next turn
            nextTurn: function(myTurn) {        
                if (myTurn) {
                    $("#main-message").text("Choose an opponent square to attack");
                    this.attackEnabled(true);
                } else {
                    $("#main-message").text("Opponent's turn...");
                    this.attackEnabled(false);
                }
            },

            // function to set the enable of the ready button
            readyButtonEnabled: function(value) {
                if (value) {
                    $("#ready-button").show().click((event) => {
                        sendToServer.playerReady();
                    });
                } else {
                    $("#ready-button").hide().off("click");
                }
            },

            // function to set the enable of attacking the opponent 
            attackEnabled: function(value) {
                if (value) {
                    $("#opponent-board .cell").click((event) => {
                        console.log("clicked enemy board");
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
            },

            // opponent cell selected by player
            selectOppCell: function($cell) {
                $selectedOppCell = $cell;
            },

            // modify a cell when attacked depending on the consequence of the attack
            handleCellAttacked: function($cell, status, onMiss, onHit, onSunk, onObliterated) {
                var $adjCell;

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
            }
        };
    })(sendToServerModule);

    ///////////////// Module: Ship Placement by Player ////////////////

    // Relies on gameData module for ships
    var shipPlacementModule = ( function(gameData) {

        // gets the cell above the given cell.
        var above = function($cell) {
            if ($cell.attr("row") == 0) 
                return undefined;
            return $cell.parent().prev().children("[column='" + $cell.attr("column") + "']");
        }

        // gets the cell below the given cell
        var below = function($cell) {
            return $cell.parent().next().children("[column='" + $cell.attr("column") + "']");
        }

        // attr("row"), getHeight(), getWidth(), below(), above(), .next()

        // this is going to need LOTS of commenting.

        var findShipCells = function(isVertical, $firstCell, firstIdx, shipLength) { //Creating a variable which is equal to the 4 functions

            var shipBreadthPos, boardLength, boardBreadth, forward, back, right, left; //6 variables created

            if (!isVertical) { //if condition (is not vertical)
                shipBreadthPos = $firstCell.attr("row"); // variable shipBreadthPos calls to the method firstcell to return the attribute row
                boardLength = gameData.gameBoard.getWidth();
                boardBreadth = gameData.gameBoard.getHeight();
                forward = function($cell) {return $cell.next();};
                back = function($cell) {return $cell.prev();};
                right = below;
                left = above;
            }
            else {
                shipBreadthPos = $firstCell.attr("column");
                boardLength = gameData.gameBoard.getHeight();
                boardBreadth = gameData.gameBoard.getWidth();
                forward = below;
                back = above;
                right = function($cell) {return $cell.next();};
                left = function($cell) {return $cell.prev();};
            }

            var cellArrays = {ship: [], adj: []};

            var $cell, $port, $starboard, i, endIdx;
            
            // set initial cell value and index
            if (firstIdx === 0) {
                $cell = $firstCell, i = 0;
            } else {
                $cell = back($firstCell), i = -1;
            }

            // set initial values for cells port and starboard of current cell
            if (shipBreadthPos == boardBreadth - 1) {
                $port = left($cell), $starboard = null;
            } else if (shipBreadthPos == 0) {
                $port = null, $starboard = right($cell);
            } else {
                $port = left($cell), $starboard = right($cell);
            }

            // return if final index is out of range
            if (firstIdx + shipLength > boardLength) {
                return null;
            }

            if (firstIdx + shipLength === boardLength) {
                endIdx = shipLength;
            } else {
                endIdx = shipLength + 1;
            }

            for (; i < endIdx; i++) {
                
                // return if there is a ship inside the boundaries of this ship 
                if ($cell.hasClass("ship") || 
                    ($port && $port.hasClass("ship")) || 
                    ($starboard && $starboard.hasClass("ship"))) {
                    return null;
                }

                if (i < 0 || i >= shipLength) {
                    cellArrays.adj.push($cell);
                } else {
                    cellArrays.ship.push($cell);
                }
                $cell = forward($cell);

                if ($port) {
                    cellArrays.adj.push($port);
                    $port = forward($port);
                }
                if ($starboard) {
                    cellArrays.adj.push($starboard);
                    $starboard = forward($starboard);
                }
            }

            return cellArrays;
        }

        // function to set a ship at all cells in the given array.
        var setToShipCells = function($cells) {
            $cells.forEach( ($cell) => {
                $cell.removeClass("default").addClass("ship");
            });
        };

        // function to set cells adjacnt to ship at all cells in the given array.
        var setToShipAdjCells = function($cells) {
            $cells.forEach(($cell) => {
                $cell.removeClass("default").addClass("adjacent");
            });
        }
        
        // function to construct an array of Cell objects from an array of jquery cells
        var toCellObjectArray = function($cells) {
            var cellObjects = [];
            var row; var column;
            $cells.forEach(($cell => {
                row = $cell.attr("row");
                column = $cell.attr("column");
                cellObjects.push(new gameData.Cell(row, column));
            }));
            return cellObjects;
        };
        
        return {

            // adds a ship to the player board when the board is clicked
            placePlayerShips: function() {
                $("#player-board .cell").click((event) => {
                    
                    var t = new Date().getTime();

                    // find user input parameters (cell, ship type, ship rotation)
                    var $cell = $(event.currentTarget),
                    key = $("#ship-pallet input[name=ships]:checked").val(),
                    isVertical = $("#ship-pallet input[name=rotate]:checked").val();

                    // find objects relevant to ship type (ship squadron, ship quantity)
                    var squadron = gameData.getSquadron(key),
                    $shipQuantity = $("#ship-pallet #" + key + " .quantity"),
                    unplaced = Number($shipQuantity.text());
                    
                    // variables to calculate
                    var shipFirstIdx, cellArrays, newShip;

                    // ensure a ship type with unplaced ships is selected
                    if (squadron && unplaced > 0) {
                        
                        shipFirstIdx = isVertical ? Number($cell.attr("row")) : Number($cell.attr("column"));
                        cellArrays = findShipCells(isVertical, $cell, shipFirstIdx, squadron.shipLength);
                                                        
                        // ensure the arrays are valid
                        if (cellArrays) {
                            // add the new ship in data and in HTML
                            newShip = new gameData.Ship( 
                                toCellObjectArray(cellArrays.ship),
                                toCellObjectArray(cellArrays.adj));
                            squadron.ships.push(newShip);
                            setToShipCells(cellArrays.ship);
                            setToShipAdjCells(cellArrays.adj);
                            // reduce counter
                            unplaced -= 1;
                            $shipQuantity.text(unplaced);
                        }
                    }
                    console.log(new Date().getTime() - t);
                });
            }
        };
    })(gameDataModule);

    ////////////////// Recieving Messages from Server ////////////////

    // Server Messages //
    socket.onmessage = function(event) {

        // assume that message is a JSON string
        var message = JSON.parse(event.data);

        var $hitOppMessage = $("#hit-opp-message"),
            $hitSelfMessage = $("#hit-self-message"), 
            $cellAttacked;

        if (message) {
            
            // Receive Message: Game Init Variables
            if (message.ships != undefined) {
                gameDataModule.setFleet(message.ships);
                $('#ship-pallet [name="ships"]').remove();
                generateDOMModule.shipRadioButtons();
                $("#ship-pallet").show();
                // generate the boards
                $(".board").remove();
                $(".board-parent").append( generateDOMModule.board(message.width, message.height) );
                gameDataModule.gameBoard.setSize(message.width, message.height);
                // allow user to place ships
                shipPlacementModule.placePlayerShips();
                gameStateModule.readyButtonEnabled(true);
                $("#hit-self-message").text("");
                $("#hit-opp-message").text("");
                $("#main-message").text('Place your ships and click "Ready" when you are done.');
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

            // Receive Message: Opponent has been hit
            else if (message.hitOpponentStatus != undefined) {
                gameStateModule.handleOppCellAttacked(message.hitOpponentStatus,
                    () => {
                        $hitOppMessage.text("You missed the opponent ships.");
                    },
                    () => {
                        $hitOppMessage.text("You hit an opponent ship!");
                    },
                    (key) => {
                        $hitOppMessage.text("You sunk the opponent's " + gameDataModule.getSquadron(key).name + "!");
                        message.hitOpponentStatus.adjacentCells.forEach((cellObj) => {
                            let $c = $(`#opponent-board [row="${cellObj.row}"][column="${cellObj.column}"]`);
                            $c.addClass("miss");
                        });
                    },
                    () => {
                        window.alert("Congratulations, you won!");
                });
            }

            // Receive Message: Player has been hit
            else if (message.hitSelfStatus != undefined) {
                $cellAttacked = $(
                    `#player-board [row="${message.cell.row}"][column="${message.cell.column}"]`
                );
                gameStateModule.handleCellAttacked($cellAttacked, message.hitSelfStatus, 
                    () => {
                        $hitSelfMessage.text("The opponent missed your ships.");
                    },
                    (key) => {
                        $hitSelfMessage.text("Your " + gameDataModule.getSquadron(key).name + " has been hit!");
                    },
                    (key) => {
                        $hitSelfMessage.text("Your " + gameDataModule.getSquadron(key).name + " has been sunk.");
                        message.hitSelfStatus.adjacentCells.forEach((cellObj) => {
                            let $c = $(`#player-board [row="${cellObj.row}"][column="${cellObj.column}"]`);
                            $c.addClass("miss");
                        });
                    },
                    () => {
                        window.alert("You have been defeated.");
                });
            }
        }
    };
};

$(document).ready(main);
