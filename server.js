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
let amountOfUsers = 0;
let id = 0;

function authenticateCode(wss, code, clientID, client, done) {
  let codeIsValid = false;
  pool.connect(function(err, client, done) {
    client.query("SELECT * FROM spot_table", function(err, result) {
      done();
      if (err) return console.error(err);
      for (let i = 0; i < result.rows.length; i++) {
        let spotCode = result.rows[i].code;
        if (spotCode == code) {
          codeIsValid = true;
          console.log(code + " was valid.");
          sendSpotInformationToUser(wss, result.rows[i], clientID);
          updateVisitedSpots(result.rows[i].name, clientID);
        }
      }
      if (!codeIsValid) {
        console.log("code not valid.");
      }
    });
  });
}

function sendSpotInformationToUser(wss, spot, clientID) {
  let userMessage = {
    type: "spotinfo",
    wildlifeName: spot.wildlifename,
    wildlifeDescription: spot.wildlifedescription,
    username: clients[clientID].username
  };

  wss.clients[clientID].send(JSON.stringify(userMessage));
}

function updateVisitedSpots(spot, clientID) {
  pool.connect(function(err, client, done) {
    loadClientVisitedSpots(clientID);
    clients[clientID].visitedSpots.push(spot);
    const text = "UPDATE users SET visitedspots = ($1) WHERE username = ($2)";
    const values = [
      JSON.stringify(clients[clientID].visitedSpots),
      clients[clientID].username
    ];
    console.log(values + "DATABASE VALUES");
    client.query(text, values, function(err, result) {
      done();
      if (err) return console.error(err);
    });
  });
}

function loadClientVisitedSpots(clientID) {
  pool.connect(function(err, client, done) {
    const queryText = "SELECT visitedspots FROM users WHERE username = ($1)";
    const queryValues = [clients[clientID].username];
    client.query(queryText, queryValues, function(err, result) {
      done();
      if (err) return console.error(err);
      for (let i = 0; i < result.rows.length; i++) {
        let spots = JSON.parse(result.rows[i].visitedspots);
        console.log("SPOTS: " + spots);
        setClientVisitedSpots(clientID, spots);
      }
    });
  });
  console.log("Visited spots: " + clients[clientID].visitedSpots);
}

function setClientVisitedSpots(clientID, spots) {
  for (let i = 0; i < spots.length; i++) {
    clients[clientID].visitedSpots.push (spots [i]);
  }
}

function getIDFromUsername(clientID) {
  pool.connect(function(err, client, done) {
    client.query("SELECT username FROM users", function(err, result) {
      done();
      if (err) return console.error(err);
      for (let i = 0; i < result.rows.length; i++) {
        let retrievedUsername = result.rows[i].username;
        if (clients[clientID].username === retrievedUsername) {
          setID(i);
        }
      }
    });
  });
}

function setID(number) {
  id = number;
}

function authenticateUserInfo(wss, data, client, done) {
  pool.connect(function(err, client, done) {
    client.query("SELECT username, password FROM users", function(err, result) {
      done();
      if (err) return console.error(err);
      for (let i = 0; i < result.rows.length; i++) {
        let retrievedUsername = result.rows[i].username;
        let retrievedPassword = result.rows[i].password;
        if (
          data.username === retrievedUsername &&
          data.password === retrievedPassword
        ) {
          console.log(data.username + " was valid.");
          setClientUsername(wss, data, retrievedUsername);
        }
      }
    });
  });
}

function setClientUsername(wss, data, username) {
  let clientID = returnIndexFromUniqueIdentifier(data.uniqueID);
  clients[clientID].username = username;
  console.log(data + "\nUsername " + clients[clientID].username);
  console.log("Sending user info...");
  let userMessage = {
    type: "userinfo",
    username: clients[clientID].username
  };

  console.log(userMessage.username);
  wss.clients[clientID].send(JSON.stringify(userMessage));
}

function disconnectClient(index) {
  clients.splice(index, 1);
}

function attemptToCreateUser(data) {
  updateAmountOfExistingUsers();

  let usernameIsTaken = false;
  pool.connect(function(err, client, done) {
    client.query("SELECT username FROM users", function(err, result) {
      done();
      if (err) return console.error(err);
      for (let i = 0; i < result.rows.length; i++) {
        let name = result.rows[i].username;
        if (data.username == name) {
          console.log(data.username + " is taken!");
          usernameIsTaken = true;
        }
      }
      console.log("Username is available!");
    });
  });

  if (!usernameIsTaken) {
    pool.connect(function(err, client, done) {
      let visitedspots = [];
      const text =
        "INSERT INTO users(username, password, visitedspots) VALUES($1, $2, $3)";
      const values = [
        data.username,
        data.password,
        JSON.stringify(visitedspots)
      ];

      client.query(text, values, function(err, result) {
        done();
        if (err) return console.error(err);
        console.log("User " + data.username + " created!");
        setClientUsername(wss, data, data.username);
      });
    });
  }
}

function updateAmountOfExistingUsers() {
  pool.connect(function(err, client, done) {
    client.query("SELECT * FROM users", function(err, result) {
      done();
      if (err) return console.error(err);
      setAmountOfUsers(result.rows.length);
      console.log(amountOfUsers + " users exist.");
    });
  });
}

function setAmountOfUsers(amount) {
  amountOfUsers = amount;
}

function createUniqueIdentifier() {
  let isUnique = false;
  let uniqueIdentifier = 0;
  while (!isUnique) {
    isUnique = true;
    for (let i = 0; i < clients.length; i++) {
      if (uniqueIdentifier == clients[i].uniqueIdentifier) {
        isUnique = false;
      }
    }

    if (!isUnique) {
      uniqueIdentifier = Math.floor(Math.random() * 10000000);
    }
  }
  return uniqueIdentifier;
}

function returnIndexFromUniqueIdentifier(uniqueIdentifier) {
  let clientIndex = 0;
  clients.forEach((client, index) => {
    if (client.uniqueIdentifier == uniqueIdentifier) {
      clientIndex = index;
    }
  });

  return clientIndex;
}

wss.on("connection", function connection(ws, req) {
  ws.clientID = clients.length - 1;
  ws.visitedSpots = [];
  ws.uniqueIdentifier = createUniqueIdentifier();
  clients.push(ws);

  let serverMessage = {
    type: "clientinfo",
    uniqueID: clients[clients.length - 1].uniqueIdentifier
  };

  ws.send(JSON.stringify(serverMessage));

  ws.onmessage = function(event) {
    let message = JSON.parse(event.data);

    if (message.type === "code") {
      console.log("Code " + message.code + " inputted");

      pool.connect(function(err, client, done) {
        if (err) return console.error(err);
        authenticateCode(
          wss,
          message.code,
          returnIndexFromUniqueIdentifier(message.uniqueID),
          client,
          done
        );
      });
    }
    if (message.type === "userinfo") {
      console.log(
        "Username " +
          message.username +
          " and password " +
          message.password +
          " inputted from client " +
          returnIndexFromUniqueIdentifier(message.uniqueID)
      );

      pool.connect(function(err, client, done) {
        if (err) return console.error(err);
        authenticateUserInfo(wss, message, client, done);
      });
    }
    if (message.type === "newuserinfo") {
      pool.connect(function(err, client, done) {
        if (err) return console.error(err);
        attemptToCreateUser(message);
      });
    }
    if (message.type === "visitedspots") {
      pool.connect(function(err, client, done) {
        client.query("SELECT visitedspots FROM users", function(err, result) {
          done();
          if (err) return console.error(err);
          prepareAndSendSpotInformation(result, message);
        });
      });
    }
  };

  ws.on("close", () => {
    disconnectClient(returnIndexFromUniqueIdentifier(ws.uniqueIdentifier));
  });
});

function prepareAndSendSpotInformation(result, message) {
  getIDFromUsername(returnIndexFromUniqueIdentifier(message.uniqueID));
  sendVisitedSpots(
    result.rows[id],
    returnIndexFromUniqueIdentifier(message.uniqueID)
  );
}

function sendVisitedSpots(data, clientID) {
  let message = {
    type: "visitedspots",
    spots: JSON.stringify(data.visitedspots)
  };
  wss.clients[clientID].send(JSON.stringify(message));
}

setInterval(() => {
  wss.clients.forEach(client => {
    let date = {
      type: "date",
      text: new Date().toTimeString()
    };
    client.send(JSON.stringify(date));
  });
}, 1000);
