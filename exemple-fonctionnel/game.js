// Define constants for board size and player colors
const BOARD_SIZE = 10;
const PLAYER_WHITE = 'white';
const PLAYER_BLACK = 'black';

// Configuration de l'entraînement
const trainingConfig = {
    gamesPerIteration: 2,
    iterations: 1,
    maxTimePerMove: 1000
};

// Initialize game state variables
let currentPlayer = PLAYER_BLACK; // Current player's turn
let playMode = true; // Whether the game is in play mode or editor mode
let showNotation = false; // Whether to show algebraic notation on the board
let jumped = false;

// Add these variables at the top of your file
let editorMode = false;
let selectedEditorPiece = null;
let aiPlayer = null;
let aiEnabled = false;
let gameHistory = null;
let lastMove = null;  // Pour stocker le dernier coup joué
let moveHistory = [];  // Pour stocker l'historique des mouvements
const MAX_REPETITIONS = 3;  // Nombre maximum de répétitions autorisées
let rewards = {
    [PLAYER_WHITE]: 0,
    [PLAYER_BLACK]: 0
};

class AIController {
    constructor() {
        try {
            this.neuralNetwork = new HexaequoAI.NeuralNetwork();
            this.mcts = new HexaequoAI.MCTS(this.neuralNetwork);
            this.isReady = false;
            this.debugMode = true;
        } catch (error) {
            console.error('Error initializing AIController:', error);
            throw error;
        }
    }

    log(...args) {
        if (this.debugMode) {
            console.log('[AI]', ...args);
        }
    }

    async initialize() {
        try {
            console.log('Starting AI initialization...');
            await this.neuralNetwork.initializeNetwork();
            this.isReady = true;
            console.log("AI initialized successfully");
        } catch (error) {
            console.error("Failed to initialize AI:", error);
            throw error;
        }
    }

    async getMove(gameState) {
        if (!this.isReady) {
            throw new Error("AI not initialized");
        }

        this.log('Getting move for state:', gameState);

        const alphaZeroState = this.convertToAlphaZeroState(gameState);
        this.log('Converted to AlphaZero state:', alphaZeroState);

        const startTime = performance.now();
        const action = await this.mcts.search(alphaZeroState);
        const endTime = performance.now();
        
        this.log('MCTS search completed in', (endTime - startTime).toFixed(2), 'ms');
        this.log('Selected action:', action);

        const convertedAction = this.convertFromAlphaZeroAction(action);
        this.log('Converted action:', convertedAction);
        
        return convertedAction;
    }

    convertToAlphaZeroState(gameState) {
        return new HexaequoAI.HexaequoState(
            gameState.board,
            gameState.inventory,
            gameState.currentPlayer
        );
    }

    convertFromAlphaZeroAction(action) {
        // Convertir l'action d'AlphaZero en action du jeu
        return {
            type: action.type,
            row: action.row,
            col: action.col,
            from: action.from,
            to: action.to
        };
    }
}

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
    // Réinitialiser l'historique des mouvements
    moveHistory = [];
    
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

    // Réinitialiser les rewards
    rewards = {
        [PLAYER_WHITE]: 0,
        [PLAYER_BLACK]: 0
    };

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
    document.getElementById('toggle-mode').textContent = editorMode ? 'Play Mode' : 'Editor Mode';
    clearSelection();
    currentAction = null;
    selectedEditorPiece = null;
    updateAllDisplays();
}

// Function to handle board clicks
async function handleBoardClick(event) {
    if (editorMode) {
        handleEditorBoardClick(event);
        return;
    }

    const hex = event.target.closest('.hex');
    if (!hex) return;

    const row = parseInt(hex.dataset.row);
    const col = parseInt(hex.dataset.col);

    try {
        switch (currentAction) {
            case 'place-tile':
                if (canPlaceTile(row, col)) {
                    await placeTile(row, col, currentPlayer);
                    lastMove = { type: 'place-tile', row, col };
                    endTurn();
                }
                break;
            case 'place-disc':
                if (canPlacePiece(row, col)) {
                    await placePiece(row, col, 'disc', currentPlayer);
                    lastMove = { type: 'place-disc', row, col };
                    endTurn();
                }
                break;
            case 'place-ring':
                if (canPlacePiece(row, col)) {
                    await placePiece(row, col, 'ring', currentPlayer);
                    lastMove = { type: 'place-ring', row, col };
                    endTurn();
                }
                break;
            case 'move-piece':
                if (selectedPiece) {
                    const moves = getLegalMoves(selectedPiece.row, selectedPiece.col);
                    if (moves.some(m => m.row === row && m.col === col)) {
                        await movePiece(selectedPiece, row, col);
                        lastMove = { 
                            type: 'move', 
                            from: { row: selectedPiece.row, col: selectedPiece.col },
                            to: { row, col }
                        };
                        endTurn();
                    }
                    clearSelection();
                } else if (board[row][col].piece?.color === currentPlayer) {
                    selectPiece(row, col);
                }
                break;
        }
    } catch (error) {
        console.error('Error handling board click:', error);
    }
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
    if (board[row][col].tile || inventory[currentPlayer].tiles === 0) return false;
    
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
           !board[row][col].piece && 
           (inventory[currentPlayer].discs > 0 || (inventory[currentPlayer].rings > 0 && inventory[currentPlayer].capturedDiscs > 0));
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
    const captureMoves = []; // Nouveau tableau pour les mouvements de capture
    const piece = board[row][col].piece;

    if (!piece) {
        return [];
    }

    if (piece.type === 'disc') {
        // Mouvements simples adjacents
        if(!jumped) {
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

        // Mouvements de saut (qui peuvent capturer)
        const jumpDirections = [[-2, -1], [-2, 1], [0, 2], [2, 1], [2, -1], [0, -2]];
        for (const [dx, dy] of jumpDirections) {
            let offset = 0;
            if (row % 2 === 0) {
                offset = 1;
            }
            let middleRow = row + Math.floor(dx / 2);
            let middleCol = col + Math.floor(dy / 2);
            if(dx !== 0){
                middleCol = col + Math.floor(dy / 2) + offset;
            }
            let jumpRow = row + dx;
            let jumpCol = col + dy;

            // Check if the positions are valid before accessing them
            if (isValidPosition(middleRow, middleCol) && isValidPosition(jumpRow, jumpCol) && 
                board[middleRow][middleCol].piece &&
                board[middleRow][middleCol].piece.color !== piece.color && // Vérifier si c'est une pièce adverse
                !board[jumpRow][jumpCol].piece &&
                board[jumpRow][jumpCol].tile) {
                captureMoves.push({ 
                    row: jumpRow, 
                    col: jumpCol,
                    capture: true,
                    capturePos: { row: middleRow, col: middleCol }
                });
            }
        }
    } else if (piece.type === 'ring') {
        // Mouvements de l'anneau (qui peuvent capturer)
        const ringDirections = row % 2 === 0 ?
            [[-2, -1], [-2, 0], [-2, 1], [-1, 2], [0, 2], [1, 2], [2, 1], [2, 0], [2, -1], [1, -1], [0, -2], [-1, -1]] :
            [[-2, -1], [-2, 0], [-2, 1], [-1, 1], [0, 2], [1, 1], [2, 1], [2, 0], [2, -1], [1, -2], [0, -2], [-1, -2]];
        for (const [dx, dy] of ringDirections) {
            const newRow = row + dx;
            const newCol = col + dy;
            if (isValidPosition(newRow, newCol) && board[newRow][newCol].tile) {
                const targetPiece = board[newRow][newCol].piece;
                if (targetPiece && targetPiece.color === piece.color) {
                    
                }else{
                    captureMoves.push({ 
                        row: newRow, 
                        col: newCol,
                        capture: true 
                    });
                }
            }
        }
    }

    // Retourner les mouvements de capture en priorité s'ils existent
    return captureMoves.length > 0 ? captureMoves : moves;
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
    // Vérifier si le mouvement crée une répétition excessive
    if (!checkMoveRepetition(from.row, from.col, toRow, toCol)) {
        console.log("Ce mouvement créerait trop de répétitions !");
        return false;
    }

    const piece = board[from.row][from.col].piece;
    board[from.row][from.col].piece = null;

    // Enregistrer le mouvement dans l'historique
    moveHistory.push({
        from: { row: from.row, col: from.col },
        to: { row: toRow, col: toCol }
    });

    // Limiter la taille de l'historique pour éviter une utilisation excessive de mémoire
    if (moveHistory.length > 100) {
        moveHistory.shift();
    }

    // Check if the move is a jump for discs
    jumped = false;
    if (piece.type === 'disc' && (Math.abs(from.row - toRow) === 2 || Math.abs(from.col - toCol) === 2)) {
        jumped = true;
        let offset = 0;
        if (from.row % 2 === 0) {
            offset = 1;
        }
        let middleRow = from.row + Math.floor((toRow - from.row) / 2);
        let middleCol = from.col + Math.floor((toCol - from.col) / 2);
        if((toRow - from.row) !== 0){
            middleCol = from.col + Math.floor((toCol - from.col) / 2) + offset;
        }
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
    return true;
}

// Function to switch turns between players
async function switchTurn() {
    // Enregistrer l'état avant le changement de joueur
    if (aiEnabled && gameHistory) {
        const gameState = {
            board: board,
            inventory: inventory,
            currentPlayer: currentPlayer
        };
        // Enregistrer le dernier coup joué
        gameHistory.addMove(gameState, lastMove);
    }
    
    currentPlayer = currentPlayer === PLAYER_WHITE ? PLAYER_BLACK : PLAYER_WHITE;
    
    // Si c'est le tour de l'IA
    if (aiEnabled && currentPlayer === PLAYER_BLACK) {
        // Désactiver les contrôles pendant que l'IA réfléchit
        disableControls();
        
        try {
            const gameState = {
                board: board,
                inventory: inventory,
                currentPlayer: currentPlayer
            };
            
            const aiMove = await aiPlayer.getMove(gameState);
            await executeAIMove(aiMove);
        } catch (error) {
            console.error("AI move error:", error);
            enableControls();
        }
    }

    checkGameOver();
    updateAllDisplays();
}

function disableControls() {
    document.querySelectorAll('#game-controls button').forEach(button => {
        button.disabled = true;
    });
}

function enableControls() {
    document.querySelectorAll('#game-controls button').forEach(button => {
        button.disabled = false;
    });
    updateActionButtons();
}

async function executeAIMove(move) {
    try {
        lastMove = move;  // Enregistrer le coup
        switch (move.type) {
            case HexaequoAI.ACTION_TYPES.PLACE_TILE:
                if (!canPlaceTile(move.row, move.col)) {
                    throw new Error(`Invalid tile placement at ${move.row},${move.col}`);
                }
                setCurrentAction('place-tile');
                await placeTile(move.row, move.col, currentPlayer);
                break;
            case HexaequoAI.ACTION_TYPES.PLACE_DISC:
                if (!canPlacePiece(move.row, move.col)) {
                    throw new Error(`Invalid disc placement at ${move.row},${move.col}`);
                }
                setCurrentAction('place-disc');
                await placePiece(move.row, move.col, 'disc', currentPlayer);
                break;
            case HexaequoAI.ACTION_TYPES.PLACE_RING:
                if (!canPlacePiece(move.row, move.col)) {
                    throw new Error(`Invalid ring placement at ${move.row},${move.col}`);
                }
                setCurrentAction('place-ring');
                await placePiece(move.row, move.col, 'ring', currentPlayer);
                break;
            case HexaequoAI.ACTION_TYPES.MOVE:
                const legalMoves = getLegalMoves(move.from.row, move.from.col);
                const isLegalMove = legalMoves.some(m => 
                    m.row === move.to.row && m.col === move.to.col
                );
                if (!isLegalMove) {
                    throw new Error(`Invalid move from ${move.from.row},${move.from.col} to ${move.to.row},${move.to.col}`);
                }
                setCurrentAction('move-piece');
                selectedPiece = { row: move.from.row, col: move.from.col };
                await movePiece(move.from, move.to.row, move.to.col);
                break;
            default:
                throw new Error(`Unknown action type: ${move.type}`);
        }
        
        endTurn();
    } catch (error) {
        console.error('Error executing AI move:', error);
        // Fallback: make a random legal move
        await makeRandomLegalMove();
    } finally {
        enableControls();
    }
}

// Fonction de secours pour faire un coup aléatoire légal
async function makeRandomLegalMove() {
    const legalMoves = getAllLegalMoves();
    if (legalMoves.length > 0) {
        const randomMove = legalMoves[Math.floor(Math.random() * legalMoves.length)];
        await executeAIMove(randomMove);
    } else {
        console.error('No legal moves available');
        endTurn();
    }
}

// Obtenir tous les coups légaux possibles
function getAllLegalMoves() {
    const moves = [];
    
    // Check tile placements
    if (inventory[currentPlayer].tiles > 0) {
        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                if (canPlaceTile(row, col)) {
                    moves.push({
                        type: HexaequoAI.ACTION_TYPES.PLACE_TILE,
                        row: row,
                        col: col
                    });
                }
            }
        }
    }

    // Check piece placements and movements
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            // Check piece placements
            if (canPlacePiece(row, col)) {
                if (inventory[currentPlayer].discs > 0) {
                    moves.push({
                        type: HexaequoAI.ACTION_TYPES.PLACE_DISC,
                        row: row,
                        col: col
                    });
                }
                if (inventory[currentPlayer].rings > 0 && inventory[currentPlayer].capturedDiscs > 0) {
                    moves.push({
                        type: HexaequoAI.ACTION_TYPES.PLACE_RING,
                        row: row,
                        col: col
                    });
                }
            }

            // Check movements
            const piece = board[row][col].piece;
            if (piece && piece.color === currentPlayer) {
                const legalMoves = getLegalMoves(row, col);
                legalMoves.forEach(move => {
                    moves.push({
                        type: HexaequoAI.ACTION_TYPES.MOVE,
                        from: { row: row, col: col },
                        to: { row: move.row, col: move.col }
                    });
                });
            }
        }
    }

    return moves;
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
        
        // Enregistrer la fin de partie et entraîner le réseau
        if (aiEnabled && gameHistory) {
            gameHistory.endGame(winner);
            if (aiPlayer && aiPlayer.neuralNetwork) {
                aiPlayer.neuralNetwork.incrementHumanGames();
                
                gameHistory.trainNetwork(aiPlayer.neuralNetwork)
                    .then(() => console.log('Network trained on human game'))
                    .catch(err => console.error('Failed to train on human game:', err));
            }
        }
        
        // Toujours afficher le game over
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
    // Supprimer l'ancien game over s'il existe
    const existingGameOver = document.getElementById('game-over');
    if (existingGameOver) {
        existingGameOver.remove();
    }

    const gameOverElement = document.createElement('div');
    gameOverElement.id = 'game-over';

    // Formater les rewards avec 2 décimales
    const whiteRewards = rewards[PLAYER_WHITE].toFixed(2);
    const blackRewards = rewards[PLAYER_BLACK].toFixed(2);

    if (winner === 'training-completed') {
        gameOverElement.innerHTML = `
            <h2>Training Completed</h2>
            <p>AI has completed the training session</p>
            <div class="rewards-summary">
                <p>Final Rewards:</p>
                <p>White: ${whiteRewards}</p>
                <p>Black: ${blackRewards}</p>
            </div>
            <button id="reset-game">Start New Game</button>
        `;
    } else {
        gameOverElement.innerHTML = `
            <h2>Game Over</h2>
            <p>${winner === 'Ex Aequo' ? 'It\'s Ex Aequo!' : `${winner.charAt(0).toUpperCase() + winner.slice(1)} wins!`}</p>
            <div class="rewards-summary">
                <p>Final Rewards:</p>
                <p>White: ${whiteRewards}</p>
                <p>Black: ${blackRewards}</p>
            </div>
            <button id="reset-game">Start New Game</button>
        `;
    }

    document.body.appendChild(gameOverElement);
    document.getElementById('reset-game').addEventListener('click', resetGame);
    
    // Log des statistiques dans la console
    console.log('=== Game Statistics ===');
    console.log(`Winner: ${winner}`);
    console.log('Rewards:');
    console.log(`- White: ${whiteRewards} (Captures: ${inventory[PLAYER_WHITE].capturedDiscs} discs, ${inventory[PLAYER_WHITE].capturedRings} rings)`);
    console.log(`- Black: ${blackRewards} (Captures: ${inventory[PLAYER_BLACK].capturedDiscs} discs, ${inventory[PLAYER_BLACK].capturedRings} rings)`);
    console.log('==================');
}

// Function to reset the game
function resetGame() {
    // Supprimer l'écran de game over
    const gameOverElement = document.getElementById('game-over');
    if (gameOverElement) {
        gameOverElement.remove();
    }

    // Réinitialiser l'état du jeu
    setupInitialState();
    currentPlayer = PLAYER_BLACK;
    currentAction = null;
    jumped = false;
    selectedPiece = null;
    possibleMoves = [];
    moveHistory = [];

    // Réinitialiser l'historique de l'IA si nécessaire
    if (aiEnabled && gameHistory) {
        gameHistory.startNewGame();
    }

    // Réactiver les contrôles
    enableControls();
    
    // Mettre à jour tous les affichages
    updateAllDisplays();

    // Si l'IA est activée et que c'est son tour, déclencher son tour
    if (aiEnabled && currentPlayer === PLAYER_BLACK) {
        setTimeout(() => switchTurn(), 100);
    }
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
    document.getElementById('toggle-ai').addEventListener('click', toggleAI);
    
    const trainButton = document.getElementById('start-training');
    if (trainButton) {
        console.log('Setting up training button listener');
        trainButton.addEventListener('click', () => {
            console.log('Training button clicked');
            startTraining();
        });
    } else {
        console.error('Training button not found in DOM');
    }

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
        const loser = piece.color;
        
        if (piece.type === 'disc') {
            inventory[capturedBy].capturedDiscs++;
            rewards[capturedBy] += 0.1;  // Bonus pour le capteur
            rewards[loser] -= 0.1;       // Malus pour le perdant
        } else if (piece.type === 'ring') {
            inventory[capturedBy].capturedRings++;
            // Ajouter les rewards
            rewards[capturedBy] += 0.2;  // Bonus pour le capteur
            rewards[loser] -= 0.2;       // Malus pour le perdant
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
    currentPlayerElement.textContent = `Current player: ${currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1)}`;
}

// Add this function to update all displays
function updateAllDisplays() {
    updateBoardDisplay();
    updateInventoryDisplay();
    updateCurrentPlayerDisplay();
    updateActionButtons();
    updateAIStatus();
    if (aiEnabled) {
        displayNetworkStats();
    }
}

function updateAIStatus() {
    let aiStatusElement = document.getElementById('ai-status');
    
    // Si l'élément n'existe pas, le créer
    if (!aiStatusElement) {
        const playerInfo = document.getElementById('player-info');
        if (playerInfo) {
            aiStatusElement = document.createElement('div');
            aiStatusElement.id = 'ai-status';
            playerInfo.appendChild(aiStatusElement);
        } else {
            console.error('Player info element not found');
            return;
        }
    }

    try {
        if (aiEnabled) {
            const isAITurn = currentPlayer === PLAYER_BLACK;
            aiStatusElement.textContent = `AI ${isAITurn ? 'thinking...' : 'waiting'}`;
            aiStatusElement.style.color = isAITurn ? 'orange' : 'green';
        } else {
            aiStatusElement.textContent = 'AI disabled';
            aiStatusElement.style.color = 'gray';
        }
    } catch (error) {
        console.error('Error updating AI status:', error);
    }
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
/*function openRules() {
    document.getElementById('rules-modal').style.display = 'flex';
    document.getElementById('game-container').style.display = 'none'; // Hide the game

}

// Function to close the rules modal
function closeRules() {
    document.getElementById('rules-modal').style.display = 'none';
    document.getElementById('game-container').style.display = 'flex'; // Show the game
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
});*/

async function toggleAI() {
    try {
        const aiButton = document.getElementById('toggle-ai');
        if (!aiButton) {
            console.error('AI button not found');
            return;
        }

        if (aiEnabled) {
            // Désactiver l'IA
            aiEnabled = false;
            aiButton.textContent = 'Play vs AI';
            aiButton.classList.remove('active');
        } else {
            // Activer l'IA
            aiButton.disabled = true;
            aiButton.textContent = 'Initializing AI...';
            
            if (!aiPlayer) {
                console.log('Creating new AI player...');
                aiPlayer = new AIController();
                await aiPlayer.initialize();
                console.log('AI player initialized');
            }
            
            // Initialiser l'historique de la partie
            gameHistory = new HexaequoAI.GameHistory();
            gameHistory.startNewGame();
            
            aiEnabled = true;
            aiButton.textContent = 'Play vs Human';
            aiButton.classList.add('active');
        }
        
        aiButton.disabled = false;
        updateAllDisplays();
        
        // Si c'est le tour de l'IA après activation, déclencher son tour
        if (aiEnabled && currentPlayer === PLAYER_BLACK) {
            await switchTurn();
        }
    } catch (error) {
        console.error('Failed to toggle AI:', error);
        const aiButton = document.getElementById('toggle-ai');
        if (aiButton) {
            aiButton.textContent = 'AI Error';
            aiButton.disabled = true;
        }
        aiEnabled = false;
    }
}

async function startTraining() {
    console.log("=== DÉBUT DE L'ENTRAÎNEMENT ===");
    
    try {
        const trainButton = document.getElementById('start-training');
        if (!trainButton) {
            throw new Error("Bouton d'entraînement non trouvé");
        }
        
        console.log("Désactivation du bouton d'entraînement...");
        trainButton.disabled = true;
        trainButton.textContent = 'Training in progress...';

        // Supprimer tout game over existant au début de l'entraînement
        const existingGameOver = document.getElementById('game-over');
        if (existingGameOver) {
            existingGameOver.remove();
        }

        // Vérifier/Initialiser l'IA
        if (!aiPlayer) {
            console.log("Création d'une nouvelle instance d'IA...");
            aiPlayer = new AIController();
            console.log("Initialisation de l'IA...");
            await aiPlayer.initialize();
        }

        console.log("Configuration de l'entraînement:", trainingConfig);

        // Créer ou mettre à jour l'élément de statut
        let statusElement = document.getElementById('training-status');
        if (!statusElement) {
            statusElement = document.createElement('div');
            statusElement.id = 'training-status';
            document.getElementById('player-info').appendChild(statusElement);
        }

        // Boucle d'entraînement
        for (let i = 0; i < trainingConfig.iterations; i++) {
            console.log(`\nItération ${i + 1}/${trainingConfig.iterations}`);
            statusElement.textContent = `Iteration ${i + 1}/${trainingConfig.iterations}`;
            
            for (let g = 0; g < trainingConfig.gamesPerIteration; g++) {
                console.log(`\nPartie ${g + 1}/${trainingConfig.gamesPerIteration}`);
                statusElement.textContent = `Iteration ${i + 1}/${trainingConfig.iterations} - Game ${g + 1}/${trainingConfig.gamesPerIteration}`;
                
                const winner = await playSelfPlayGame(trainingConfig.maxTimePerMove);
                console.log(`Partie terminée. Gagnant: ${winner}`);
            }
        }

        console.log("\n=== ENTRAÎNEMENT TERMINÉ ===");
        statusElement.textContent = 'Training completed!';
        trainButton.textContent = 'Train AI';
        trainButton.disabled = false;

        // Utiliser displayGameOver pour afficher le message de fin d'entraînement
        displayGameOver('training-completed');

    } catch (error) {
        console.error("\n❌ ERREUR PENDANT L'ENTRAÎNEMENT:", error);
        const trainButton = document.getElementById('start-training');
        if (trainButton) {
            trainButton.textContent = 'Train AI (Error)';
            trainButton.disabled = false;
        }
        
        const statusElement = document.getElementById('training-status');
        if (statusElement) {
            statusElement.textContent = `Training failed: ${error.message}`;
        }
    }
}

async function playSelfPlayGame(maxTimePerMove) {
    console.log("🎮 Démarrage d'une nouvelle partie d'auto-apprentissage");
    
    // Réinitialiser le jeu
    setupInitialState();
    let moveCount = 0;
    
    // Créer une configuration MCTS spécifique pour l'entraînement
    const trainingMCTS = new HexaequoAI.MCTS(aiPlayer.neuralNetwork, {
        maxSimulations: 50,
        maxTimeMs: 500,
        minSimulations: 10
    });
    
    // Jouer jusqu'à la fin de la partie
    while (!isGameOver()) {
        moveCount++;
        console.log(`\nCoup ${moveCount} - Tour de ${currentPlayer}`);
        
        const gameState = {
            board: board,
            inventory: inventory,
            currentPlayer: currentPlayer
        };
        
        try {
            console.log("Réflexion de l'IA...");
            const alphaZeroState = aiPlayer.convertToAlphaZeroState(gameState);
            const action = await trainingMCTS.search(alphaZeroState);
            const move = aiPlayer.convertFromAlphaZeroAction(action);
            
            console.log("Coup choisi:", move);
            await executeAIMove(move);
            console.log("Coup exécuté");
            
        } catch (error) {
            console.error("❌ Erreur pendant le coup:", error);
            break;
        }
    }

    const winner = determineWinner();
    console.log(`\n🏆 Partie terminée en ${moveCount} coups. Gagnant: ${winner}`);
    
    if (aiPlayer && aiPlayer.neuralNetwork) {
        aiPlayer.neuralNetwork.incrementSelfPlayGames();
    }
    
    return winner;
}

window.addEventListener('load', () => {
    console.log('Page loaded, checking training button...');
    const trainButton = document.getElementById('start-training');
    if (trainButton) {
        console.log('Training button found');
        trainButton.addEventListener('click', () => {
            console.log('Training button clicked');
            startTraining();
        });
    } else {
        console.error('Training button not found after page load');
    }
});

function initializeAIControls() {
    console.log('Initializing AI controls...');
    const aiControls = document.getElementById('ai-controls');
    if (!aiControls) {
        console.error('AI controls container not found');
        return;
    }

    // Bouton de chargement
    const loadButton = document.getElementById('load-network');
    if (loadButton) {
        console.log('Load button found, attaching listener...');
        loadButton.onclick = () => {
            console.log('📂 Load Network button clicked');
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            
            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                
                try {
                    if (!aiPlayer) {
                        aiPlayer = new AIController();
                        await aiPlayer.initialize();
                    }
                    
                    loadButton.textContent = 'Loading...';
                    loadButton.disabled = true;
                    
                    await aiPlayer.neuralNetwork.loadNetwork(file);
                    console.log('Network statistics:');
                    console.log('- Self-play games:', aiPlayer.neuralNetwork.stats.selfPlayGames);
                    console.log('- Human games:', aiPlayer.neuralNetwork.stats.humanGames);
                    
                    displayNetworkStats();
                    
                    loadButton.textContent = 'Network Loaded!';
                    setTimeout(() => {
                        loadButton.textContent = 'Load Network';
                        loadButton.disabled = false;
                    }, 2000);
                    
                } catch (error) {
                    console.error('Error loading network:', error);
                    loadButton.textContent = 'Load Failed';
                    setTimeout(() => {
                        loadButton.textContent = 'Load Network';
                        loadButton.disabled = false;
                    }, 2000);
                }
            };
            input.click();
        };
    }

    // Bouton de sauvegarde
    const saveButton = document.getElementById('save-network');
    if (saveButton) {
        console.log('Save button found, attaching listener...');
        saveButton.onclick = async () => {
            console.log('Save button clicked');
            if (aiPlayer && aiPlayer.neuralNetwork) {
                console.log('Calling saveNetwork on neural network...');
                await aiPlayer.neuralNetwork.saveNetwork();
            } else {
                console.error('AI player or neural network not initialized');
            }
        };
    } else {
        console.error('Save button not found');
    }
}

// Ajouter cet appel au chargement de la page
window.addEventListener('load', () => {
    console.log('Page loaded, initializing AI controls...');
    initializeAIControls();
});

// Ajouter cette fonction après la fonction handleBoardClick
function selectPiece(row, col) {
    // Nettoyer la sélection précédente
    clearSelection();
    
    // Sélectionner la nouvelle pièce
    selectedPiece = { row, col };
    
    // Obtenir et afficher les mouvements possibles
    const possibleMoves = getLegalMoves(row, col);
    console.log('Highlighting possible moves:', possibleMoves);
    
    // Mettre en surbrillance les mouvements possibles
    possibleMoves.forEach(move => {
        board[move.row][move.col].highlight = true;
        const highlightElement = document.createElement('div');
        highlightElement.className = 'highlight-indicator';
        board[move.row][move.col].element.appendChild(highlightElement);
        console.log(`Highlighted move at: (${move.row}, ${move.col})`);
    });
}

// Ajouter cette fonction si elle n'existe pas déjà
function clearSelection() {
    selectedPiece = null;
    // Supprimer toutes les surbrillances
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            board[row][col].highlight = false;
            const highlightElement = board[row][col].element.querySelector('.highlight-indicator');
            if (highlightElement) {
                highlightElement.remove();
            }
        }
    }
}

// Ajouter une fonction pour afficher les statistiques
function displayNetworkStats() {
    if (!aiPlayer || !aiPlayer.neuralNetwork) return;

    const stats = aiPlayer.neuralNetwork.stats;
    let statsElement = document.getElementById('network-stats');
    
    // Si l'élément n'existe pas, le créer
    if (!statsElement) {
        statsElement = document.createElement('div');
        statsElement.id = 'network-stats';
        document.getElementById('ai-controls').appendChild(statsElement);
    }

    const lastUpdate = stats.lastUpdate ? 
        new Date(stats.lastUpdate).toLocaleDateString() : 'Never';

    statsElement.innerHTML = `
        <div>Network Stats:</div>
        <div>Self-play games: ${stats.selfPlayGames}</div>
        <div>Human games: ${stats.humanGames}</div>
        <div>Last update: ${lastUpdate}</div>
    `;
}

// Ajouter cette fonction pour vérifier les répétitions
function checkMoveRepetition(fromRow, fromCol, toRow, toCol) {
    // Créer une représentation du mouvement
    const currentMove = {
        from: { row: fromRow, col: fromCol },
        to: { row: toRow, col: toCol }
    };

    // Vérifier si ce mouvement est un retour
    if (moveHistory.length >= 2) {
        const lastMove = moveHistory[moveHistory.length - 1];
        if (lastMove.from.row === currentMove.to.row &&
            lastMove.from.col === currentMove.to.col &&
            lastMove.to.row === currentMove.from.row &&
            lastMove.to.col === currentMove.from.col) {
            
            // Compter le nombre de répétitions de cette séquence
            let repetitions = 0;
            for (let i = 0; i < moveHistory.length - 1; i += 2) {
                if (i + 1 >= moveHistory.length) break;
                
                const move1 = moveHistory[i];
                const move2 = moveHistory[i + 1];
                
                if (move1.from.row === currentMove.from.row &&
                    move1.from.col === currentMove.from.col &&
                    move1.to.row === currentMove.to.row &&
                    move1.to.col === currentMove.to.col &&
                    move2.from.row === lastMove.from.row &&
                    move2.from.col === lastMove.from.col &&
                    move2.to.row === lastMove.to.row &&
                    move2.to.col === lastMove.to.col) {
                    repetitions++;
                }
            }

            // Si on a déjà atteint le maximum de répétitions
            if (repetitions >= MAX_REPETITIONS) {
                return false;
            }
        }
    }

    return true;
}