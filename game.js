const board = Array.from({ length: 4 }, () => Array(4).fill(0));
const boardDiv = document.getElementById("board");

function init() {
  addRandom();
  addRandom();
  render();
}

function addRandom() {
  const empty = [];
  board.forEach((row, r) =>
    row.forEach((v, c) => {
      if (v === 0) empty.push([r, c]);
    })
  );
  if (empty.length === 0) return;
  const [r, c] = empty[Math.floor(Math.random() * empty.length)];
  board[r][c] = Math.random() < 0.9 ? 2 : 4;
}

function render() {
  boardDiv.innerHTML = "";
  board.flat().forEach(v => {
    const cell = document.createElement("div");
    cell.className = "cell";
    cell.textContent = v === 0 ? "" : v;
    boardDiv.appendChild(cell);
  });
}

document.addEventListener("keydown", e => {
  if (e.key === "ArrowLeft") {
    moveLeft();
    addRandom();
    render();
  }
});

function moveLeft() {
  for (let r = 0; r < 4; r++) {
    let row = board[r].filter(v => v);
    for (let i = 0; i < row.length - 1; i++) {
      if (row[i] === row[i + 1]) {
        row[i] *= 2;
        row[i + 1] = 0;
      }
    }
    row = row.filter(v => v);
    while (row.length < 4) row.push(0);
    board[r] = row;
  }
}

init();
