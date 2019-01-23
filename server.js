"use strict";

const express = require("express");
const SocketServer = require("ws").Server;
const path = require("path");

const { Client } = require("pg");

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: true
});

const PORT = process.env.PORT || 3000;
const INDEX = path.join(__dirname, "index.html");

const server = express()
  .use((req, res) => {
    res.sendFile(INDEX);
    client.query(res);
  })
  .listen(PORT, () => console.log(`Listening on ${PORT}`));

const wss = new SocketServer({ server, clientTracking: true });

async function connectToDatabase() {
  await client.connect();
  var res = await client.query("SELECT * FROM ");
  res.rows.forEach(row => {
    console.log(row);
  });
}
wss.on("connection", function connection(ws, req) {
  connectToDatabase();
});

setInterval(() => {
  wss.clients.forEach(client => {
    let date = { text: new Date().toTimeString() };
    client.send(JSON.stringify(date));
    console.log("Sending message...");
  });
}, 1000);
