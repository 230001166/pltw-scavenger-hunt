"use strict";

const express = require("express");
const SocketServer = require("ws").Server;
const path = require("path");

const { Pool } = require('pg');
const databaseURL = "postgres://ygtyyztixuudtg:340b1f0f67757392f02c164d941abd57cdca4321f06da7df8a5741837976e335@ec2-54-225-227-125.compute-1.amazonaws.com:5432/d4trt296637p42";

const pool = new Pool({
  connectionString: databaseURL,
  ssl: true
});

const PORT = process.env.PORT || 3000;
const INDEX = path.join(__dirname, "index.html");

const server = express()
  .use((req, res) => res.sendFile(INDEX) )
  .get('/', (req, res) => res.render('pages/index'))
  .listen(PORT, () => console.log(`Listening on ${PORT}`));

const wss = new SocketServer({ server, clientTracking: true });

pool.connect(function (err, client, done) {
  console.log(err+"!");
 client.query('SELECT * FROM spot_table.name', function(err, result) {
   done();
   if(err) return console.error(err);
   console.log(result.rows);
 });
});

wss.on("connection", function connection(ws, req) {
});

setInterval(() => {
  wss.clients.forEach(client => {
    let date = { text: new Date().toTimeString() };
    client.send(JSON.stringify(date));
  });
}, 1000);
