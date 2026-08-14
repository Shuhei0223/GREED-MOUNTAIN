const socket = io();


// ========================================
// DOM
// ========================================

const lobby = document.getElementById("lobby");
const waiting = document.getElementById("waiting");
const game = document.getElementById("game");
const finished = document.getElementById("finished");

const playerNameInput =
    document.getElementById("playerName");

const roomIdInput =
    document.getElementById("roomIdInput");

const createButton =
    document.getElementById("createButton");

const joinButton =
    document.getElementById("joinButton");

const startButton =
    document.getElementById("startButton");

const roomIdDisplay =
    document.getElementById("roomIdDisplay");

const playerCount =
    document.getElementById("playerCount");

const waitingPlayers =
    document.getElementById("waitingPlayers");

const waitingMessage =
    document.getElementById("waitingMessage");

const roundNumber =
    document.getElementById("roundNumber");

const timer =
    document.getElementById("timer");

const chosenCount =
    document.getElementById("chosenCount");

const totalCount =
    document.getElementById("totalCount");

const board =
    document.getElementById("board");

const ranking =
    document.getElementById("ranking");

const choicePanel =
    document.getElementById("choicePanel");

const myChoice =
    document.getElementById("myChoice");

const resultPanel =
    document.getElementById("resultPanel");

const resultNumbers =
    document.getElementById("resultNumbers");

const resultMessage =
    document.getElementById("resultMessage");

const finalRanking =
    document.getElementById("finalRanking");

const errorMessage =
    document.getElementById("errorMessage");

const eliminationOverlay =
    document.getElementById("eliminationOverlay");

const eliminationNotice =
    document.getElementById("eliminationNotice");;    

// ========================================
// State
// ========================================

let myId = null;
let myRoomId = null;

let players = [];
let currentState = "waiting";


// ========================================
// Socket connection
// ========================================

socket.on("connect", () => {

    myId = socket.id;

});


// ========================================
// Error
// ========================================

socket.on("errorMessage", message => {

    showError(message);

});

function showError(message) {

    errorMessage.textContent = message;

    errorMessage.classList.remove("hidden");

    setTimeout(() => {
        errorMessage.classList.add("hidden");
    }, 3000);
}


// ========================================
// Create Room
// ========================================

createButton.addEventListener("click", () => {

    const name =
        playerNameInput.value.trim();

    if (!name) {
        showError("プレイヤー名を入力してください");
        return;
    }

    socket.emit("createRoom", {
        name
    });

});


// ========================================
// Join Room
// ========================================

joinButton.addEventListener("click", () => {

    const name =
        playerNameInput.value.trim();

    const roomId =
        roomIdInput.value.trim();

    if (!name) {
        showError("プレイヤー名を入力してください");
        return;
    }

    if (!roomId) {
        showError("ルームIDを入力してください");
        return;
    }

    socket.emit("joinRoom", {
        name,
        roomId
    });

});


// ========================================
// Room created
// ========================================

socket.on("roomCreated", data => {

    myRoomId = data.roomId;

    showWaiting();

});


// ========================================
// Joined
// ========================================

socket.on("joinedRoom", data => {

    myRoomId = data.roomId;

    showWaiting();

});


// ========================================
// Room state
// ========================================

socket.on("roomState", data => {

    myRoomId = data.roomId;

    currentState = data.state;

    players = data.players;

    roomIdDisplay.textContent =
        data.roomId;

    playerCount.textContent =
        players.length;

    totalCount.textContent =
        players.length;

    updateWaitingPlayers();

    updateRanking();

    updateBoard();

    if (data.round) {
        roundNumber.textContent =
            data.round;
    }

    if (data.timeLeft !== undefined) {
        updateTimer(data.timeLeft);
    }

    if (data.state === "choosing") {

    showGame();

    resultPanel.classList.add("hidden");

    choicePanel.classList.remove("hidden");

    // ★新しいラウンドなので選択状態をリセット
    resetMyChoice();

    enableChoiceButtons(true);

}

    if (data.state === "result") {

        showGame();

        choicePanel.classList.add("hidden");

    }

    if (data.state === "waiting") {

        showWaiting();

    }

    if (data.state === "finished") {

        showGame();

    }

});


// ========================================
// Waiting players
// ========================================

function updateWaitingPlayers() {

    waitingPlayers.innerHTML = "";

    players.forEach((player, index) => {

        const div =
            document.createElement("div");

        div.className =
            "waitingPlayer";

        div.textContent =
            `${index + 1}. ${player.name}`;

        waitingPlayers.appendChild(div);

    });

    const canStart =
        players.length >= 3 &&
        players.length <= 25;

    startButton.disabled =
        !canStart;

    if (players.length < 3) {

        waitingMessage.textContent =
            "3人以上集まると開始できます";

    } else {

        waitingMessage.textContent =
            "準備完了。ルーム作成者がゲームを開始できます";

    }

}


// ========================================
// Start game
// ========================================

startButton.addEventListener("click", () => {

    socket.emit("startGame");

});


// ========================================
// Timer
// ========================================

socket.on("timer", data => {

    updateTimer(data.timeLeft);

});

function updateTimer(time) {

    timer.textContent =
        Math.max(0, time);

    if (time <= 5) {
        timer.style.color = "#d32f2f";
    } else {
        timer.style.color = "";
    }
}


// ========================================
// Choose number
// ========================================

document
    .querySelectorAll(".choiceButtons button")
    .forEach(button => {

        button.addEventListener("click", () => {

            const number =
                Number(button.dataset.number);

            if (currentState !== "choosing") {
                return;
            }

            socket.emit("chooseNumber", number);

        });

    });


// ========================================
// Choice accepted
// ========================================

socket.on("choiceAccepted", data => {

    myChoice.textContent =
        `選択中：${data.choice}`;

    document
        .querySelectorAll(".choiceButtons button")
        .forEach(button => {

            const number =
                Number(button.dataset.number);

            button.classList.toggle(
                "selected",
                number === data.choice
            );

        });

});


// ========================================
// Update selected count
// ========================================

function updateChosenCount() {

    const activePlayers =
        players.filter(
            player => !player.eliminated
        );

    const count =
        activePlayers.filter(
            player => player.choice !== null
        ).length;

    chosenCount.textContent =
        count;

    totalCount.textContent =
        activePlayers.length;

}

// ========================================
// Round result
// ========================================

socket.on("roundResult", data => {

    currentState = "result";

    resultPanel.classList.remove("hidden");

    choicePanel.classList.add("hidden");

    resultNumbers.innerHTML = "";

    for (let number = 1; number <= 6; number++) {

        const div =
            document.createElement("div");

        div.className =
            "resultNumber";

        if (data.zeroNumbers.includes(number)) {
            div.classList.add("zero");
        }

        div.innerHTML = `
            <strong>${number}</strong><br>
            ${data.counts[number]}人
            ${
                data.zeroNumbers.includes(number)
                    ? "<br>0マス"
                    : ""
            }
        `;

        resultNumbers.appendChild(div);

    }

if (data.zeroNumbers.length === 1) {

    resultMessage.textContent =
        `${data.zeroNumbers[0]} が最多！ → 0マス`;

} else if (data.zeroNumbers.length >= 2) {

    resultMessage.textContent =
        `${data.zeroNumbers.join("・")} が同率最多！ → すべて0マス`;

} else {

    // 最多票が1票だった場合
    resultMessage.textContent = "";

}


    // 脱落者通知
if (
    data.eliminatedPlayers &&
    data.eliminatedPlayers.length > 0
) {

    const names =
        data.eliminatedPlayers
            .map(player => player.name)
            .join("、");

    eliminationNotice.innerHTML = `
        <div class="eliminationTitle">
            ⚠ 滑落！
        </div>

        <div class="eliminationNames">
            ${names}
        </div>

        <div class="eliminationReason">
            山頂付近で複数人が争い、当事者は全員滑落しました
        </div>
    `;

    eliminationOverlay.classList.remove("hidden");

    setTimeout(() => {
        eliminationOverlay.classList.add("hidden");
    }, 4000);

} else {

    eliminationOverlay.classList.add("hidden");

}



    players = data.players;

    updateRanking();
    updateBoard();

    // 結果表示中は選択ボタン無効
    enableChoiceButtons(false);

});


// ========================================
// Choice buttons
// ========================================

function enableChoiceButtons(enabled) {

    document
        .querySelectorAll(".choiceButtons button")
        .forEach(button => {

            button.disabled =
                !enabled;

        });

}

function resetMyChoice() {

    // 表示を未選択に戻す
    myChoice.textContent = "未選択";

    // 前ラウンドの選択状態を解除
    document
        .querySelectorAll(".choiceButtons button")
        .forEach(button => {

            button.classList.remove("selected");

        });

}

// ========================================
// Ranking
// ========================================

function updateRanking() {

    const sorted =
        [...players].sort((a, b) => {

            if (b.position !== a.position) {
                return b.position - a.position;
            }

            return a.name.localeCompare(b.name);

        });

    ranking.innerHTML = "";

    sorted.forEach((player, index) => {

        const row =
            document.createElement("div");

        row.className =
            "rankRow";

        if (player.id === myId) {
            row.classList.add("me");
        }

        row.innerHTML = `
            <div class="rankPosition">
                ${index + 1}
            </div>

            <div class="rankName">
    ${escapeHtml(player.name)}
    ${player.eliminated ? "【滑落】" : ""}
</div>

            <div class="rankScore">
                ${player.position}
            </div>
        `;

        ranking.appendChild(row);

    });

    updateChosenCount();
}


// ========================================
// Board
// ========================================

function updateBoard() {

    board.innerHTML = "";

    /*
        45マス・山型盤面

                        45

                      44 43

                    40 41 42

                 39 38 37 36

               31 32 33 34 35

            30 29 28 27 26 25

          18 19 20 21 22 23 24

        17 16 15 14 13 12 11 10

      1  2  3  4  5  6  7  8  9

                    START
                      0
    */

    const rows = [
        [45],
        [44, 43],
        [40, 41, 42],
        [39, 38, 37, 36],
        [31, 32, 33, 34, 35],
        [30, 29, 28, 27, 26, 25],
        [18, 19, 20, 21, 22, 23, 24],
        [17, 16, 15, 14, 13, 12, 11, 10],
        [1, 2, 3, 4, 5, 6, 7, 8, 9]
    ];


    // ========================================
    // 盤面
    // ========================================

    rows.forEach((row) => {

        const rowElement =
            document.createElement("div");

        rowElement.className =
            "boardRow";

        const maxCells = 9;

        const emptyCells =
            maxCells - row.length;

        const sideSpace =
            emptyCells / 2;

        rowElement.style.paddingLeft =
            `${sideSpace * 11.111}%`;

        rowElement.style.paddingRight =
            `${sideSpace * 11.111}%`;


        row.forEach((position) => {

            const cell =
                document.createElement("div");

            cell.className =
                "cell";


            // 45 = ゴール
            if (position === 45) {

                cell.classList.add("goal");

            }
            
            // 43・44 = 危険マス
            if (position === 43 || position === 44) {
                
                cell.classList.add("danger");
            }  


            // 数字
            cell.innerHTML =
                position === 45
                    ? "<strong>45</strong>"
                    : position;


            // このマスにいるプレイヤー
            const cellPlayers =
                players.filter(
                    player =>
                        player.position === position
                );


            cellPlayers.forEach((player, index) => {

                const dot =
                    document.createElement("div");

                dot.className =
                    "playerDot";

                dot.textContent =
                    player.name.substring(0, 1);


                dot.style.left =
                    `${5 + (index % 3) * 30}%`;

                dot.style.top =
                    `${5 + Math.floor(index / 3) * 30}%`;


                // 自分
                if (player.id === myId) {

                    dot.style.background =
                        "#d32f2f";

                }


                cell.appendChild(dot);

            });


            rowElement.appendChild(cell);

        });


        board.appendChild(rowElement);

    });


    // ========================================
    // START地点
    // ========================================

    const startRow =
        document.createElement("div");

    startRow.className =
        "startRow";


    const startCell =
        document.createElement("div");

    startCell.className =
        "startCell";


    const startLabel =
        document.createElement("div");

    startLabel.className =
        "startLabel";

    startLabel.textContent =
        "START";


    const startNumber =
        document.createElement("div");

    startNumber.className =
        "startNumber";

  

    startCell.appendChild(startLabel);
    startCell.appendChild(startNumber);


    // STARTにいるプレイヤー
    const startPlayers =
        players.filter(
            player =>
                player.position === 0
        );


    startPlayers.forEach((player, index) => {

        const dot =
            document.createElement("div");

        dot.className =
            "playerDot startPlayer";

        dot.textContent =
            player.name.substring(0, 1);


        dot.style.left =
            `${5 + (index % 5) * 19}%`;

        dot.style.top =
            `${55 + Math.floor(index / 5) * 20}%`;


        if (player.id === myId) {

            dot.style.background =
                "#d32f2f";

        }


        startCell.appendChild(dot);

    });


    startRow.appendChild(startCell);


    // ★重要
    // STARTを一番下にする
    board.appendChild(startRow);

}

// ========================================
// Screen switching
// ========================================

function showWaiting() {

    lobby.classList.add("hidden");
    waiting.classList.remove("hidden");
    game.classList.add("hidden");
    finished.classList.add("hidden");

}

function showGame() {

    lobby.classList.add("hidden");
    waiting.classList.add("hidden");
    game.classList.remove("hidden");
    finished.classList.add("hidden");

}

function showFinished() {

    lobby.classList.add("hidden");
    waiting.classList.add("hidden");
    game.classList.add("hidden");
    finished.classList.remove("hidden");

}


// ========================================
// Game finished
// ========================================

socket.on("gameFinished", data => {

    showFinished();

    finalRanking.innerHTML = "";

    data.ranking.forEach(player => {

        const row =
            document.createElement("div");

        row.className =
            "finalRow";

        row.innerHTML = `
            <div>
                ${player.rank}位
            </div>

            <div>
                ${escapeHtml(player.name)}
            </div>

            <div>
                ${player.position}マス
            </div>
        `;

        finalRanking.appendChild(row);

    });

});


// ========================================
// HTML escape
// ========================================

function escapeHtml(value) {

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}