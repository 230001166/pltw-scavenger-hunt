"use strict";

const express = require("express");
const SocketServer = require("ws").Server;
const path = require("path");

const PORT = process.env.PORT || 3000;
const INDEX = path.join(__dirname, "index.html");

const server = express()
  .use((req, res) => res.sendFile(INDEX))
  .listen(PORT, () => console.log(`Listening on ${PORT}`));

const wss = new SocketServer({ server, clientTracking: true });

wss.on("connection", function connection(ws, req) {

});

setInterval(() => {
  wss.clients.forEach((client) => {
    let date = { text: new Date().toTimeString() };
    client.send(JSON.stringify (date)); console.log ("Sending message...");
  });
}, 1000);
