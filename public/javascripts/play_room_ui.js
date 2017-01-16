function divEscapedContentElement(message) {
    return $("<div></div>").text(message);
}

function divSystemContentElement(message) {
    return $("<div></div>").html("<i>" + message + "</i>");
}

function processUserMessage(chatApp, socket) {
    var message = $("#send-massage").val();
    var systemMessage;
    if (message.charAt(0) == "/") {
        systemMessage = chatApp.processCommand(message);
        if (systemMessage) {
            $("#messages").append(divSystemContentElement(systemMessage));
        }
    } else {
        chatApp.sendMessage($("#room").text(), message);
        $("#messages").append(divEscapedContentElement(message));
        $("#messages").scrollTop($("#messages").prop("scrollHeight"));
    }
    $("#send-massage").val("");
}

function processHandSubmit(chatApp, socket) {
    var checkedBoxes = $("#show-card :checkbox:checked");
    var submittedCardsIndex = checkedBoxes.map(function() { return $(this).val();}).get();
    submittedCardsIndex = submittedCardsIndex.map(function (element) { return Number(element); });
    chatApp.handSubmit($("#room").text(), submittedCardsIndex);
}

var socket = io.connect();

$(document).ready(function () {
    var chatApp = new PlayRoom(socket);
    //名前変更の要求の結果を表示
    socket.on("nameResult", function (result) {
        var message;
        if (result.success) {
            message = "あなたの名前は" + result.name + "です.";
        } else {
            message = result.message;
        }
        $("#messages").empty();
        $("#messages").append(divSystemContentElement(message));
    });

    //ルーム変更の結果を表示
    socket.on("joinResult", function (result) {
        $("#room").text(result.room);
        $("#messages").append(divSystemContentElement("Room changed."));
    });

    //受信したメッセージを表示
    socket.on("message", function (message) {
        var newElement = $("<div></div>").text(message.text);
        $("#messages").append(newElement);
    });

    socket.on("card", function (hand) {
        //formの作成
        $("#show-card").empty();
        var nav = $("<div></div>").text("Your Hand:");
        $("#show-card").append(nav);
        var form = $("<form>",{id:"playerHand",class:"pure-form"});
        $("#show-card").append(form);
        var cards = hand.text.split(",");
        for(var i=0; i < cards.length; i++){
            var label = $("<label>",{class:"pure-checkbox"});
            label.append("<input type='checkbox' value="+i.toString()+">"+cards[i]);
            $("#playerHand").append(label);
        }
        var submit = $("<input>",{type:"submit",
            value:"手札を出す", id:"handSubmit"});
        $("#playerHand").append(submit);
        $("#playerHand").submit(function () {
            processHandSubmit(chatApp, socket);
            return false;
        });
    });

    //利用できるルームのリストを表示
    socket.on("rooms", function (rooms) {
        $("#room-list").empty();
        for (var room in rooms) {
            room = room.substring(1, room.length);
            if (room != "") {
                $("#room-list").append(divEscapedContentElement(room));
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
        processUserMessage(chatApp, socket);
        return false;
    });
});