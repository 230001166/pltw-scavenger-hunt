"use strict";

const express = require("express");
const SocketServer = require("ws").Server;
const path = require("path");

const { Pool } = require("pg");
const databaseURL =
  "postgres://ygtyyztixuudtg:340b1f0f67757392f02c164d941abd57cdca4321f06da7df8a5741837976e335@ec2-54-225-227-125.compute-1.amazonaws.com:5432/d4trt296637p42";

const pool = new Pool({
  connectionString: databaseURL,
  ssl: true
});

const PORT = process.env.PORT || 3000;
const INDEX = path.join(__dirname, "index.html");

const server = express()
  .use((req, res) => res.sendFile(INDEX))
  .get("/", (req, res) => res.render("pages/index"))
  .listen(PORT, () => console.log(`Listening on ${PORT}`));

const wss = new SocketServer({ server, clientTracking: true });

let clients = [];

pool.connect(function(err, client, done) {
  authenticateCode("legos", client, done);
  authenticateCode("qdaddysbbq", client, done);

  attemptToCreateUser("test2", "test", 3, client, done);
  attemptToCreateUser("jwu42", "imamonkey", 4, client, done);
});

function authenticateCode(code, client, done) {
  let codeIsValid = false;
  pool.connect(function(err, client, done) {
    client.query("SELECT code FROM spot_table", function(err, result) {
      done();
      if (err) return console.error(err);
      for (let i = 0; i < result.rows.length; i++) {
        let spotCode = result.rows[i].code;
        if (spotCode == code) {
          codeIsValid = true;
          console.log(code + " was valid.");
        }
      }
      if (!codeIsValid) {
        console.log("code not valid.");
      }
    });
  });
}

function authenticateUserInfo (data, client, done) {
  pool.connect(function(err, client, done) {
    client.query("SELECT username, password FROM users", function(err, result) {
      done();
      if (err) return console.error(err);
      for (let i = 0; i < result.rows.length; i++) {
        let retrievedUsername = result.rows[i].username;
        let retrievedPassword = result.rows[i].password;
        if (data.username === retrievedUsername && data.password === retrievedPassword) {
          console.log(data.username + " was valid.");
          data.isValid = true;
        }
      }
    });
    
  });
}

function attemptToCreateUser(username, password, id, client, done) {
  if (idIsInvalid(id, client, done)) {
    console.log("[!] - Invalid ID for username");
    return;
  } else {
    console.log ("ID is not taken!");
  }
  if (usernameIsTaken(username, client, done) === false) {
    pool.connect(function(err, client, done) {
      const text =
        "INSERT INTO users(id, username, password, visitedspots) VALUES($1, $2, $3, $4)";
      const values = [id, username, password, " "];

      client.query(text, values, function(err, result) {
        done();
        if (err) return console.error(err);
        console.log("User " + username + " created!");
      });
    });
  }
}

function usernameIsTaken(username, client, done) {
  pool.connect(function(err, client, done) {
    client.query("SELECT username FROM users", function(err, result) {
      done();
      if (err) return console.error(err);
      for (let i = 0; i < result.rows.length; i++) {
        let name = result.rows[i].username;
        if (username == name) {
          console.log(username + " is taken!");
          return true;
        }
      }
      console.log("Username is available!");
      return false;
    });
  });
}

function idIsInvalid (id, client, done) {
  pool.connect(function(err, client, done) {
    client.query("SELECT id FROM users", function(err, result) {
      done();
      if (err) return console.error(err);
      if (id <= getAmountOfExistingUsers (client, done)) { return true; } else { return false; }
    });
  }); 
}

function getAmountOfExistingUsers(client, done) {
  pool.connect(function(err, client, done) {
    client.query("SELECT * FROM users", function(err, result) {
      done();
      if (err) return console.error(err);
      let amountOfUsers = result.rows.length;
      console.log(amountOfUsers + " users exist.");
      return amountOfUsers;
    });
  });
}

wss.on("connection", function connection(ws, req) {

  clients.push (ws);

  let message = {
    type: "clientinfo",
    clientID: clients.length-1
  };

  ws.send(JSON.stringify(message));

  ws.onmessage = function(event) {
    let message = JSON.parse(event.data);

    if (message.type === "code") {
      console.log("Code " + message.code + " inputted");

      pool.connect(function(err, client, done) {
        if (err) return console.error(err);
        authenticateCode(message.code, client, done);
      });
    }
    if (message.type === "userinfo") {
      console.log("Username " + message.username + " and password " + message.password + " inputted from client " + message.clientID);

      pool.connect(function(err, client, done) {
        if (err) return console.error(err);
        authenticateUserInfo (message, client, done);
      });

      if (message.isValid) {
        console.log ("Sending user info...");
        let userMessage = {
          type: "userinfo",
          username: message.username,
        };
        
        console.log (userMessage.username);
        wss.clients [message.clientID].send(JSON.stringify(userMessage)); 
      } 
 
    }
  };
});

setInterval(() => {
  wss.clients.forEach(client => {
    let date = { 
      type: "date",
      text: new Date().toTimeString() };
    client.send(JSON.stringify(date));
  });
}, 1000);