function divEscapedContentEkement(message) {
    return $("<div></div>").text(message);
}

function divSystemContentElement(message) {
    return $("<div></div>").html("<i>" + message + "</i>");
}

function processUserInput(chatApp, socket) {
    var message = $("#send-massage").val();
    var systemMessage;

    if (message.charAt(0) == "/") {
        systemMessage = chatApp.processCommand(message);
        if (systemMessage) {
            $("#messages").append(divSystemContentElement(systemMessage));
        }
    } else {
        chatApp.sendMessage($("#room").text(), message);
        $("#messages").append(divEscapedContentEkement(message));
        $("#messages").scrollTop($("#messages").prop("scrollHeight"));
    }
    $("#send-massage").val("");
}

var socket = io.connect();

$(document).ready(function () {
    var chatApp = new Chat(socket);
    //名前変更の要求の結果を表示
    socket.on("nameResult", function (result) {
        var message;
        if (result.success) {
            message = "You are now know as " + result.name + ".";
        } else {
            message = result.message;
        }
        $("#messages").append(divSystemContentElement(message));
    });

    //ルーム変更の結果を表示
    socket.on("joinResult", function (result) {
        $("#room").text(result.room);
        // $("#messages").append(divSystemContentElement("Room changed."));
    });

    //受信したメッセージを表示
    socket.on("message", function (message) {
        var newElement = $("<div></div>").text(message.text);
        $("#messages").append(newElement);
    });

    //利用できるルームのリストを表示
    socket.on("rooms", function (rooms) {
        $("#room-list").empty();
        for (var room in rooms) {
            room = room.substring(1, room.length);
            if (room != "") {
                $("#room-list").append(divEscapedContentEkement(room));
            }
        }

        //ルーム名をクリックするとその部屋に移動できるようにする
        $("#room-list div").click(function () {
            chatApp.processCommand("/join " + $(this).text());
            $("#send-massage").focus();
        });
    });

    setInterval(function () {
        socket.emit("rooms");
    }, 1000);

    $("#send-massage").focus();
    //チャットメッセージ送信用のフォームを提出可能にする
    $("#send-form").submit(function () {
        processUserInput(chatApp, socket);
        return false;
    });
});