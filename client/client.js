var readcommand = require("readcommand");
var socket = require("socket.io-client")("http://localhost:5050");

let userName = null;
let player = null;
let currentMatch = null;

function readNextCommand (cb) {
  readcommand.read(function(err, args, str) {
    if(args[0] === "exit") {
      if(currentMatch) {
        socket.emit("resign", {player, match: currentMatch});
      }
      throw Error("Exit!!!");
    } else {
      cb(args);
    }
  });
}

socket.on("connect", () => {
  console.log(" You are connected to cli Tic Tac Toe !!! ");
  console.log("Please provide a userName: (type 'exit' anytime to exit)");
  readNextCommand((args)=> {
    if(args) {
      userName = args[0];
      socket.emit("register", userName);
    }
  });
});

function showMenu() {
  // We can give more options like leaderboard etc. here
  console.log(`Welcome ${player.userName}, enter 'start' to join a game`);
  readNextCommand((args)=> {
    if(args[0] === "start") {
      console.log("Emitting start!! ")
      socket.emit("start", player.id);
    }
  });
}

socket.on("registered", (data) => {
  player = data;
  console.log(`You are registered as player ${player.userName} with id ${player.id} !!`);
  showMenu();
});

function getBoard(match) {
  const board = [
    0, 0, 0,
    0, 0, 0,
    0, 0, 0,
  ];

  match.moves.forEach((move, i) => {
    // Whoever does the first move uses x
    board[move-1] = i%2 === 0 ? 'x' : 'o';
  });

  return board
}

function displayBoard(board) {
  for(let i=0; i<9; i+=3) {
    console.log(...board.slice(i, i+3));
  }
}

function makeMove(match, board) {
  console.log("It's your turn, please enter your move from 1 - 9: ");
  readNextCommand((args) => {
    const move = args[0];
    if( move > 0 && move <= 9) {
      if(board[move-1] === 0) {
        socket.emit("move", {match, move: parseInt(move)});
      } else {
        console.log("Invalid move, the position is not vacant, please retry");
        makeMove(match, board);
      }
    } else {
      console.log("Invalid out of board move XD, please retry");
      makeMove(match, board);
    }
  });
}

socket.on("match", (match) => {
  console.log("This is match: ", JSON.stringify(match, null, 2));
  currentMatch = match;

  if(!match.hasStarted) {
    console.log("Waiting for another player to join ....");
  } else if(match.hasStarted && !match.hasEnded) {

    if(!match.moves.length) {
      console.log("The match has started!!!");
    }

    const board = getBoard(match);
    displayBoard(board);

    let myTurn = false;
    if(match.startingTurn === player.id) {
      myTurn = match.moves.length%2 === 0;
    } else {
      myTurn = match.moves.length%2 !== 0;
    }
    if(myTurn) {
      makeMove(match, board);
    } else {
      console.log("It's opponents turn, wait for his move....");
    }
  } else if(match.hasEnded) {
    console.log("Match Ended");
    if(match.winner === player.id) {
      console.log("You won!!! Congrats ....");
    } else {
      console.log(`You lost, ${match.winner} won, better luck next time :)`);
    }
    showMenu();
  }
});

socket.on("disconnect", function() {
  socket.emit("disconnect")
});
