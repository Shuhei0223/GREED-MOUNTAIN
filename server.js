const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static("client"));

const rooms = {};

const MIN_PLAYERS = 3;
const MAX_PLAYERS = 25;
const GOAL = 45;
const CHOICE_TIME = 30;

// ------------------------------------
// ルームID
// ------------------------------------

function generateRoomId() {
    let id;

    do {
        id = Math.random().toString(36).substring(2, 6).toUpperCase();
    } while (rooms[id]);

    return id;
}

// ------------------------------------
// プレイヤー一覧
// ------------------------------------

function getPublicPlayers(room) {
    return room.players.map(player => ({
        id: player.id,
        name: player.name,
        position: player.position,
        choice: player.choice,
        finished: player.finished,
        eliminated: player.eliminated
    }));
}

// ------------------------------------
// ルーム状態送信
// ------------------------------------

function broadcastRoom(roomId) {
    const room = rooms[roomId];

    if (!room) return;

    io.to(roomId).emit("roomState", {
        roomId,
        state: room.state,
        round: room.round,
        players: getPublicPlayers(room),
        timeLeft: room.timeLeft
    });
}

// ------------------------------------
// タイマー停止
// ------------------------------------

function stopTimer(room) {
    if (room.timer) {
        clearInterval(room.timer);
        room.timer = null;
    }
}

// ------------------------------------
// ラウンド開始
// ------------------------------------

function startRound(roomId) {
    const room = rooms[roomId];

    if (!room) return;

    stopTimer(room);

    room.state = "choosing";
    room.round++;
    room.timeLeft = CHOICE_TIME;

    // 選択状態をリセット
    room.players.forEach(player => {
        player.choice = null;
    });

    broadcastRoom(roomId);

    room.timer = setInterval(() => {

        const currentRoom = rooms[roomId];

        if (!currentRoom) {
            stopTimer(room);
            return;
        }

        currentRoom.timeLeft--;

        io.to(roomId).emit("timer", {
            timeLeft: currentRoom.timeLeft
        });

        if (currentRoom.timeLeft <= 0) {
            resolveRound(roomId);
        }

    }, 1000);
}

// ------------------------------------
// ラウンド結果
// ------------------------------------

function resolveRound(roomId) {
    const room = rooms[roomId];

    if (!room) return;

    stopTimer(room);

    // 今回のラウンドで脱落したプレイヤー
    const eliminatedPlayers = [];

    // 未選択 = 0
    room.players.forEach(player => {
        if (player.choice === null) {
            player.choice = 0;
        }
    });

    // 1〜6の人数を数える
    const counts = {
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
        6: 0
    };

    room.players.forEach(player => {
        // 脱落者は投票に参加しない
        if (
            !player.eliminated &&
            player.choice >= 1 &&
            player.choice <= 6
        ) {
            counts[player.choice]++;
        }
    });

    // 最多票
    const maxCount =
        Math.max(...Object.values(counts));

    // 最多票が2票以上の場合だけ0になる
    // 1票が最多なら、誰も0にならない
    const zeroNumbers = maxCount >= 2
        ? Object.keys(counts)
            .filter(number => counts[number] === maxCount)
            .map(Number)
        : [];

    // 移動
    const results = [];

    room.players.forEach(player => {

        const choice = player.choice;

        // 脱落者は移動しない
        if (player.eliminated) {

            results.push({
                id: player.id,
                name: player.name,
                choice: 0,
                move: 0,
                oldPosition: player.position,
                newPosition: player.position,
                finished: player.finished,
                eliminated: true
            });

            return;
        }

        let move = choice;

        if (choice === 0) {
            move = 0;
        } else if (zeroNumbers.includes(choice)) {
            move = 0;
        }

        const oldPosition = player.position;

        player.position += move;

        if (player.position >= GOAL) {
            player.position = GOAL;
            player.finished = true;
        }

        results.push({
            id: player.id,
            name: player.name,
            choice,
            move,
            oldPosition,
            newPosition: player.position,
            finished: player.finished,
            eliminated: player.eliminated
        });
    });


    // ========================================
    // 43・44に複数人止まったら全員脱落
    // ========================================

    const dangerPositions = [43, 44];

    dangerPositions.forEach(position => {

        const playersOnPosition =
            room.players.filter(
                player =>
                    !player.finished &&
                    !player.eliminated &&
                    player.position === position
            );

        if (playersOnPosition.length >= 2) {

            playersOnPosition.forEach(player => {

                player.eliminated = true;

                eliminatedPlayers.push({
                    id: player.id,
                    name: player.name,
                    position: position
                });

            });

        }

    });


    // ========================================
    // ラウンド結果
    // ========================================

    room.state = "result";
    room.timeLeft = 0;

    io.to(roomId).emit("roundResult", {

        round: room.round,

        counts,

        maxCount,

        zeroNumbers,

        results,

        players: getPublicPlayers(room),

        // 今回脱落したプレイヤー
        eliminatedPlayers

    });

    broadcastRoom(roomId);


    // ========================================
    // ゴール確認
    // ========================================

    const finishedPlayers =
        room.players.filter(
            player => player.finished
        );

    if (finishedPlayers.length > 0) {

        setTimeout(() => {
            finishGame(roomId);
        }, 4000);

        return;
    }


    // ========================================
    // 次のラウンド
    // ========================================

    setTimeout(() => {

        const currentRoom = rooms[roomId];

        if (!currentRoom) return;

        startRound(roomId);

    }, 4000);
}

// ------------------------------------
// ゲーム終了
// ------------------------------------

function finishGame(roomId) {
    const room = rooms[roomId];

    if (!room) return;

    stopTimer(room);

    room.state = "finished";

    const ranking = [...room.players]
        .sort((a, b) => {
            if (b.position !== a.position) {
                return b.position - a.position;
            }

            return a.name.localeCompare(b.name);
        })
        .map((player, index) => ({
            rank: index + 1,
            id: player.id,
            name: player.name,
            position: player.position
        }));

    io.to(roomId).emit("gameFinished", {
        ranking
    });

    broadcastRoom(roomId);
}

// ------------------------------------
// Socket.io
// ------------------------------------

io.on("connection", socket => {

    console.log("接続:", socket.id);

    // -----------------------------
    // ルーム作成
    // -----------------------------

    socket.on("createRoom", ({ name }) => {

        name = String(name || "").trim();

        if (!name) {
            socket.emit("errorMessage", "プレイヤー名を入力してください");
            return;
        }

        const roomId = generateRoomId();

        rooms[roomId] = {
            id: roomId,
            state: "waiting",
            round: 0,
            timeLeft: 0,
            timer: null,
            players: []
        };

        const player = {
            id: socket.id,
            name: name.substring(0, 20),
            position: 0,
            choice: null,
            finished: false,
            eliminated: false
        };

        rooms[roomId].players.push(player);

        socket.join(roomId);

        socket.roomId = roomId;

        socket.emit("roomCreated", {
            roomId
        });

        broadcastRoom(roomId);
    });

    // -----------------------------
    // ルーム参加
    // -----------------------------

    socket.on("joinRoom", ({ roomId, name }) => {

        roomId = String(roomId || "").trim().toUpperCase();
        name = String(name || "").trim();

        const room = rooms[roomId];

        if (!room) {
            socket.emit("errorMessage", "ルームが見つかりません");
            return;
        }

        if (!name) {
            socket.emit("errorMessage", "プレイヤー名を入力してください");
            return;
        }

        if (room.players.length >= MAX_PLAYERS) {
            socket.emit("errorMessage", "このルームは満員です");
            return;
        }

        if (room.state !== "waiting") {
            socket.emit("errorMessage", "ゲームはすでに開始されています");
            return;
        }

        const player = {
            id: socket.id,
            name: name.substring(0, 20),
            position: 0,
            choice: null,
            finished: false,
            eliminated: false
        };

        room.players.push(player);

        socket.join(roomId);
        socket.roomId = roomId;

        socket.emit("joinedRoom", {
            roomId
        });

        broadcastRoom(roomId);
    });

    // -----------------------------
    // ゲーム開始
    // -----------------------------

    socket.on("startGame", () => {

        const roomId = socket.roomId;

        if (!roomId) return;

        const room = rooms[roomId];

        if (!room) return;

        if (room.players[0].id !== socket.id) {
            socket.emit("errorMessage", "ルーム作成者だけがゲームを開始できます");
            return;
        }

        if (room.players.length < MIN_PLAYERS) {
            socket.emit(
                "errorMessage",
                `ゲーム開始には${MIN_PLAYERS}人以上必要です`
            );
            return;
        }

        if (room.state !== "waiting") {
            return;
        }

        room.players.forEach(player => {
            player.position = 0;
            player.choice = null;
            player.finished = false;
        });

        startRound(roomId);
    });

    // -----------------------------
    // 数字選択
    // -----------------------------

    socket.on("chooseNumber", number => {

    const roomId = socket.roomId;

    if (!roomId) return;

    const room = rooms[roomId];

    if (!room) return;

    if (room.state !== "choosing") {
        return;
    }

    number = Number(number);

    if (
        !Number.isInteger(number) ||
        number < 1 ||
        number > 6
    ) {
        return;
    }

    const player = room.players.find(
        player => player.id === socket.id
    );

    if (!player) return;

    // 脱落したプレイヤーは選択できない
    if (player.eliminated) {
        return;
    }

    // 選択
    player.choice = number;

    socket.emit("choiceAccepted", {
        choice: number
    });

    // 脱落者を除いて全員選択済みなら即集計
    const activePlayers =
        room.players.filter(
            player => !player.eliminated
        );

    const allChosen =
        activePlayers.every(
            player => player.choice !== null
        );

    if (allChosen) {
        resolveRound(roomId);
    }

});
   
    // -----------------------------
    // 切断
    // -----------------------------

    socket.on("disconnect", () => {

        console.log("切断:", socket.id);

        const roomId = socket.roomId;

        if (!roomId) return;

        const room = rooms[roomId];

        if (!room) return;

        const index = room.players.findIndex(
            player => player.id === socket.id
        );

        if (index !== -1) {
            room.players.splice(index, 1);
        }

        if (room.players.length === 0) {
            stopTimer(room);
            delete rooms[roomId];
            return;
        }

        // ゲーム開始前ならそのまま続行
        if (room.state === "waiting") {
            broadcastRoom(roomId);
            return;
        }

        // ゲーム中に切断した場合
        if (room.state === "choosing") {

            const allChosen = room.players.every(
                player => player.choice !== null
            );

            if (allChosen) {
                resolveRound(roomId);
            }
        }

        broadcastRoom(roomId);
    });
});

// ------------------------------------
// サーバー起動
// ------------------------------------

server.listen(PORT, () => {
    console.log(`Server started: http://localhost:${PORT}`);
});