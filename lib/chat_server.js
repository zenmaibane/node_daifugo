var socketio = require("socket.io");
//チャット状態定義変数
var io;
var guestNumber = 1;
var nickNames = {};
var namesUsed = [];
var currentRoom = {};

var isPlayingDaifugo = {};;
const playerNum = 4;

const numbers = [1,2,3,4,5,6,7,8,9,10,11,12,13];
const marks = ["Hearts", "Clubs", "Diamonds", "Spades"];


exports.listen = function (server) {
    io = socketio.listen(server);
    io.set("log level", 1);
    io.sockets.on("connection", function (socket) {
        guestNumber = assignGuestName(socket, guestNumber, nickNames, namesUsed);
        console.log("join room");
        joinRoom(socket, "Lobby");
        //ユーザーのメッセージ、名前変更とルーム作成/変更の要求を処理する
        handleMessageBroadcasting(socket, nickNames);
        handleNameChangeAttempts(socket, nickNames, namesUsed);
        handleRoomJoining(socket);
        //ユーザーの要求に応じて使用されているルームのリストを提供
        socket.on("rooms", function () {
            socket.emit("rooms", io.sockets.manager.rooms);
        });

        //ユーザーが接続を断ったときのためにクリーンアップロジックを定義する
        handleClientDisconnection(socket, nickNames, namesUsed);
    });
};

function assignGuestName(socket, guestNumber, nickNames, nameUsed) {
    var name = "Guest" + guestNumber;
    nickNames[socket.id] = name;
    socket.emit("nameResult", {
        success: true,
        name: name
    });
    namesUsed.push(name);

    return guestNumber + 1;
}

function joinRoom(socket, room) {
    socket.join(room);
    currentRoom[socket.id] = room;
    socket.emit("joinResult", {room: room});
    socket.broadcast.to(room).emit("message", {
        text: nickNames[socket.id] + " has joined " + room + "."
    });
    var usersInRoom = io.sockets.clients(room); //同じルームに他の誰かがいるかの判定
    if (usersInRoom.length > 1) {
        var usersInRoomSummary = "Users currently in " + room + ": ";
        for (var index in usersInRoom) {
            var usersSocketId = usersInRoom[index].id;
            if (usersSocketId != socket.id) {
                if (index > 0) {
                    usersInRoomSummary += ", ";
                }
                usersInRoomSummary += nickNames[usersSocketId];
            }
        }
        usersInRoomSummary += ".";
        //同じ部屋にいる他のユーザーの概要をこのユーザーに送る
        socket.emit("message", {text: usersInRoomSummary});
        if(usersInRoom.length == playerNum) {
            startDaifugo(room);
        }
    }
}

function startDaifugo(room) {
    isPlayingDaifugo[room] = true;
    io.sockets.emit("message", {
        text: playerNum.toString() + "人集まりました．ゲームを始めます．"
    });
    var playerList = io.sockets.clients(room);
    var deck = [];
    for(var i = 0; i < marks.length; i++){
        for (var j = 0; j<numbers.length;j++){
            deck.push(new Card(numbers[j], marks[i]));
        }
    }
    deck.push(new Card(0, "Joker"));
    deck = shuffle(deck);
    var handNum = Math.floor(deck.length / playerNum);
    playerList.forEach(function (client) {
        client.hand =  deck.slice(0, handNum);
        deck.splice(0, handNum);
    })
    playerList = shuffle(playerList);
    for (var i = 0; i < deck.length; i++){
        playerList[i].hand.push(deck[i]);
    }
    console.log("こっから先はユーザの手札");
    playerList.forEach(function (client) {
        console.log(nickNames[client.id])
        console.log(client.hand.length);
        console.log(client.hand);
    })
}

function handleNameChangeAttempts(socket, nickNames, namesUsed) {
    socket.on("nameAttempt", function (name) {
        if (name.indexOf("Guest") == 0) {
            socket.emit("nameResult", {
                success: false,
                message: "Names cannot begin with \"Guest\"."
            });
        } else {
            if (namesUsed.indexOf(name) == -1) {
                var previousName = nickNames[socket.id];
                var previousNameIndex = namesUsed.indexOf(previousName);
                namesUsed.push(name);
                nickNames[socket.id] = name;
                delete namesUsed[previousNameIndex];

                socket.emit("nameResult", {
                    success: true,
                    name: name
                });
                socket.broadcast.to(currentRoom[socket.id]).emit("message", {
                    text: previousName + " is now known as " + name + "."
                });
            } else {
                socket.emit("nameResult", {
                    success: false,
                    message: "That name is already in use."
                });
            }
        }
    });
}

function handleMessageBroadcasting(socket) {
    socket.on("message", function (message) {
        socket.broadcast.to(message.room).emit("message", {
            text: nickNames[socket.id] + ": " + message.text
        });
    });
}

function handleRoomJoining(socket) {
    socket.on("join", function (room) {
        socket.leave(currentRoom[socket.id]);
        joinRoom(socket, room.newRoom);
    })
}

function handleClientDisconnection(socket) {
    socket.on("disconnect", function () {
        var nameIndex = namesUsed.indexOf(nickNames[socket.id]);
        delete namesUsed[nameIndex];
        delete nickNames[socket.id];
    });
}

function shuffle(array) {
    var n = array.length, t, i;
    while (n) {
        i = Math.floor(Math.random() * n--);
        t = array[n];
        array[n] = array[i];
        array[i] = t;
    }
    return array;
}

function Card(num, mark) {
    this.number = num;
    this.mark = mark;
}

Card.prototype.getNumberString = function () {
    switch (this.number){
        case 0:
            return "Joker"
        case 1:
            return "A";
        case 11:
            return "J";
        case 12:
            return "Q";
        case 13:
            return "K";
        default:
            return this.number.toString();
    }
};

function Daifugo() {
    var tempDeck = [];
    for(var i = 0; i < marks.length; i++){
        for (var j = 0; j<numbers.length;j++){
            tempDeck.push(new Card(numbers[j], marks[i]));
        }
    }
    tempDeck.push(new Card(0, "Joker"))
    shuffle(tempDeck);
    this.deck = tempDeck;
}