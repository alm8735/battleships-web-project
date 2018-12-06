const express = require("express");
const http = require("http");

var port = process.argv[2];
var app = express();

app.use(express.static(__dirname + "/public"));
http.createServer(app).listen(port, () => {
  console.log(`Server listening at port ${port}`);
});

app.get("/splash", (req, res, next) => {
  res.sendFile("splash.html", {root: "./public"});
});

app.get("/game", (req, res, next) => {
  res.sendFile("game.html", {root: "./public"});
});