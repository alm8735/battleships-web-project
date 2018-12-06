

var main = function() {
    "use strict";

    var ships = {
        
        "5-block-ship": {
            unplaced: 2,
            places: []
        },

        "4-block-ship": {
            unplaced: 2,
            places: []
        },

        "3-block-ship": {
            unplaced: 2,
            places: []
        },

        "2-block-ship": {
            unplaced: 2,
            places: []
        },

        "1-block-ship": {
            unplaced: 2,
            places: []
        }
    };

    // function to check if ships are all placed
    var shipsPlaced = function() {
        for (let key in ships) {
            if (ships[key].unplaced > 0) {
                return false;
            }
        }
        return true;
    }

    // generate boards made up from divs
    var generateBoard = function(width, height) {
        var board = $("<div>");

        var rowDiv;
        var el;
        for (let row=0; row<height; row++) {
            rowDiv = $("<div>");
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

    $(".board").prepend( generateBoard(9, 9) );

    // generate ship radio buttons
    for(let key in ships) {
        let ship = ships[key];
        let i = $("<input>").attr("type", "radio").attr("name", "ships").attr("value", true);
        let l = $("<label>").text(key);
        l.append( $("<span>").text(" ("+ship.unplaced+") ").addClass("quantity") );
        l.append(i);
        $("#ship-pallet").append(l);
    }

    // hide ready button and change status to ready when clicked
    $("#ready-button").click((event => {
        if (!shipsPlaced()) {
            window.alert("Please place all of your ships.");
        } else {
            $(event.currentTarget).hide();
            $("#ship-pallet").hide();
            $("#message").text("Waiting for opponent to be ready...");
        }
    }));

    // check when the opponent's board is clicked
    $("#opponent-board .cell").click((event) => {
        let $cell = $(event.currentTarget);
        window.alert($cell.attr("row") + ", " + $cell.attr("column"));
    });
};

$(document).ready(main);