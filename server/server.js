const express = require("express");
const app = express();
const http = require("http");
const uuid = require("uuid");
const server = http.createServer(app);

const { Server } = require("socket.io");
const io = new Server(server);


let activePlayerCount = 0;
class Player {
  constructor(userName) {
    this.id = uuid.v4();
    this.userName = userName;
  }
}

// Can use set | lookup
const winningPatterns = [
  // these can be hashed
  [1,2,3],
  [4,5,6],
  [7,8,9],
  [1,4,7],
  [2,5,8],
  [3,6,9],
  [1,5,9],
  [3,5,7],
];

const matches = [];
let matchCount = 0;
class Match {
  constructor(playerOneId, playerTwoId) {
    matchCount += 1;
    this.id = matchCount;
    this.playerOneId = playerOneId;
    this.playerTwoId = playerTwoId;
    this.hasStarted = false;
    this.hasEnded = false;
    this.startingTurn = null;
    this.moves = [];
    this.winner = null;
  }

  setStartingTurn() {
    const turn = Math.floor(Math.random() * (1 - 0 + 1)) + 0;
    this.startingTurn = turn === 0 ? this.playerOneId : this.playerTwoId;
  }

  sendMatchStatus() {
    io.sockets.in(this.id).emit("match", this);
  }

  endMatch() {
    if(this.winner) {
      console.log(`${this.winner} won match ${this.id}`);
    }
    this.hasEnded = true;
    this.sendMatchStatus();
  }

  resign(resigningPlayerId) {
    this.winner = resigningPlayerId === this.playerOneId ?
      this.playerTwoId : this.playerOneId;
    this.endMatch();
  }

  wasWinningMove() {
    const lastMoveBy = this.moves.length%2===0 ? "o" : "x";
    const movesByPlayer = this.moves.filter((_, i) => {
      if(lastMoveBy === "x") {
        // numberOfMoves is 0 indexed
        return i%2 === 0;
      } else {
        return i%2 !== 0;
      }
    });

    if(movesByPlayer.length < 3) {
      return false
    }

    return winningPatterns.find((pattern) => {
      const hasPattern =  pattern.every((position) =>
        movesByPlayer.includes(position)
      );
      return hasPattern;
    });
  }

  updateMatchStatus() {
    if(this.wasWinningMove()) {
      this.winner = this.moves.length % 2 === 0 ?
        (this.startingTurn !== this.playerOneId ? this.playerOneId : this.playerTwoId) 
        : this.startingTurn;
      this.endMatch();
    } else {
      if(this.moves.length === 9) {
        console.log(`Match ${this.id} ended in draw`);
        this.endMatch();
      } else {
        this.sendMatchStatus();
      }
    }
  }

  addMove(move) {
    // TODO: out of time, validateMove !important
    this.moves.push(move);
    this.updateMatchStatus();
  }
}

function findMatchById(matchId) {
  const match = matches.find((match) => match.id === matchId
  );
  if(!match) {
    throw Error("Invalid Match id !!");
  }
  return match
}

function findOrCreateMatch(playerId) {

  // TODO: Later we can do more checks to only show active matches
  let match = matches.find((match) => !match.hasStarted
  );

  if(match) {
    match.playerTwoId = playerId;
    match.hasStarted = true;
    match.setStartingTurn();
  } else {
    // create a new match
    match = new Match(playerId, null);
    matches.push(match);
  }

  return match;
}

io.on("connection", (socket) => {
  activePlayerCount += 1;
  console.log(`A player connected !! active players: ${activePlayerCount}`);

  let player = null;
  let playingMatch = null;

  socket.on("register", (userName) => {
    player = new Player(userName);
    socket.join(player.id);
    console.log(`Registered player ${userName} with id ${player.id}`);
    // We can utilize this to show user invites from other players, lobbies etc.
    io.sockets.in(player.id).emit("registered", player);
  });

  // Now look for an existing match or create a new match
  socket.on("start", (playerId) => {
    const match = findOrCreateMatch(playerId);
    playingMatch = match.id;
    socket.join(match.id);
    io.sockets.in(match.id).emit("match", match);
  });

  socket.on("disconnect", () => {
    if(player) {
      if(playingMatch) {
        const registeredMatch = findMatchById(playingMatch);
        if(!registeredMatch.hasEnded) {
          registeredMatch.resign(player.id);
          playingMatch = null;
        }
      }
      console.log(`Player ${player.userName} disconnected`);
    }
    activePlayerCount -= 1;
    console.log(`A player disconnected, active players: ${activePlayerCount}`);
  });

  socket.on("move", (moveData) => {
    const {match, move} = moveData;
    const registeredMatch = findMatchById(match.id);
    if (!registeredMatch.hasEnded) {
      registeredMatch.addMove(move);
    } else {
      // TODO: emit to client, Match has already ended
    }
  });

  socket.on("resign", (exitData) => {
    const {player, match} = exitData;
    const registeredMatch = findMatchById(match.id);
    if(!registeredMatch.hasEnded) {
      registeredMatch.resign(player.id);
      playingMatch = null;
    } else {
      // TODO: emit to client, Match has already ended
    }
    console.log(`Player ${player.id} has quit!`);
  })
});

// TODO: store in .env
const PORT = 5050;
server.listen(PORT, () => {
  console.log(`Listening on *:${PORT}`);
});