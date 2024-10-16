// Define constants for board size and player colors
const BOARD_SIZE = 10;
const PLAYER_WHITE = 'white';
const PLAYER_BLACK = 'black';

// Initialize game state variables
let currentPlayer = PLAYER_BLACK; // Current player's turn
let playMode = true; // Whether the game is in play mode or editor mode
let showNotation = false; // Whether to show algebraic notation on the board
let jumped = false;


// Initialize the game board and player inventories
const board = [];
const inventory = {
    [PLAYER_WHITE]: { tiles: 9, discs: 6, rings: 3, capturedDiscs: 0, capturedRings: 0 },
    [PLAYER_BLACK]: { tiles: 9, discs: 6, rings: 3, capturedDiscs: 0, capturedRings: 0 }
};

// Variables for piece selection and movement
let selectedPiece = null; // Currently selected piece
let possibleMoves = []; // Possible moves for the selected piece
let currentAction = null; // Current action being performed (e.g., place tile, move piece)

// Add these variables at the top of your file
let editorMode = false;
let selectedEditorPiece = null;

// Function to initialize the game board
function initializeBoard() {
    const boardElement = document.getElementById('board');
    boardElement.innerHTML = '';

    for (let row = 0; row < BOARD_SIZE; row++) {
        board[row] = [];
        for (let col = 0; col < BOARD_SIZE; col++) {
            const hex = document.createElement('div');
            hex.className = `hex ${row % 2 === 0 ? 'even-row' : ''}`;
            hex.dataset.row = row;
            hex.dataset.col = col;

            if (showNotation) {
                const notation = getAlgebraicNotation(row, col);
                hex.dataset.notation = notation;
            }

            boardElement.appendChild(hex);
            board[row][col] = { element: hex, tile: null, piece: null };
        }
    }

    setupInitialState();

    // Add this at the end of the function
    document.querySelectorAll('.editor-button').forEach(button => {
        button.addEventListener('click', handleEditorButtonClick);
    });
}

// Function to set up the initial game state
function setupInitialState() {
    // Clear the board
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            board[row][col].tile = null;
            board[row][col].piece = null;
        }
    }

    // Reset player inventories
    inventory[PLAYER_WHITE] = { tiles: 9, discs: 6, rings: 3, capturedDiscs: 0, capturedRings: 0 };
    inventory[PLAYER_BLACK] = { tiles: 9, discs: 6, rings: 3, capturedDiscs: 0, capturedRings: 0 };

    // Place initial pieces on the board without affecting inventory
    board[5][4].tile = { color: PLAYER_WHITE };
    board[5][5].tile = { color: PLAYER_WHITE };
    board[5][4].piece = { type: 'disc', color: PLAYER_WHITE };
    board[4][4].tile = { color: PLAYER_BLACK };
    board[4][5].tile = { color: PLAYER_BLACK };
    board[4][5].piece = { type: 'disc', color: PLAYER_BLACK };

    // Manually adjust inventory for initial setup
    inventory[PLAYER_WHITE].tiles -= 2;
    inventory[PLAYER_WHITE].discs -= 1;
    inventory[PLAYER_BLACK].tiles -= 2;
    inventory[PLAYER_BLACK].discs -= 1;

    updateAllDisplays();
}

// Function to convert row and column to algebraic notation
function getAlgebraicNotation(row, col) {
    const letter = String.fromCharCode(65 + col);
    const number = BOARD_SIZE - row;
    return `${letter}${number}`;
}

// Function to place a tile on the board
function placeTile(row, col, color) {
    if (!board[row][col].tile && inventory[color].tiles > 0) {
        board[row][col].tile = { color };
        inventory[color].tiles--;
        return true;
    }
    return false;
}

// Function to place a piece on the board
function placePiece(row, col, type, color) {
    if (!board[row][col].piece && 
        ((type === 'disc' && inventory[color].discs > 0) || 
         (type === 'ring' && inventory[color].rings > 0))) {
        board[row][col].piece = { type, color };
        if (type === 'disc') {
            inventory[color].discs--;
        } else if (type === 'ring') {
            inventory[color].rings--;
            if (!editorMode) {
                inventory[color].capturedDiscs--;
                inventory[otherPlayer()].discs++;
            }
        }
        return true;
    }
    return false;
}

// Function to update the inventory display
function updateInventoryDisplay() {
    document.getElementById('white-tiles').textContent = inventory[PLAYER_WHITE].tiles;
    document.getElementById('white-discs').textContent = inventory[PLAYER_WHITE].discs;
    document.getElementById('white-rings').textContent = inventory[PLAYER_WHITE].rings;
    document.getElementById('white-captured-discs').textContent = inventory[PLAYER_WHITE].capturedDiscs;
    document.getElementById('white-captured-rings').textContent = inventory[PLAYER_WHITE].capturedRings;
    document.getElementById('black-tiles').textContent = inventory[PLAYER_BLACK].tiles;
    document.getElementById('black-discs').textContent = inventory[PLAYER_BLACK].discs;
    document.getElementById('black-rings').textContent = inventory[PLAYER_BLACK].rings;
    document.getElementById('black-captured-discs').textContent = inventory[PLAYER_BLACK].capturedDiscs;
    document.getElementById('black-captured-rings').textContent = inventory[PLAYER_BLACK].capturedRings;
}

// Function to toggle notation display
function toggleNotation() {
    showNotation = !showNotation;
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            const hex = board[row][col].element;
            if (showNotation) {
                hex.dataset.notation = getAlgebraicNotation(row, col);
            } else {
                delete hex.dataset.notation;
            }
        }
    }
}

// Function to toggle between play and editor mode
function toggleMode() {
    editorMode = !editorMode;
    document.getElementById('editor-controls').style.display = editorMode ? 'block' : 'none';
    document.getElementById('game-controls').style.display = editorMode ? 'none' : 'block';
    document.getElementById('toggle-mode').textContent = editorMode ? 'Enter Play Mode' : 'Enter Editor Mode';
    clearSelection();
    currentAction = null;
    selectedEditorPiece = null;
    updateAllDisplays();
}

// Function to handle board clicks
function handleBoardClick(event) {
    if (editorMode) {
        handleEditorBoardClick(event);
        return;
    }

    const hex = event.target.closest('.hex');
    if (!hex) return;

    const row = parseInt(hex.dataset.row);
    const col = parseInt(hex.dataset.col);

    // Handle different actions based on the current action
    if (currentAction === 'place-tile') {
        if (canPlaceTile(row, col)) {
            placeTile(row, col, currentPlayer);
            endTurn();
        }
    } else if (currentAction === 'place-disc') {
        if (canPlacePiece(row, col) && inventory[currentPlayer].discs > 0) {
            placePiece(row, col, 'disc', currentPlayer);
            endTurn();
        }
    } else if (currentAction === 'place-ring') {
        if (canPlacePiece(row, col) && inventory[currentPlayer].rings > 0 && inventory[currentPlayer].capturedDiscs > 0) {
            placePiece(row, col, 'ring', currentPlayer);
            endTurn();
        }
    } else if (currentAction === 'move-piece') {
        if (selectedPiece) {
            if (possibleMoves.some(move => move.row === row && move.col === col)) {
                movePiece(selectedPiece, row, col);
                if (!jumped){
                    endTurn();
                } else {
                    selectedPiece = { row, col };
                    possibleMoves = getLegalMoves(row, col);
                    if (possibleMoves.length > 0) {
                        highlightPossibleMoves(possibleMoves); // Highlight legal moves
                    } else {
                        endTurn();
                    }
                }
            } else {
            }
        } else {
            const piece = board[row][col].piece;
            if (piece && piece.color === currentPlayer) {
                selectedPiece = { row, col };
                possibleMoves = getLegalMoves(row, col);
                highlightPossibleMoves(possibleMoves); // Highlight legal moves
            } else {
            }
        }
    }
    updateAllDisplays();
}

// Function to handle clicks in editor mode
function handleEditorBoardClick(event) {
    const hex = event.target.closest('.hex');
    if (!hex) return;

    const row = parseInt(hex.dataset.row);
    const col = parseInt(hex.dataset.col);

    if (selectedEditorPiece) {
        if (selectedEditorPiece.type === 'remove') {
            // Remove any existing piece or tile
            if (board[row][col].piece) {
                removePiece(row, col);
            }
            if (board[row][col].tile) {
                removeTile(row, col);
            }
        } else if (selectedEditorPiece.type === 'tile') {
            if (inventory[selectedEditorPiece.color].tiles > 0) {
                placeTile(row, col, selectedEditorPiece.color);
            }
        } else {
            if ((selectedEditorPiece.type === 'disc' && inventory[selectedEditorPiece.color].discs > 0) ||
                (selectedEditorPiece.type === 'ring' && inventory[selectedEditorPiece.color].rings > 0)) {
                placePiece(row, col, selectedEditorPiece.type, selectedEditorPiece.color);
            }
        }
        updateAllDisplays();
    }
}

// Function to handle editor button clicks
function handleEditorButtonClick(event) {
    const button = event.currentTarget;
    
    document.querySelectorAll('.editor-button').forEach(btn => btn.classList.remove('selected'));
    button.classList.add('selected');

    if (button.id === 'remove') {
        selectedEditorPiece = { type: 'remove' };
    } else {
        const type = button.dataset.type;
        const color = button.dataset.color;
        selectedEditorPiece = { type, color };
    }
}

// Function to remove a piece from the board
function removePiece(row, col) {
    if (board[row][col].piece) {
        const piece = board[row][col].piece;
        if (piece.type === 'disc') {
            inventory[piece.color].discs++;
        } else if (piece.type === 'ring') {
            inventory[piece.color].rings++;
        }
        board[row][col].piece = null;
        return true;
    }
    return false;
}

// Function to check if a tile can be placed at a given position
function canPlaceTile(row, col) {
    if (board[row][col].tile) return false;
    
    const directions = row % 2 === 0 ?
         [[-1, 0], [-1, 1], [0, 1], [1, 1], [1, 0], [0, -1]] : // Even row
         [[-1, -1], [-1, 0], [0, 1], [1, 0], [1, -1], [0, -1]] ; // Odd row
    
    let adjacentTiles = 0;
    for (const [dx, dy] of directions) {
        const newRow = row + dx;
        const newCol = col + dy;
        if (isValidPosition(newRow, newCol) && board[newRow][newCol].tile) {
            adjacentTiles++;
        }
    }
    
    return adjacentTiles >= 2;
}

// Function to check if a piece can be placed at a given position
function canPlacePiece(row, col) {
    return board[row][col].tile && 
           board[row][col].tile.color === currentPlayer && 
           !board[row][col].piece;
}

// Function to highlight valid tile placements
function highlightValidTilePlacements() {
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            if (canPlaceTile(row, col)) {
                // Add a visible element to the hex
                const highlightElement = document.createElement('div');
                highlightElement.className = 'highlight-indicator';
                board[row][col].element.appendChild(highlightElement);
            }
        }
    }
}

// Function to highlight valid piece placements
function highlightValidPiecePlacements() {
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            if (canPlacePiece(row, col)) {
                // Add a visible element to the hex
                const highlightElement = document.createElement('div');
                highlightElement.className = 'highlight-indicator';
                board[row][col].element.appendChild(highlightElement);
            }
        }
    }
}

// Function to highlight movable pieces
function highlightMovablePieces() {
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            const piece = board[row][col].piece;
            if (piece && piece.color === currentPlayer) {
                const moves = getLegalMoves(row, col);
                if (moves.length > 0) {
                    // Highlight the piece if it has legal moves
                    const highlightElement = document.createElement('div');
                    highlightElement.className = 'highlight-indicator';
                    board[row][col].element.appendChild(highlightElement);
                }
            }
        }
    }
}

// Function to get legal moves for a piece
function getLegalMoves(row, col) {
    const moves = [];
    const piece = board[row][col].piece;

    if (!piece) {
        return [];
    }

    if (piece.type === 'disc') {
        // Adjacent moves for discs
        if(!jumped){
            const directions = row % 2 === 0 ?
            [[-1, 0], [-1, 1], [0, 1], [1, 1], [1, 0], [0, -1]] : // Even row
            [[-1, -1], [-1, 0], [0, 1], [1, 0], [1, -1], [0, -1]]; // Odd row
            for (const [dx, dy] of directions) {
                const newRow = row + dx;
                const newCol = col + dy;
                if (isValidPosition(newRow, newCol) && !board[newRow][newCol].piece && board[newRow][newCol].tile) {
                    moves.push({ row: newRow, col: newCol });
                }
            }
        }
        // Jump moves for discs
        const jumpDirections = 
        [[-2, -1], [-2, 1], [0, 2], [2, 1], [2, -1], [0, -2]];

        for (const [dx, dy] of jumpDirections) {
            let offset = 0;
            if (row % 2 === 0) {
                offset = 1;
            }
            const middleRow = row + Math.floor(dx / 2);
            const middleCol = col + Math.floor(dy / 2) + offset;
            const jumpRow = row + dx;
            const jumpCol = col + dy;

            // Check if the positions are valid before accessing them
            if (isValidPosition(middleRow, middleCol) && isValidPosition(jumpRow, jumpCol) && 
                board[middleRow][middleCol].piece &&
                !board[jumpRow][jumpCol].piece &&
                board[jumpRow][jumpCol].tile) {
                moves.push({ row: jumpRow, col: jumpCol });
            }
        }
    } else if (piece.type === 'ring') {
        // Ring moves (distance of 2)
        const ringDirections = row % 2 === 0 ?
            [[-2, -1], [-2, 0], [-2, 1], [-1, 2], [0, 2], [1, 2], [2, 1], [2, 0], [2, -1], [1, -1], [0, -2], [-1, -1]] : // Even row
            [[-2, -1], [-2, 0], [-2, 1], [-1, 1], [0, 2], [1, 1], [2, 1], [2, 0], [2, -1], [1, -2], [0, -2], [-1, -2]]; // Odd row
        for (const [dx, dy] of ringDirections) {
            const newRow = row + dx;
            const newCol = col + dy;
            if (isValidPosition(newRow, newCol) && board[newRow][newCol].tile) {
                const targetPiece = board[newRow][newCol].piece;
                if (targetPiece && targetPiece.color === piece.color) {
                    
                }else{
                    moves.push({ row: newRow, col: newCol });
                }
            }
        }
    }
    return moves;
}

// Function to check if a position is valid on the board
function isValidPosition(row, col) {
    return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

// Function to highlight possible moves for a selected piece
function highlightPossibleMoves(possibleMoves) {
    clearHighlights(); // Clear existing highlights
    console.log("Highlighting possible moves:", possibleMoves); // Debugging output
    for (let i = 0; i < possibleMoves.length; i++) {
        const move = possibleMoves[i];
        const highlightElement = document.createElement('div');
        highlightElement.className = 'highlight-indicator';
        board[move.row][move.col].element.appendChild(highlightElement);
        console.log(`Highlighted move at: (${move.row}, ${move.col})`); // Debugging output
    }
}

// Function to clear all highlights from the board
function clearHighlights() {
    document.querySelectorAll('.highlight-indicator').forEach(indicator => {
        indicator.remove();
    });
}

// Function to clear the current piece selection
function clearSelection() {
    selectedPiece = null;
    possibleMoves = [];
    clearHighlights();
}

// Function to move a piece on the board
function movePiece(from, toRow, toCol) {
    const piece = board[from.row][from.col].piece;
    board[from.row][from.col].piece = null;

    // Check if the move is a jump for discs
    jumped = false;
    if (piece.type === 'disc' && (Math.abs(from.row - toRow) === 2 || Math.abs(from.col - toCol) === 2)) {
        jumped = true;
        let offset = 0;
        if (from.row % 2 === 0) {
            offset = 1;
        }
        const middleRow = from.row + Math.floor((toRow - from.row) / 2);
        const middleCol = from.col + Math.floor((toCol - from.col) / 2) + offset;
        // Capture the jumped piece if it's an opponent's piece
        if (board[middleRow][middleCol].piece && board[middleRow][middleCol].piece.color !== currentPlayer) {
            capturePiece(middleRow, middleCol);
        }
    } else if (piece.type === 'ring') {
        if (board[toRow][toCol].piece && board[toRow][toCol].piece.color !== currentPlayer) {
            capturePiece(toRow, toCol);
        }
    }

    board[toRow][toCol].piece = piece;
    const pieceElement = document.createElement('div');
    pieceElement.className = `piece ${piece.color} ${piece.type}`;
    board[toRow][toCol].element.innerHTML = '';
    board[toRow][toCol].element.appendChild(pieceElement);
}

// Function to switch turns between players
function switchTurn() {
    currentPlayer = currentPlayer === PLAYER_WHITE ? PLAYER_BLACK : PLAYER_WHITE;
    updateAllDisplays();
}

// Function to end the current turn
function endTurn() {
    clearSelection();
    currentAction = null;
    jumped = false;
    if (!checkGameOver()) {
        switchTurn();
    }
}

// Function to update the action buttons based on the current game state
function updateActionButtons() {
    const actions = ['place-tile', 'place-disc', 'place-ring', 'move-piece', 'end-turn'];
    actions.forEach(action => {
        const button = document.getElementById(action);
        const isAvailable = isActionAvailable(action);
        button.classList.toggle('selected-action', currentAction === action);
        button.disabled = !isAvailable;
        button.style.display = isAvailable ? 'inline-block' : 'none';
    });
}

// Function to get the other player's color
function otherPlayer() {
    return currentPlayer === PLAYER_WHITE ? PLAYER_BLACK : PLAYER_WHITE;
}

// Function to check if a tile can be placed anywhere on the board
function canPlaceTileAnywhere() {
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            if (canPlaceTile(row, col)) {
                return true;
            }
        }
    }
    return false;
}

// Function to check if the current player has any movable pieces
function hasMovablePieces() {
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            const piece = board[row][col].piece;
            if (piece && piece.color === currentPlayer && getLegalMoves(row, col).length > 0) {
                return true;
            }
        }
    }
    return false;
}

// Function to check if the game is over
function checkGameOver() {
    if (isGameOver()) {
        const winner = determineWinner();
        displayGameOver(winner);
        return true;
    }
    return false;
}

// Function to determine if the game is over
function isGameOver() {
    return (
        inventory[PLAYER_WHITE].capturedDiscs === 6 ||
        inventory[PLAYER_BLACK].capturedDiscs === 6 ||
        inventory[PLAYER_WHITE].capturedRings === 3 ||
        inventory[PLAYER_BLACK].capturedRings === 3 ||
        !hasValidMoves(currentPlayer) ||
        !hasRemainingPiecesOnBoard(PLAYER_WHITE) ||
        !hasRemainingPiecesOnBoard(PLAYER_BLACK)
    );
}

// Function to check if a player has any remaining pieces on the board
function hasRemainingPiecesOnBoard(player) {
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            const piece = board[row][col].piece;
            if (piece && piece.color === player) {
                return true;
            }
        }
    }
    return false;
}

// Function to check if a player has any valid moves
function hasValidMoves(player) {
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            const piece = board[row][col].piece;
            if (piece && piece.color === player) {
                if (getLegalMoves(row, col).length > 0) {
                    return true;
                }
            }
        }
    }
    return canPlaceTileAnywhere() || canPlacePieceAnywhere();
}

// Function to check if a piece can be placed anywhere on the board
function canPlacePieceAnywhere() {
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            if (canPlacePiece(row, col)) {
                return true;
            }
        }
    }
    return false;
}

// Function to determine the winner of the game
function determineWinner() {
    if (inventory[PLAYER_WHITE].capturedDiscs === 6 || inventory[PLAYER_WHITE].capturedRings === 3 || !hasRemainingPiecesOnBoard(PLAYER_BLACK)) {
        return PLAYER_WHITE;
    } else if (inventory[PLAYER_BLACK].capturedDiscs === 6 || inventory[PLAYER_BLACK].capturedRings === 3 || !hasRemainingPiecesOnBoard(PLAYER_WHITE)) {
        return PLAYER_BLACK;
    } else {
        return 'Ex Aequo';
    }
}

// Function to display the game over screen
function displayGameOver(winner) {
    const gameOverElement = document.createElement('div');
    gameOverElement.id = 'game-over';
    gameOverElement.innerHTML = `
        <h2>Game Over</h2>
        <p>${winner === 'Ex Aequo' ? 'It\'s Ex Aequo!' : `${winner.charAt(0).toUpperCase() + winner.slice(1)} wins!`}</p>
        <button id="reset-game">New Game</button>
    `;
    document.body.appendChild(gameOverElement);

    document.getElementById('reset-game').addEventListener('click', resetGame);
}

// Function to reset the game
function resetGame() {
    document.body.removeChild(document.getElementById('game-over'));
    setupInitialState();
    currentPlayer = PLAYER_BLACK;
    currentAction = null;
}

function removeTile(row, col) {
    if (board[row][col].tile) {
        const tile = board[row][col].tile;
        inventory[tile.color].tiles++;
        board[row][col].tile = null;
        return true;
    }
    return false;
}

function removeHexContents(row, col) {
    const cell = board[row][col];
    if (cell.piece) {
        removePiece(row, col);
    }
    if (cell.tile) {
        removeTile(row, col);
    }
}

// This should be called when the page loads
function initializeGame() {
    // Initialize the game board
    initializeBoard();

    // Set up initial game state
    setupInitialState();

    // Add event listener to the game board
    document.getElementById('board').addEventListener('click', handleBoardClick);

    // Set up event listeners for game controls
    setupEventListeners();

    // Initialize game variables
    currentPlayer = PLAYER_BLACK;
    currentAction = null;

    // Set the game to play mode by default
    editorMode = false;
    document.getElementById('editor-controls').style.display = 'none';
    document.getElementById('game-controls').style.display = 'block';

    // Update the display
    updateAllDisplays();
}

function setupEventListeners() {
    document.getElementById('toggle-notation').addEventListener('click', toggleNotation);
    document.getElementById('toggle-mode').addEventListener('click', toggleMode);
    document.querySelectorAll('.editor-button').forEach(button => {
        button.addEventListener('click', handleEditorButtonClick);
    });
    document.getElementById('place-tile').addEventListener('click', () => setCurrentAction('place-tile'));
    document.getElementById('place-disc').addEventListener('click', () => setCurrentAction('place-disc'));
    document.getElementById('place-ring').addEventListener('click', () => setCurrentAction('place-ring'));
    document.getElementById('move-piece').addEventListener('click', () => setCurrentAction('move-piece'));
    document.getElementById('end-turn').addEventListener('click', endTurn);
}

function setCurrentAction(action) {
    currentAction = action;
    updateAllDisplays();
    clearSelection();
    if (action === 'place-tile') {
        highlightValidTilePlacements();
    } else if (action === 'place-disc' || action === 'place-ring') {
        highlightValidPiecePlacements();
    } else if (action === 'move-piece') {
        highlightMovablePieces();
    }
}

function isActionAvailable(action) {
    switch (action) {
        case 'place-tile':
            return inventory[currentPlayer].tiles > 0 && canPlaceTileAnywhere() && !jumped;
        case 'place-disc':
            return inventory[currentPlayer].discs > 0 && canPlacePieceAnywhere() && !jumped;
        case 'place-ring':
            return inventory[currentPlayer].rings > 0 && inventory[currentPlayer].capturedDiscs > 0 && canPlacePieceAnywhere() && !jumped;
        case 'move-piece':
            return hasMovablePieces(currentPlayer) && !jumped;
        case 'end-turn':
            return jumped; // End turn is only available if a piece has jumped
        default:
            return false;
    }
}

function capturePiece(row, col) {
    const piece = board[row][col].piece;
    if (piece) {
        const capturedBy = piece.color === PLAYER_WHITE ? PLAYER_BLACK : PLAYER_WHITE;
        if (piece.type === 'disc') {
            inventory[capturedBy].capturedDiscs++;
        } else if (piece.type === 'ring') {
            inventory[capturedBy].capturedRings++;
        }
        board[row][col].piece = null;
    }
}

function updateBoardDisplay() {
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            const cell = board[row][col];
            const hexElement = cell.element;

            // Clear existing content except for highlights
            hexElement.innerHTML = hexElement.querySelector('.highlight-indicator') ? hexElement.querySelector('.highlight-indicator').outerHTML : '';

            // Add tile if present
            if (cell.tile) {
                const tileElement = document.createElement('div');
                tileElement.className = `tile ${cell.tile.color}`;
                hexElement.insertBefore(tileElement, hexElement.firstChild);
            }

            // Add piece if present
            if (cell.piece) {
                const pieceElement = document.createElement('div');
                pieceElement.className = `piece ${cell.piece.type} ${cell.piece.color}`;
                hexElement.insertBefore(pieceElement, hexElement.firstChild);
            }

            // Update notation if enabled
            if (showNotation) {
                const notationElement = document.createElement('div');
                notationElement.className = 'notation';
                hexElement.insertBefore(notationElement, hexElement.firstChild);
            }

            // Add highlight if present
            if (cell.highlight) {
                const highlightElement = document.createElement('div');
                highlightElement.className = 'highlight-indicator';
                hexElement.insertBefore(highlightElement, hexElement.firstChild);
                console.log("highlight updated");
            }
        }
    }
}

function updateCurrentPlayerDisplay() {
    const currentPlayerElement = document.getElementById('current-player');
    currentPlayerElement.textContent = `Current Player: ${currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1)}`;
}

// Add this function to update all displays
function updateAllDisplays() {
    updateBoardDisplay();
    updateInventoryDisplay();
    updateCurrentPlayerDisplay();
    updateActionButtons();
}

// Make sure to call this function when the page loads
window.addEventListener('load', initializeGame);

function resetCaptures() {
    // Add captured pieces to the other player's inventory before resetting
    inventory[PLAYER_BLACK].discs += inventory[PLAYER_WHITE].capturedDiscs;
    inventory[PLAYER_BLACK].rings += inventory[PLAYER_WHITE].capturedRings;
    inventory[PLAYER_WHITE].discs += inventory[PLAYER_BLACK].capturedDiscs;
    inventory[PLAYER_WHITE].rings += inventory[PLAYER_BLACK].capturedRings;
    // Reset captured discs and rings for both players
    inventory[PLAYER_WHITE].capturedDiscs = 0;
    inventory[PLAYER_WHITE].capturedRings = 0;
    inventory[PLAYER_BLACK].capturedDiscs = 0;
    inventory[PLAYER_BLACK].capturedRings = 0;

    // Update the inventory display
    updateInventoryDisplay();
}

document.getElementById('reset-captures').addEventListener('click', resetCaptures);

// Function to open the rules modal
function openRules() {
    document.getElementById('rules-modal').style.display = 'block';
    document.getElementById('game-container').style.display = 'none'; // Hide the game

}

// Function to close the rules modal
function closeRules() {
    document.getElementById('rules-modal').style.display = 'none';
    document.getElementById('game-container').style.display = 'block'; // Show the game
}

// Event listeners for opening and closing the modal
document.getElementById('open-rules').addEventListener('click', openRules);
document.getElementById('close-rules').addEventListener('click', closeRules);

// Close the modal when clicking outside of the modal content
window.addEventListener('click', function(event) {
    const modal = document.getElementById('rules-modal');
    if (event.target === modal) {
        closeRules();
    }
});