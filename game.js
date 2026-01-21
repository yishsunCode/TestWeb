const size = 4;
const TILE = 72; // matches CSS
const GAP = 10;
// board holds either null or tile object {id, value}
let board = Array.from({ length: size }, () => Array(size).fill(null));
const boardDiv = document.getElementById("board");

let nextTileId = 1;

// cache for raw collision SVG text per value
const _rawCollisionSvgCache = new Map();
// cache for colored data-uris per value+color
const _coloredCollisionCache = new Map();

function rgbToHex(rgb){
  if (!rgb) return rgb;
  // already hex
  if (rgb[0] === '#') return rgb;
  const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return rgb;
  const r = parseInt(m[1]); const g = parseInt(m[2]); const b = parseInt(m[3]);
  return '#' + [r,g,b].map(v => v.toString(16).padStart(2,'0')).join('');
}

async function fetchRawCollisionSvg(value){
  if (_rawCollisionSvgCache.has(value)) return _rawCollisionSvgCache.get(value);
  try{
    const res = await fetch(`assets/collision_${value}.svg`);
    if (!res.ok) throw new Error('not found');
    const txt = await res.text();
    _rawCollisionSvgCache.set(value, txt);
    return txt;
  }catch(e){
    return null;
  }
}

async function getColoredCollisionDataUrl(value, colorHex){
  const key = `${value}|${colorHex}`;
  if (_coloredCollisionCache.has(key)) return _coloredCollisionCache.get(key);
  const raw = await fetchRawCollisionSvg(value);
  if (!raw) return `assets/collision_${value}.svg`; // fallback to original url

  // replace common black color occurrences (stroke/fill) with desired color
  const replaced = raw.replace(/(stroke|fill)=(['"])(?:#000000|#000|black)\2/gi, `$1=$2${colorHex}$2`);

  // produce a data URI (encodeURIComponent to keep it safe)
  const dataUrl = 'data:image/svg+xml;utf8,' + encodeURIComponent(replaced);
  _coloredCollisionCache.set(key, dataUrl);
  return dataUrl;
}

function makeTile(value){
  return { id: nextTileId++, value };
}

function init() {
  createBackgroundCells();
  board = Array.from({ length: size }, () => Array(size).fill(null));
  addRandom();
  addRandom();
  renderStaticTiles(true);
  attachControls();
  document.getElementById('restart').addEventListener('click', restart);
}

function restart(){
  // reset game
  board = Array.from({ length: size }, () => Array(size).fill(null));
  nextTileId = 1;
  addRandom(); addRandom();
  renderStaticTiles(true);
}

function createBackgroundCells() {
  boardDiv.innerHTML = '';
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const bg = document.createElement('div');
      bg.className = 'cell-bg';
      bg.style.left = `${c * (TILE + GAP)}px`;
      bg.style.top = `${r * (TILE + GAP)}px`;
      boardDiv.appendChild(bg);
    }
  }
}

function addRandom() {
  const empty = [];
  board.forEach((row, r) => row.forEach((v, c) => { if (v === null) empty.push([r, c]); }));
  if (empty.length === 0) return;
  const [r, c] = empty[Math.floor(Math.random() * empty.length)];
  board[r][c] = makeTile(Math.random() < 0.9 ? 2 : 4);
}

function renderStaticTiles(initial=false){
  // remove existing dynamic tiles
  const existing = Array.from(boardDiv.querySelectorAll('.tile'));
  existing.forEach(n => n.remove());
  for (let r=0;r<size;r++){
    for (let c=0;c<size;c++){
      const t = board[r][c];
      if (!t) continue;
      const el = createTileElement(t.value, t.id);
      setPosition(el, r, c);
      if (initial) el.classList.add('pop');
      boardDiv.appendChild(el);
      setTimeout(() => el.classList.remove('pop'), 220);
    }
  }
}

function createTileElement(value, id){
  const el = document.createElement('div');
  el.className = 'tile v' + value;
  // Use SVG assets directly if present in assets/tile_<value>.svg
  const svgPath = `assets/tile_${value}.svg`;
  // set as background image (browser will 404 silently if missing)
  el.style.backgroundImage = `url(${svgPath})`;
  el.classList.add('asset');
  // SVG will contain the visible number/graphics. Keep an aria-label for accessibility.
  el.setAttribute('aria-label', String(value));
  el.dataset.id = id;
  return el;
}

function setPosition(el, r, c){
  const x = c * (TILE + GAP);
  const y = r * (TILE + GAP);
  el.style.transform = `translate(${x}px, ${y}px)`;
}

// produce move list: list of {id, from:[r,c], to:[r,c], value, merged(boolean)}
function computeMoves(dir){
  const vector = { left: [0,-1], right: [0,1], up: [-1,0], down: [1,0] }[dir];
  const traversals = { x: [...Array(size).keys()], y: [...Array(size).keys()] };
  if (dir === 'right') traversals.x = traversals.x.reverse();
  if (dir === 'down') traversals.y = traversals.y.reverse();

  const moves = [];
  // clone board values for processing
  const b = board.map(row => row.map(cell => cell ? { ...cell } : null));
  const merged = Array.from({length:size}, ()=>Array(size).fill(false));

  for (let r of traversals.y){
    for (let c of traversals.x){
      const cell = b[r][c];
      if (!cell) continue;
      let cr = r, cc = c;
      while(true){
        const nr = cr + vector[0];
        const nc = cc + vector[1];
        if (nr<0||nr>=size||nc<0||nc>=size) break;
        if (b[nr][nc] === null){
          b[nr][nc] = b[cr][cc]; b[cr][cc]=null; cr=nr; cc=nc; continue;
        }
        if (b[nr][nc].value === b[cr][cc].value && !merged[nr][nc]){
          // merge into nr,nc
          b[nr][nc].value *= 2;
          b[cr][cc] = null;
          merged[nr][nc] = true;
          // record merged move and include target id if exists
          const targetId = b[nr][nc].id || null;
          moves.push({ id: cell.id, from: [r,c], to: [nr,nc], value: cell.value, merged:true, targetId });
          break;
        }
        break;
      }
      if ((cr !== r) || (cc !== c)){
        // moved (and possibly later merged recorded)
        // if already recorded as merged above, skip duplicate add; otherwise record as move
        const already = moves.find(m => m.id === cell.id && m.from[0]===r && m.from[1]===c);
        if (!already) moves.push({ id: cell.id, from: [r,c], to: [cr,cc], value: cell.value, merged:false });
      }
    }
  }
  return moves;
}

function applyMovesToModel(moves){
  // apply moves and merges to board model deterministically
  // first, map ids to current positions
  const idPos = new Map();
  for (let r=0;r<size;r++) for (let c=0;c<size;c++) if (board[r][c]) idPos.set(board[r][c].id, [r,c]);

  // apply non-merge moves first
  moves.filter(m=>!m.merged).forEach(m => {
    const [fr,fc] = m.from; board[fr][fc] = null;
  });
  moves.filter(m=>!m.merged).forEach(m => {
    const [tr,tc] = m.to; board[tr][tc] = makeTile(m.value); // keep id new? to avoid conflict we'll assign new id
  });

  // merges: find moves with merged flag and set target value accordingly
  moves.filter(m=>m.merged).forEach(m => {
    const [fr,fc] = m.from; board[fr][fc] = null;
    const [tr,tc] = m.to;
    board[tr][tc] = makeTile(m.value * 2);
  });
}

function animateMoves(moves){
  if (moves.length === 0) return;
  // create elements for current tiles (by id)
  const idToEl = new Map();
  boardDiv.querySelectorAll('.tile').forEach(el => idToEl.set(Number(el.dataset.id), el));

  // For tiles that moved but their DOM el isn't present (edgecases), create a snapshot el
  moves.forEach(m => {
    if (!idToEl.has(m.id)){
      const el = createTileElement(m.value, m.id);
      setPosition(el, m.from[0], m.from[1]);
      boardDiv.appendChild(el);
      idToEl.set(m.id, el);
    }
  });

  // animate each element to its target
  moves.forEach(m => {
    const el = idToEl.get(m.id);
    // ensure class color matches value
    el.className = 'tile v' + m.value;
    requestAnimationFrame(()=>{
      el.style.transition = 'transform 140ms ease';
      setPosition(el, m.to[0], m.to[1]);
    });
    // if merged, after arrival pop and then remove (final tile will be re-rendered)
    if (m.merged){
      // For merged moves, make the target (被撞擊) tile change face during the movement.
      // Find the target element by id (if available) so we can swap its background to the collision SVG and bring it to front.
      const targetEl = m.targetId ? idToEl.get(Number(m.targetId)) : null;
      const finalTileSvg = `assets/tile_${m.value * 2}.svg`;

      // determine collision face color: prefer target element's text color (if present),
      // otherwise fall back to the configured .tile.v<value> color in CSS
      let faceColor = null;
      if (targetEl) {
        try{
          const cs = window.getComputedStyle(targetEl);
          faceColor = cs && (cs.color || cs.fill || cs.stroke) || null;
        }catch(e){ faceColor = null }
      }
      if (!faceColor){
        // look up a representative element for the value class
        const probe = document.createElement('div');
        probe.className = 'tile v' + m.value;
        document.body.appendChild(probe);
        const cs = window.getComputedStyle(probe);
        faceColor = cs && (cs.color || cs.fill || cs.stroke) || '#000';
        probe.remove();
      }
      const faceHex = rgbToHex(faceColor) || '#000';

      // get a data URI for the colored collision svg (async). We'll set a fallback url first.
      const fallbackCollision = `assets/collision_${m.value}.svg`;
      // start with fallback so user sees something immediately
      if (targetEl && targetEl.dataset && targetEl.dataset.id) {
        targetEl.style.zIndex = 6;
        targetEl.dataset._origBg = targetEl.style.backgroundImage || '';
        targetEl.style.backgroundImage = `url(${fallbackCollision})`;
        targetEl.classList.add('asset');
      }

      // async: fetch and colorize SVG then set as background (if still present)
      getColoredCollisionDataUrl(m.value, faceHex).then(dataUrl => {
        // if targetEl is still in DOM, apply the colored data url and add pop
        if (targetEl && targetEl.isConnected) {
          targetEl.style.backgroundImage = `url(${dataUrl})`;
          targetEl.classList.add('pop');
          setTimeout(()=> targetEl.classList.remove('pop'), 220);
        } else {
          // create an overlay using colored data url
          const overlayTgt = document.createElement('div');
          overlayTgt.className = 'tile collision tgt pop';
          overlayTgt.style.backgroundImage = `url(${dataUrl})`;
          setPosition(overlayTgt, m.to[0], m.to[1]);
          overlayTgt.style.zIndex = 6;
          boardDiv.appendChild(overlayTgt);
          targetEl = overlayTgt;
          setTimeout(()=> overlayTgt.classList.remove('pop'), 220);
        }
      }).catch(()=>{
        // ignore - keep fallback
      });

      // ensure moving tile is underneath
      el.style.zIndex = 2;

      setTimeout(()=>{
        // remove moving tile
        setTimeout(()=> el.remove(), 40);

        // after movement, restore/replace target to final tile
        setTimeout(()=>{
          if (targetEl) {
            // if it was a real tile element, set its background to the final tile svg and reset z-index
            if (targetEl.dataset && targetEl.dataset.id) {
              targetEl.style.backgroundImage = `url(${finalTileSvg})`;
              targetEl.style.zIndex = 2;
            } else {
              // overlay fallback: remove it and let renderStaticTiles create the final tile
              targetEl.remove();
            }
          }
        }, 80);
      }, 160);
    } else {
      // remove after move; final board will be rendered
      setTimeout(()=> el.remove(), 180);
    }
  });
}

function slide(dir){
  const moves = computeMoves(dir);
  if (moves.length === 0) return;
  animateMoves(moves);
  applyMovesToModel(moves);
  setTimeout(()=>{ addRandom(); renderStaticTiles(); }, 180);
}

// Keyboard controls
document.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft') slide('left');
  if (e.key === 'ArrowRight') slide('right');
  if (e.key === 'ArrowUp') slide('up');
  if (e.key === 'ArrowDown') slide('down');
});

// Touch / swipe controls
function attachControls(){
  let startX = 0, startY = 0;
  const threshold = 20; // minimum px to be considered swipe

  boardDiv.addEventListener('touchstart', e => {
    const t = e.touches[0];
    startX = t.clientX; startY = t.clientY;
  }, {passive:true});

  boardDiv.addEventListener('touchmove', e => {
    // prevent scrolling while swiping inside board
    e.preventDefault();
  }, {passive:false});

  boardDiv.addEventListener('touchend', e => {
    const touch = e.changedTouches[0];
    const distX = touch.clientX - startX;
    const distY = touch.clientY - startY;
    if (Math.abs(distX) < threshold && Math.abs(distY) < threshold) return;
    if (Math.abs(distX) > Math.abs(distY)) {
      if (distX > 0) slide('right'); else slide('left');
    } else {
      if (distY > 0) slide('down'); else slide('up');
    }
  });
}

init();
