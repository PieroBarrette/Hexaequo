// Game constants
const BOARD_SIZE = 10;
const PLAYER_WHITE = 'white';
const PLAYER_BLACK = 'black';

// Action type constants
const ACTION_TYPES = {
    PLACE_TILE: 'place-tile',
    PLACE_DISC: 'place-disc',
    PLACE_RING: 'place-ring',
    MOVE: 'move'
};

// Movement directions
const MOVE_DIRECTIONS = [
    [-1, 0],  // Nord
    [-1, 1],  // Nord-Est
    [0, 1],   // Est
    [1, 0],   // Sud
    [1, -1],  // Sud-Ouest
    [0, -1]   // Ouest
];

// 1. Définition de l'état du jeu
class HexaequoState {
    constructor(board, inventory, currentPlayer) {
        this.board = JSON.parse(JSON.stringify(board));
        this.inventory = JSON.parse(JSON.stringify(inventory));
        this.currentPlayer = currentPlayer;
    }

    // Définit l'espace d'actions possible (requis par AlphaZero)
    getActionSpace() {
        return {
            // Actions de placement de tuiles: 100 positions possibles (10x10)
            placeTile: BOARD_SIZE * BOARD_SIZE,
            // Actions de placement de pièces: 100 positions possibles pour chaque type
            placeDisc: BOARD_SIZE * BOARD_SIZE,
            placeRing: BOARD_SIZE * BOARD_SIZE,
            // Actions de mouvement: source (100) x destination (max 6 directions)
            move: BOARD_SIZE * BOARD_SIZE * 6
        };
    }

    // Convertit l'état en format tensor (requis par AlphaZero)
    toTensor() {
        // Crée un tableau 4D avec la forme [1, 10, 10, 4]
        const tensor = new Array(BOARD_SIZE).fill(0).map(() => 
            new Array(BOARD_SIZE).fill(0).map(() => 
                new Array(4).fill(0)
            )
        );

        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                const cell = this.board[row][col];
                // Canal 0: Tuiles blanches
                tensor[row][col][0] = cell.tile?.color === PLAYER_WHITE ? 1 : 0;
                // Canal 1: Tuiles noires
                tensor[row][col][1] = cell.tile?.color === PLAYER_BLACK ? 1 : 0;
                // Canal 2: Pièces blanches (1 pour disc, 2 pour ring)
                tensor[row][col][2] = cell.piece?.color === PLAYER_WHITE ? 
                    (cell.piece.type === 'disc' ? 1 : 2) : 0;
                // Canal 3: Pièces noires (1 pour disc, 2 pour ring)
                tensor[row][col][3] = cell.piece?.color === PLAYER_BLACK ? 
                    (cell.piece.type === 'disc' ? 1 : 2) : 0;
            }
        }

        return tensor;
    }

    // Vérifie si l'état est terminal (requis par AlphaZero)
    isTerminal() {
        return (
            this.inventory[PLAYER_WHITE].capturedDiscs === 6 ||
            this.inventory[PLAYER_BLACK].capturedDiscs === 6 ||
            this.inventory[PLAYER_WHITE].capturedRings === 3 ||
            this.inventory[PLAYER_BLACK].capturedRings === 3 ||
            !this.hasValidMoves(this.currentPlayer)
        );
    }

    // Retourne la récompense du point de vue du joueur actuel
    getReward() {
        if (!this.isTerminal()) return 0;
        
        // Victoire par capture de disques
        if (this.inventory[this.currentPlayer].capturedDiscs === 6) return 1;
        if (this.inventory[this.getOpponent()].capturedDiscs === 6) return -1;
        
        // Victoire par capture d'anneaux
        if (this.inventory[this.currentPlayer].capturedRings === 3) return 1;
        if (this.inventory[this.getOpponent()].capturedRings === 3) return -1;
        
        // Match nul (plus de mouvements possibles)
        return 0;
    }

    // Obtient le joueur opposé
    getOpponent() {
        return this.currentPlayer === PLAYER_WHITE ? PLAYER_BLACK : PLAYER_WHITE;
    }

    // Obtient toutes les actions légales possibles
    getLegalActions() {
        const actions = [];
        
        // 1. Placement de tuiles
        if (this.inventory[this.currentPlayer].tiles > 0) {
            for (let row = 0; row < BOARD_SIZE; row++) {
                for (let col = 0; col < BOARD_SIZE; col++) {
                    if (this.canPlaceTile(row, col)) {
                        actions.push({
                            type: ACTION_TYPES.PLACE_TILE,
                            row,
                            col
                        });
                    }
                }
            }
        }

        // 2. Placement de disques
        if (this.inventory[this.currentPlayer].discs > 0) {
            for (let row = 0; row < BOARD_SIZE; row++) {
                for (let col = 0; col < BOARD_SIZE; col++) {
                    if (this.canPlacePiece(row, col)) {
                        actions.push({
                            type: ACTION_TYPES.PLACE_DISC,
                            row,
                            col
                        });
                    }
                }
            }
        }

        // 3. Placement d'anneaux
        if (this.inventory[this.currentPlayer].rings > 0 && 
            this.inventory[this.currentPlayer].capturedDiscs > 0) {
            for (let row = 0; row < BOARD_SIZE; row++) {
                for (let col = 0; col < BOARD_SIZE; col++) {
                    if (this.canPlacePiece(row, col)) {
                        actions.push({
                            type: ACTION_TYPES.PLACE_RING,
                            row,
                            col
                        });
                    }
                }
            }
        }

        // 4. Mouvements de pièces
        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                const piece = this.board[row][col].piece;
                if (piece && piece.color === this.currentPlayer) {
                    const moves = this.getPossibleMoves(row, col);
                    for (const move of moves) {
                        actions.push({
                            type: ACTION_TYPES.MOVE,
                            from: { row, col },
                            to: { row: move.row, col: move.col }
                        });
                    }
                }
            }
        }

        return actions;
    }

    // Applique une action et retourne le nouvel état
    applyAction(action) {
        const newState = new HexaequoState(this.board, this.inventory, this.currentPlayer);
        
        switch(action.type) {
            case ACTION_TYPES.PLACE_TILE:
                newState.placeTile(action.row, action.col);
                break;
            case ACTION_TYPES.PLACE_DISC:
                newState.placePiece(action.row, action.col, 'disc');
                break;
            case ACTION_TYPES.PLACE_RING:
                newState.placePiece(action.row, action.col, 'ring');
                break;
            case ACTION_TYPES.MOVE:
                newState.movePiece(action.from, action.to);
                break;
        }

        newState.currentPlayer = this.getOpponent();
        return newState;
    }

    canPlaceTile(row, col) {
        // Vérifie si la case est vide
        if (this.board[row][col].tile || this.board[row][col].piece) {
            return false;
        }

        // Vérifie si le joueur a des tuiles disponibles
        if (this.inventory[this.currentPlayer].tiles <= 0) {
            return false;
        }

        // Vérifie si la case est adjacente à une tuile existante
        // (sauf pour les premiers coups)
        const totalTiles = BOARD_SIZE * BOARD_SIZE - 
            (this.inventory[PLAYER_WHITE].tiles + this.inventory[PLAYER_BLACK].tiles);
        
        if (totalTiles > 4) { // Après les 4 premières tuiles
            return this.hasAdjacentTile(row, col);
        }

        return true;
    }

    canPlacePiece(row, col) {
        // Vérifie si la case a une tuile de la couleur du joueur
        const cell = this.board[row][col];
        if (!cell.tile || cell.tile.color !== this.currentPlayer || cell.piece) {
            return false;
        }
        return true;
    }

    hasAdjacentTile(row, col) {
        for (const [dr, dc] of MOVE_DIRECTIONS) {
            const newRow = row + dr;
            const newCol = col + dc;
            if (this.isValidPosition(newRow, newCol) && 
                this.board[newRow][newCol].tile) {
                return true;
            }
        }
        return false;
    }

    isValidPosition(row, col) {
        return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
    }

    getPossibleMoves(row, col) {
        const moves = [];
        const piece = this.board[row][col].piece;
        
        if (!piece || piece.color !== this.currentPlayer) {
            return moves;
        }

        // Mouvements normaux (adjacents)
        for (const [dr, dc] of MOVE_DIRECTIONS) {
            const newRow = row + dr;
            const newCol = col + dc;
            
            if (this.isValidPosition(newRow, newCol) && 
                this.board[newRow][newCol].tile &&
                !this.board[newRow][newCol].piece) {
                moves.push({row: newRow, col: newCol});
            }
        }

        // Captures pour les anneaux
        if (piece.type === 'ring') {
            for (const [dr, dc] of MOVE_DIRECTIONS) {
                let r = row + dr;
                let c = col + dc;
                
                while (this.isValidPosition(r, c)) {
                    if (!this.board[r][c].tile) break;
                    
                    const targetPiece = this.board[r][c].piece;
                    if (targetPiece) {
                        if (targetPiece.color === this.currentPlayer) break;
                        
                        // Cherche une case d'atterrissage après la pièce
                        const landingRow = r + dr;
                        const landingCol = c + dc;
                        if (this.isValidPosition(landingRow, landingCol) && 
                            this.board[landingRow][landingCol].tile && 
                            !this.board[landingRow][landingCol].piece) {
                            moves.push({
                                row: landingRow, 
                                col: landingCol, 
                                capture: {row: r, col: c}
                            });
                        }
                        break;
                    }
                    r += dr;
                    c += dc;
                }
            }
        }

        return moves;
    }

    placeTile(row, col) {
        if (this.canPlaceTile(row, col)) {
            this.board[row][col].tile = { color: this.currentPlayer };
            this.inventory[this.currentPlayer].tiles--;
            return true;
        }
        return false;
    }

    placePiece(row, col, type) {
        if (this.canPlacePiece(row, col)) {
            if (type === 'disc' && this.inventory[this.currentPlayer].discs > 0) {
                this.board[row][col].piece = { type: 'disc', color: this.currentPlayer };
                this.inventory[this.currentPlayer].discs--;
                return true;
            }
            if (type === 'ring' && 
                this.inventory[this.currentPlayer].rings > 0 &&
                this.inventory[this.currentPlayer].capturedDiscs > 0) {
                this.board[row][col].piece = { type: 'ring', color: this.currentPlayer };
                this.inventory[this.currentPlayer].rings--;
                this.inventory[this.currentPlayer].capturedDiscs--;
                return true;
            }
        }
        return false;
    }

    movePiece(from, to) {
        const piece = this.board[from.row][from.col].piece;
        if (!piece || piece.color !== this.currentPlayer) return false;

        const moves = this.getPossibleMoves(from.row, from.col);
        const targetMove = moves.find(m => m.row === to.row && m.col === to.col);
        
        if (targetMove) {
            // Capture si c'est un mouvement de capture
            if (targetMove.capture) {
                const capturedPiece = this.board[targetMove.capture.row][targetMove.capture.col].piece;
                if (capturedPiece.type === 'disc') {
                    this.inventory[this.currentPlayer].capturedDiscs++;
                } else {
                    this.inventory[this.currentPlayer].capturedRings++;
                }
                this.board[targetMove.capture.row][targetMove.capture.col].piece = null;
            }

            // Déplacer la pièce
            this.board[to.row][to.col].piece = piece;
            this.board[from.row][from.col].piece = null;
            return true;
        }
        return false;
    }

    hasValidMoves(player) {
        // Vérifie s'il reste des actions possibles
        const state = new HexaequoState(this.board, this.inventory, player);
        return state.getLegalActions().length > 0;
    }

    getWinner() {
        if (!this.isTerminal()) return null;
        
        // Victoire par capture de disques
        if (this.inventory[PLAYER_WHITE].capturedDiscs === 6) return PLAYER_WHITE;
        if (this.inventory[PLAYER_BLACK].capturedDiscs === 6) return PLAYER_BLACK;
        
        // Victoire par capture d'anneaux
        if (this.inventory[PLAYER_WHITE].capturedRings === 3) return PLAYER_WHITE;
        if (this.inventory[PLAYER_BLACK].capturedRings === 3) return PLAYER_BLACK;
        
        // Match nul (plus de mouvements possibles)
        return null;
    }

    clone() {
        return new HexaequoState(
            JSON.parse(JSON.stringify(this.board)),
            JSON.parse(JSON.stringify(this.inventory)),
            this.currentPlayer
        );
    }
}

class NeuralNetwork {
    constructor() {
        this.initializeNetwork();
    }

    async initializeNetwork() {
        // Créer le modèle du réseau de politique (policy network)
        this.policyNetwork = tf.sequential({
            layers: [
                tf.layers.conv2d({
                    inputShape: [BOARD_SIZE, BOARD_SIZE, 3],
                    filters: 64,
                    kernelSize: 3,
                    padding: 'same',
                    activation: 'relu'
                }),
                tf.layers.conv2d({
                    filters: 64,
                    kernelSize: 3,
                    padding: 'same',
                    activation: 'relu'
                }),
                tf.layers.flatten(),
                tf.layers.dense({
                    units: 900,  // Nombre total d'actions possibles
                    activation: 'softmax'
                })
            ]
        });

        // Créer le modèle du réseau de valeur (value network)
        this.valueNetwork = tf.sequential({
            layers: [
                tf.layers.conv2d({
                    inputShape: [BOARD_SIZE, BOARD_SIZE, 3],
                    filters: 64,
                    kernelSize: 3,
                    padding: 'same',
                    activation: 'relu'
                }),
                tf.layers.conv2d({
                    filters: 64,
                    kernelSize: 3,
                    padding: 'same',
                    activation: 'relu'
                }),
                tf.layers.flatten(),
                tf.layers.dense({
                    units: 256,
                    activation: 'relu'
                }),
                tf.layers.dense({
                    units: 1,
                    activation: 'tanh'
                })
            ]
        });

        // Compiler les modèles
        this.policyNetwork.compile({
            optimizer: tf.train.adam(0.001),
            loss: 'categoricalCrossentropy'
        });

        this.valueNetwork.compile({
            optimizer: tf.train.adam(0.001),
            loss: 'meanSquaredError'
        });
    }

    async predict(state) {
        const input = this.preprocessState(state);
        
        const policyPrediction = await this.policyNetwork.predict(input);
        const valuePrediction = await this.valueNetwork.predict(input);
        
        const policy = Array.from(await policyPrediction.data());
        const value = (await valuePrediction.data())[0];
        
        // Libérer la mémoire
        tf.dispose([policyPrediction, valuePrediction]);
        
        return {
            policy: policy,
            value: value
        };
    }

    preprocessState(state) {
        // Créer un tenseur 4D [1, BOARD_SIZE, BOARD_SIZE, 3]
        const tensor = tf.tidy(() => {
            const boardTensor = tf.zeros([BOARD_SIZE, BOARD_SIZE, 3]);
            
            // Parcourir le plateau
            for (let row = 0; row < BOARD_SIZE; row++) {
                for (let col = 0; col < BOARD_SIZE; col++) {
                    const cell = state.board[row][col];
                    
                    // Canal 0: tuiles (1 pour blanc, -1 pour noir)
                    if (cell.tile) {
                        boardTensor.bufferSync().set(
                            row, col, 0,
                            cell.tile.color === PLAYER_WHITE ? 1 : -1
                        );
                    }
                    
                    // Canal 1: pièces (1 pour disque blanc, -1 pour disque noir)
                    if (cell.piece && cell.piece.type === 'disc') {
                        boardTensor.bufferSync().set(
                            row, col, 1,
                            cell.piece.color === PLAYER_WHITE ? 1 : -1
                        );
                    }
                    
                    // Canal 2: anneaux (1 pour anneau blanc, -1 pour anneau noir)
                    if (cell.piece && cell.piece.type === 'ring') {
                        boardTensor.bufferSync().set(
                            row, col, 2,
                            cell.piece.color === PLAYER_WHITE ? 1 : -1
                        );
                    }
                }
            }
            
            return boardTensor.expandDims(0);
        });
        
        return tensor;
    }

    async trainStep(states, actionProbs, values) {
        const batchSize = states.length;
        const inputTensor = tf.tidy(() => {
            // Convertir les états en tenseur
            const stateTensors = states.map(state => this.preprocessState(state));
            return tf.concat(stateTensors, 0);
        });

        const targetPolicyTensor = tf.tensor2d(actionProbs);
        const targetValueTensor = tf.tensor2d(values, [batchSize, 1]);

        // Entraîner le réseau de politique
        const policyHistory = await this.policyNetwork.fit(inputTensor, targetPolicyTensor, {
            epochs: 1,
            batchSize: 32,
            verbose: 0
        });

        // Entraîner le réseau de valeur
        const valueHistory = await this.valueNetwork.fit(inputTensor, targetValueTensor, {
            epochs: 1,
            batchSize: 32,
            verbose: 0
        });

        // Libérer la mémoire
        tf.dispose([inputTensor, targetPolicyTensor, targetValueTensor]);

        return {
            policyLoss: policyHistory.history.loss[0],
            valueLoss: valueHistory.history.loss[0]
        };
    }
}

class MCTSNode {
    constructor(state, parent = null, priorProbability = 1.0) {
        this.state = state;
        this.parent = parent;
        this.children = new Map(); // action -> MCTSNode
        this.visits = 0;
        this.value = 0;
        this.priorProbability = priorProbability;
        this.actionProbabilities = null;
    }

    isLeaf() {
        return this.children.size === 0;
    }

    getValue() {
        return this.visits === 0 ? 0 : this.value / this.visits;
    }

    // Calcul du score UCB (Upper Confidence Bound)
    getUCB(totalVisits, explorationConstant = 1.0) {
        const exploitation = this.getValue();
        const exploration = explorationConstant * this.priorProbability * 
            Math.sqrt(totalVisits) / (1 + this.visits);
        return exploitation + exploration;
    }
}

class MCTS {
    constructor(neuralNetwork, numSimulations = 1600) {
        this.neuralNetwork = neuralNetwork;
        this.numSimulations = numSimulations;
        this.explorationConstant = 2.0;  // Increased from 1.0 to encourage exploration
        this.dirichletNoise = 0.3;  // Added Dirichlet noise for more diverse play
        this.dirichletAlpha = 0.5;  // Concentration parameter for Dirichlet distribution
    }

    async search(state) {
        const root = new MCTSNode(state);
        
        // Effectuer les simulations
        for (let i = 0; i < this.numSimulations; i++) {
            let node = root;
            
            // 1. Sélection
            while (!node.isLeaf() && !node.state.isTerminal()) {
                node = this.select(node);
            }

            // 2. Expansion et évaluation
            if (!node.state.isTerminal()) {
                await this.expand(node);
            }

            // 3. Simulation/Évaluation (utilise le réseau neuronal au lieu de playouts aléatoires)
            const value = await this.evaluate(node);

            // 4. Rétropropagation
            this.backpropagate(node, value);
        }

        // Retourner l'action avec le plus de visites
        return this.getBestAction(root);
    }

    select(node) {
        let bestScore = -Infinity;
        let bestChild = null;

        for (const [action, child] of node.children) {
            const ucbScore = this.getUCB(child, node.visits);
            if (ucbScore > bestScore) {
                bestScore = ucbScore;
                bestChild = child;
            }
        }

        return bestChild;
    }

    async expand(node) {
        // Obtenir les probabilités d'action du réseau neuronal
        const prediction = await this.neuralNetwork.predict(node.state);
        node.actionProbabilities = prediction.policy;

        // Créer les nœuds enfants pour chaque action légale
        const legalActions = node.state.getLegalActions();
        for (const action of legalActions) {
            const nextState = node.state.applyAction(action);
            const priorProb = node.actionProbabilities[this.actionToIndex(action)];
            node.children.set(action, new MCTSNode(nextState, node, priorProb));
        }
    }

    async evaluate(node) {
        if (node.state.isTerminal()) {
            return node.state.getReward();
        }
        const prediction = await this.neuralNetwork.predict(node.state);
        return prediction.value;
    }

    backpropagate(node, value) {
        while (node !== null) {
            node.visits += 1;
            node.value += value;
            value = -value; // Inverser la valeur pour l'adversaire
            node = node.parent;
        }
    }

    getBestAction(node) {
        let bestVisits = -1;
        let bestAction = null;

        for (const [action, child] of node.children) {
            if (child.visits > bestVisits) {
                bestVisits = child.visits;
                bestAction = action;
            }
        }

        return bestAction;
    }

    actionToIndex(action) {
        const base = BOARD_SIZE * BOARD_SIZE;
        
        switch(action.type) {
            case ACTION_TYPES.PLACE_TILE:
                return action.row * BOARD_SIZE + action.col;
            
            case ACTION_TYPES.PLACE_DISC:
                return base + (action.row * BOARD_SIZE + action.col);
            
            case ACTION_TYPES.PLACE_RING:
                return 2 * base + (action.row * BOARD_SIZE + action.col);
            
            case ACTION_TYPES.MOVE:
                const dirIndex = MOVE_DIRECTIONS.findIndex(([dr, dc]) => 
                    dr === (action.to.row - action.from.row) && 
                    dc === (action.to.col - action.from.col)
                );
                return 3 * base + (action.from.row * BOARD_SIZE + action.from.col) * 6 + dirIndex;
            
            default:
                throw new Error(`Action type inconnu: ${action.type}`);
        }
    }

    indexToAction(index) {
        const base = BOARD_SIZE * BOARD_SIZE;
        
        if (index < base) {
            // Place tile
            return {
                type: ACTION_TYPES.PLACE_TILE,
                row: Math.floor(index / BOARD_SIZE),
                col: index % BOARD_SIZE
            };
        }
        
        if (index < 2 * base) {
            // Place disc
            index -= base;
            return {
                type: ACTION_TYPES.PLACE_DISC,
                row: Math.floor(index / BOARD_SIZE),
                col: index % BOARD_SIZE
            };
        }
        
        if (index < 3 * base) {
            // Place ring
            index -= 2 * base;
            return {
                type: ACTION_TYPES.PLACE_RING,
                row: Math.floor(index / BOARD_SIZE),
                col: index % BOARD_SIZE
            };
        }
        
        // Move piece
        index -= 3 * base;
        const fromPos = Math.floor(index / 6);
        const dirIndex = index % 6;
        const fromRow = Math.floor(fromPos / BOARD_SIZE);
        const fromCol = fromPos % BOARD_SIZE;
        const [dr, dc] = MOVE_DIRECTIONS[dirIndex];
        
        return {
            type: ACTION_TYPES.MOVE,
            from: { row: fromRow, col: fromCol },
            to: { row: fromRow + dr, col: fromCol + dc }
        };
    }

    getUCB(node, totalVisits) {
        const exploitation = node.getValue();
        const exploration = this.explorationConstant * node.priorProbability * 
            Math.sqrt(totalVisits) / (1 + node.visits);
        
        // Add a bonus for moves that lead to captures
        const captureBonus = this.calculateCaptureBonus(node.state);
        
        return exploitation + exploration + captureBonus;
    }

    calculateCaptureBonus(state) {
        const bonus = 0.1;  // Base bonus for potential captures
        const legalActions = state.getLegalActions();
        
        // Check if any legal action leads to a capture
        for (const action of legalActions) {
            const nextState = state.applyAction(action);
            if (this.actionLeadsToCapture(state, nextState)) {
                return bonus;
            }
        }
        return 0;
    }

    actionLeadsToCapture(oldState, newState) {
        const oldInventory = oldState.inventory;
        const newInventory = newState.inventory;
        
        // Check if the action led to any captures
        return (newInventory[PLAYER_WHITE].capturedDiscs > oldInventory[PLAYER_WHITE].capturedDiscs) ||
               (newInventory[PLAYER_BLACK].capturedDiscs > oldInventory[PLAYER_BLACK].capturedDiscs) ||
               (newInventory[PLAYER_WHITE].capturedRings > oldInventory[PLAYER_WHITE].capturedRings) ||
               (newInventory[PLAYER_BLACK].capturedRings > oldInventory[PLAYER_BLACK].capturedRings);
    }
}

// Fonction de test du réseau neuronal
async function testNeuralNetwork() {
    console.log("Démarrage du test du réseau neuronal...");

    // Initialize test board
    const testBoard = Array(BOARD_SIZE).fill(null).map(() => 
        Array(BOARD_SIZE).fill(null).map(() => 
            ({element: {}, tile: null, piece: null})
        )
    );

    // Initialize test inventory
    const testInventory = {
        [PLAYER_WHITE]: { tiles: 9, discs: 6, rings: 3, capturedDiscs: 0, capturedRings: 0 },
        [PLAYER_BLACK]: { tiles: 9, discs: 6, rings: 3, capturedDiscs: 0, capturedRings: 0 }
    };

    const testState = new HexaequoState(testBoard, testInventory, PLAYER_WHITE);
    console.log("État de test créé");

    const nn = new NeuralNetwork();
    console.log("Réseau neuronal créé");

    try {
        console.log("Tentative de prédiction...");
        const prediction = await nn.predict(testState);
        
        console.log("Prédiction réussie !");
        console.log("Politique (5 premières probabilités):", 
            prediction.policy.slice(0, 5).map(p => p.toFixed(4)));
        console.log("Valeur de l'état:", prediction.value.toFixed(4));
        console.log("Taille de la politique:", prediction.policy.length);
        console.log("Valeur dans [-1, 1]:", 
            prediction.value >= -1 && prediction.value <= 1);

    } catch (error) {
        console.error("Erreur pendant le test:", error);
    }
}

// Fonction de test pour la conversion action <-> index
function testActionConversion() {
    console.log("Test de conversion action <-> index");
    
    const testCases = [
        {
            action: {
                type: ACTION_TYPES.PLACE_TILE,
                row: 5,
                col: 3
            },
            expectedIndex: 53  // 5 * 10 + 3
        },
        {
            action: {
                type: ACTION_TYPES.PLACE_DISC,
                row: 2,
                col: 7
            },
            expectedIndex: 127  // 100 + (2 * 10 + 7)
        },
        {
            action: {
                type: ACTION_TYPES.PLACE_RING,
                row: 8,
                col: 1
            },
            expectedIndex: 281  // 200 + (8 * 10 + 1)
        },
        {
            action: {
                type: ACTION_TYPES.MOVE,
                from: { row: 4, col: 5 },
                to: { row: 3, col: 5 }  // Mouvement vers le Nord
            },
            expectedIndex: 300 + (4 * 10 + 5) * 6 + 0
        }
    ];

    let allTestsPassed = true;

    const mcts = new MCTS(null);  // On n'a pas besoin du réseau neuronal pour ces tests

    testCases.forEach((testCase, i) => {
        try {
            const index = mcts.actionToIndex(testCase.action);
            const reconstructedAction = mcts.indexToAction(index);
            
            console.log(`Test ${i + 1}:`);
            console.log('Action originale:', testCase.action);
            console.log('Index calculé:', index);
            console.log('Index attendu:', testCase.expectedIndex);
            console.log('Action reconstruite:', reconstructedAction);
            
            const conversionCorrect = index === testCase.expectedIndex;
            const reconstructionCorrect = JSON.stringify(reconstructedAction) === JSON.stringify(testCase.action);
            
            if (conversionCorrect && reconstructionCorrect) {
                console.log('✅ Test réussi');
            } else {
                console.log('❌ Test échoué');
                allTestsPassed = false;
            }
            console.log('---');
            
        } catch (error) {
            console.error(`❌ Erreur dans le test ${i + 1}:`, error);
            allTestsPassed = false;
        }
    });

    console.log(allTestsPassed ? 
        '✅ Tous les tests ont réussi !' : 
        '❌ Certains tests ont échoué.'
    );
}

// Ajouter après les tests existants
function testHexaequoState() {
    console.log("\n=== Tests de HexaequoState ===");
    
    // Créer un état de test avec quelques pièces
    const testBoard = Array(BOARD_SIZE).fill(null).map(() => 
        Array(BOARD_SIZE).fill(null).map(() => 
            ({element: {}, tile: null, piece: null})
        )
    );

    // Ajouter quelques pièces de test
    testBoard[4][5].tile = {color: PLAYER_BLACK};  // Noir en premier
    testBoard[4][5].piece = {type: 'disc', color: PLAYER_BLACK};
    testBoard[5][5].tile = {color: PLAYER_WHITE};  // Blanc en second
    testBoard[5][5].piece = {type: 'disc', color: PLAYER_WHITE};

    const testInventory = {
        [PLAYER_BLACK]: { tiles: 8, discs: 5, rings: 3, capturedDiscs: 0, capturedRings: 0 },
        [PLAYER_WHITE]: { tiles: 8, discs: 5, rings: 3, capturedDiscs: 1, capturedRings: 0 }
    };

    // Créer l'état avec le joueur noir qui commence
    const state = new HexaequoState(testBoard, testInventory, PLAYER_BLACK);

    // Test 1: getLegalActions
    console.log("Test getLegalActions:");
    const actions = state.getLegalActions();
    console.log(`Nombre d'actions légales: ${actions.length}`);
    console.log("Types d'actions trouvés:", 
        [...new Set(actions.map(a => a.type))]);

    // Test 2: Placement de tuile
    console.log("\nTest placement de tuile:");
    const tilePlacement = actions.find(a => a.type === ACTION_TYPES.PLACE_TILE);
    if (tilePlacement) {
        const newState = state.applyAction(tilePlacement);
        console.log("Position de la tuile:", tilePlacement);
        console.log("Tuiles restantes:", newState.inventory[PLAYER_WHITE].tiles);
        console.log("Nouveau joueur:", newState.currentPlayer);
    }

    // Test 3: Mouvement de pièce
    console.log("\nTest mouvement de pièce:");
    const moves = actions.filter(a => a.type === ACTION_TYPES.MOVE);
    console.log(`Nombre de mouvements possibles: ${moves.length}`);
    if (moves.length > 0) {
        console.log("Premier mouvement possible:", moves[0]);
        const newState = state.applyAction(moves[0]);
        console.log("Position d'origine vide:", 
            !newState.board[moves[0].from.row][moves[0].from.col].piece);
        console.log("Nouvelle position occupée:", 
            !!newState.board[moves[0].to.row][moves[0].to.col].piece);
    }

    // Test 4: Placement d'anneau (nécessite des disques capturés)
    console.log("\nTest placement d'anneau:");
    const ringPlacements = actions.filter(a => a.type === ACTION_TYPES.PLACE_RING);
    console.log(`Nombre de placements d'anneaux possibles: ${ringPlacements.length}`);
    if (ringPlacements.length > 0) {
        const newState = state.applyAction(ringPlacements[0]);
        console.log("Anneaux restants:", newState.inventory[PLAYER_WHITE].rings);
        console.log("Disques capturés restants:", 
            newState.inventory[PLAYER_WHITE].capturedDiscs);
    }

    // Test 5: Test de capture
    console.log("\nTest de capture:");
    // Créer une situation de capture
    const captureBoard = JSON.parse(JSON.stringify(testBoard));
    captureBoard[3][5].piece = {type: 'ring', color: PLAYER_WHITE};
    captureBoard[3][5].tile = {color: PLAYER_WHITE};
    
    const captureState = new HexaequoState(captureBoard, testInventory, PLAYER_WHITE);
    const captureMoves = captureState.getLegalActions()
        .filter(a => a.type === ACTION_TYPES.MOVE);
    
    console.log(`Mouvements de capture possibles: ${
        captureMoves.filter(m => 
            Math.abs(m.to.row - m.from.row) > 1 || 
            Math.abs(m.to.col - m.from.col) > 1
        ).length
    }`);
}

// Modifier la fonction onload pour inclure les nouveaux tests
const originalOnload = window.onload;
window.onload = async function() {
    // Call the original onload function if it exists
    if (originalOnload) {
        originalOnload.call(window);
    }

    // Run the AI tests after a delay
    setTimeout(async () => {
        console.log("=== Tests du réseau neuronal ===");
        await testNeuralNetwork();
        
        console.log("\n=== Tests de conversion d'actions ===");
        await testActionConversion();
        
        console.log("\n=== Tests de l'état du jeu ===");
        await testHexaequoState();
        
        console.log("\n=== Tests d'entraînement ===");
        await testTraining();
    }, 1000);
};

// Intégration avec le jeu
function initializeAI() {
    const neuralNetwork = new NeuralNetwork();
    const mcts = new MCTS(neuralNetwork);
    return { neuralNetwork, mcts };
}

async function makeAIMove() {
    if (!ai) {
        ai = initializeAI();
    }

    const currentState = new HexaequoState(board, inventory, currentPlayer);
    const action = await ai.mcts.search(currentState);
    
    // Appliquer l'action au jeu
    switch(action.type) {
        case ACTION_TYPES.PLACE_TILE:
            placeTile(action.row, action.col, currentPlayer);
            break;
            
        case ACTION_TYPES.PLACE_DISC:
            placePiece(action.row, action.col, 'disc', currentPlayer);
            break;
            
        case ACTION_TYPES.PLACE_RING:
            placePiece(action.row, action.col, 'ring', currentPlayer);
            break;
            
        case ACTION_TYPES.MOVE:
            movePiece(action.from, action.to.row, action.to.col);
            break;
    }

    endTurn();
}

// Variable globale pour l'IA
let ai = null;

// Modifier la fonction switchTurn existante
function switchTurn() {
    currentPlayer = currentPlayer === PLAYER_WHITE ? PLAYER_BLACK : PLAYER_WHITE;
    updateCurrentPlayerDisplay();
    
    if (!isGameOver()) {
        if (currentPlayer === PLAYER_BLACK) {
            // Ajouter un délai pour une meilleure expérience utilisateur
            setTimeout(makeAIMove, 500);
        }
    }
} 

class TrainingStorage {
    constructor(selfPlay) {
        this.selfPlay = selfPlay;
    }

    async exportToFile(isAutoSave = false) {
        try {
            // Ne sauvegarder que les poids du réseau et quelques métriques essentielles
            const data = {
                // Métriques de base pour le suivi
                metrics: {
                    totalGames: this.selfPlay.metrics.totalGames,
                    winRates: this.selfPlay.metrics.winRates
                },
                // Les poids du réseau (c'est le plus important)
                networkWeights: await this.compressNetworkWeights()
            };

            if (isAutoSave) {
                try {
                    const timestamp = new Date().toISOString();
                    localStorage.setItem('hexaequo-autosave', JSON.stringify({
                        timestamp,
                        data
                    }));
                    
                    const saveStatus = document.getElementById('auto-save-status');
                    if (saveStatus) {
                        saveStatus.textContent = `Dernière sauvegarde automatique: ${new Date().toLocaleTimeString()}`;
                    }
                    
                    console.log(`Sauvegarde automatique dans le localStorage: ${timestamp}`);
                    return true;
                } catch (e) {
                    if (e.name === 'QuotaExceededError') {
                        return this.saveToFile(data, true);
                    }
                    throw e;
                }
            } else {
                return this.saveToFile(data, false);
            }
        } catch (error) {
            console.error("Erreur lors de la sauvegarde:", error);
            throw new Error("Échec de la sauvegarde: " + error.message);
        }
    }

    async saveToFile(data, isAutoSave) {
        const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
        const filename = isAutoSave ? 
            `hexaequo-autosave-${new Date().toISOString().replace(/[:.]/g, '-')}.json` :
            `hexaequo-training-${new Date().toISOString()}.json`;

        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
        return true;
    }

    async importFromFile(file) {
        try {
            const text = await file.text();
            const data = JSON.parse(text);

            // Restaurer l'historique des parties
            this.selfPlay.gameHistory = data.gameHistory || [];

            // Restaurer les métriques
            if (data.metrics) {
                Object.assign(this.selfPlay.metrics, data.metrics);
            }

            // Restaurer les poids du réseau
            if (data.networkWeights) {
                await this.importNetworkWeights(data.networkWeights);
            }

            console.log("Progression chargée avec succès");
            return true;
        } catch (error) {
            console.error("Erreur lors du chargement:", error);
            throw new Error("Échec du chargement: " + error.message);
        }
    }

    async compressNetworkWeights() {
        // Exporter les poids du réseau de politique
        const policyWeights = await Promise.all(
            this.selfPlay.neuralNetwork.policyNetwork.getWeights().map(async w => {
                const array = await w.array();
                // Arrondir les valeurs à 4 décimales pour réduire la taille
                return this.compressArray(array);
            })
        );

        // Exporter les poids du réseau de valeur
        const valueWeights = await Promise.all(
            this.selfPlay.neuralNetwork.valueNetwork.getWeights().map(async w => {
                const array = await w.array();
                return this.compressArray(array);
            })
        );

        return {
            policyWeights,
            valueWeights
        };
    }

    compressArray(array) {
        if (Array.isArray(array)) {
            return array.map(item => this.compressArray(item));
        }
        // Arrondir les nombres à 4 décimales
        return Number(Number(array).toFixed(4));
    }

    // Lors du chargement, reconstruire les données complètes
    async importData(data) {
        // Décompresser l'historique avant de le restaurer
        this.selfPlay.gameHistory = this.selfPlay.decompressHistory(data.gameHistory || []);

        // Restaurer les métriques de base
        if (data.metrics) {
            this.selfPlay.metrics.totalGames = data.metrics.totalGames || 0;
            this.selfPlay.metrics.winRates = data.metrics.winRates || { white: 0, black: 0, draw: 0 };
            this.selfPlay.metrics.captureRates = data.metrics.captureRates || { discs: 0, rings: 0 };
        }

        // Restaurer les poids du réseau
        if (data.networkWeights) {
            await this.importNetworkWeights(data.networkWeights);
        }
    }
}

class SelfPlay {
    constructor(numGames = 1000) {
        this.numGames = numGames;
        this.neuralNetwork = new NeuralNetwork();
        this.mcts = new MCTS(this.neuralNetwork, 1600);
        this.gameHistory = [];
        this.metrics = new TrainingMetrics();
        this.temperature = 1.0;  // Temperature parameter for action selection
        this.temperatureThreshold = 30;  // Number of moves before reducing temperature
        this.continuousTraining = false;  // Add this line
        
        // Paramètres pour la rotation des données
        this.maxHistorySize = 100; // Garder seulement les 100 dernières parties
        this.rotationStrategy = 'fifo'; // 'fifo' ou 'quality'
        this.gameQualityThreshold = 0.6; // Seuil de qualité pour conserver une partie
        this.storage = new TrainingStorage(this);
        
        // Paramètres de sauvegarde automatique
        this.autoSaveInterval = 100; // Sauvegarder toutes les 100 parties
        this.lastAutoSaveGame = 0;
    }

    createInitialState() {
        // Create an empty board
        const board = Array(BOARD_SIZE).fill(null).map(() => 
            Array(BOARD_SIZE).fill(null).map(() => 
                ({element: {}, tile: null, piece: null})
            )
        );

        // Set up initial inventory
        const inventory = {
            [PLAYER_WHITE]: { tiles: 9, discs: 6, rings: 3, capturedDiscs: 0, capturedRings: 0 },
            [PLAYER_BLACK]: { tiles: 9, discs: 6, rings: 3, capturedDiscs: 0, capturedRings: 0 }
        };

        // Place initial pieces on the board
        board[5][4].tile = { color: PLAYER_WHITE };
        board[5][5].tile = { color: PLAYER_WHITE };
        board[5][4].piece = { type: 'disc', color: PLAYER_WHITE };
        board[4][4].tile = { color: PLAYER_BLACK };
        board[4][5].tile = { color: PLAYER_BLACK };
        board[4][5].piece = { type: 'disc', color: PLAYER_BLACK };

        // Adjust inventory for initial setup
        inventory[PLAYER_WHITE].tiles -= 2;
        inventory[PLAYER_WHITE].discs -= 1;
        inventory[PLAYER_BLACK].tiles -= 2;
        inventory[PLAYER_BLACK].discs -= 1;

        return new HexaequoState(board, inventory, PLAYER_BLACK);
    }

    async train() {
        console.log("Démarrage de l'entraînement...");
        
        for (let gameId = 0; gameId < this.numGames; gameId++) {
            console.log(`\nPartie ${gameId + 1}/${this.numGames}`);
            try {
                const gameData = await this.playGame();
                
                // Gérer la rotation des données
                const wasAdded = this.manageGameHistory(gameData);
                
                if (wasAdded) {
                    // Mise à jour des métriques
                    this.metrics.updateGameMetrics(gameData);
                    
                    // Entraîner le réseau sur les dernières parties
                    if (this.gameHistory.length >= 5) {
                        await this.trainOnHistory();
                        this.metrics.logProgress();
                    }
                }
                
                // Ajouter des logs pour le suivi de la rotation
                console.log(`Taille de l'historique: ${this.gameHistory.length}`);
                console.log(`Qualité moyenne: ${this.calculateAverageQuality()}`);
                
            } catch (error) {
                console.error("Erreur pendant la partie:", error);
            }
        }
    }

    async playGame() {
        let state = this.createInitialState();
        const history = [];
        let gameLength = 0;

        while (!state.isTerminal() && gameLength < 100) {
            // Update temperature based on move number
            if (gameLength > this.temperatureThreshold) {
                this.temperature = 0.5;  // Reduce temperature for more focused play
            }

            const currentState = state.clone();
            const prediction = await this.neuralNetwork.predict(currentState);
            
            // Get legal actions
            const legalActions = currentState.getLegalActions();
            console.log(`\nTour ${gameLength + 1}:`, {
                player: currentState.currentPlayer,
                nbLegalActions: legalActions.length,
                typesActions: [...new Set(legalActions.map(a => a.type))]
            });
            
            // Get indices for legal actions
            const legalActionIndices = legalActions.map(action => 
                this.mcts.actionToIndex(action)
            );
            
            // Normaliser les probabilités pour les actions légales
            const actionProbs = new Array(prediction.policy.length).fill(0);
            let sum = 0;
            for (let i = 0; i < legalActionIndices.length; i++) {
                const idx = legalActionIndices[i];
                actionProbs[idx] = prediction.policy[idx];
                sum += actionProbs[idx];
            }
            
            // Normaliser
            if (sum > 0) {
                for (let i = 0; i < actionProbs.length; i++) {
                    actionProbs[i] /= sum;
                }
            } else {
                // Si toutes les probabilités sont 0, utiliser une distribution uniforme
                for (const idx of legalActionIndices) {
                    actionProbs[idx] = 1.0 / legalActions.length;
                }
            }

            history.push({
                state: currentState,
                actionProbs: actionProbs,
                currentPlayer: state.currentPlayer
            });

            // Sélectionner une action
            const action = this.sampleAction(actionProbs, legalActions);
            console.log("Action choisie:", action);
            
            state = state.applyAction(action);
            console.log("Nouvel état:", {
                inventory: state.inventory,
                nextPlayer: state.currentPlayer
            });
            
            gameLength++;
        }

        // Reset temperature for next game
        this.temperature = 1.0;

        const winner = state.getWinner();
        console.log("\n=== Fin de la partie ===");
        console.log("Résultat:", {
            winner: winner || "match nul",
            nbTours: gameLength,
            inventaireFinal: state.inventory
        });

        return {
            history,
            winner,
            finalState: state
        };
    }

    sampleAction(actionProbs, legalActions) {
        // Get probabilities only for legal actions
        const legalProbs = legalActions.map(action => 
            actionProbs[this.mcts.actionToIndex(action)]
        );
        
        // Apply temperature
        const temperature = this.temperature;
        let modifiedProbs = legalProbs.map(p => Math.pow(p, 1/temperature));
        
        // Normalize probabilities
        const sum = modifiedProbs.reduce((a, b) => a + b, 0);
        if (sum > 0) {
            modifiedProbs = modifiedProbs.map(p => p/sum);
        } else {
            // If all probabilities are zero, use uniform distribution
            for (const idx of legalActionIndices) {
                actionProbs[idx] = 1.0 / legalActions.length;
            }
        }
        
        // Sample from the distribution
        const rand = Math.random();
        let cumSum = 0;
        for (let i = 0; i < modifiedProbs.length; i++) {
            cumSum += modifiedProbs[i];
            if (rand < cumSum) {
                return legalActions[i];
            }
        }
        
        // Fallback to first legal action
        return legalActions[0];
    }

    async trainOnHistory() {
        if (this.gameHistory.length === 0) return;

        const batchSize = Math.min(32, this.gameHistory.length * 10);
        const samples = this.sampleTrainingData(batchSize);
        
        const policyLoss = await this.neuralNetwork.trainStep(
            samples.states,
            samples.actionProbs,
            samples.values
        );

        return policyLoss;
    }

    sampleTrainingData(batchSize) {
        const states = [];
        const actionProbs = [];
        const values = [];

        for (let i = 0; i < batchSize; i++) {
            const gameIndex = Math.floor(Math.random() * this.gameHistory.length);
            const game = this.gameHistory[gameIndex];
            const stepIndex = Math.floor(Math.random() * game.history.length);
            const step = game.history[stepIndex];

            states.push(step.state);
            actionProbs.push(step.actionProbs);
            
            // Calculer la valeur en fonction du gagnant
            const value = game.winner === step.currentPlayer ? 1 :
                         game.winner === null ? 0 : -1;
            values.push(value);
        }

        return { states, actionProbs, values };
    }

    async trainContinuously() {
        this.continuousTraining = true;
        console.log("Démarrage de l'entraînement continu...");
        
        let gamesPlayed = 0;
        while (this.continuousTraining) {
            try {
                const gameData = await this.playGame();
                gamesPlayed++;
                
                // Gérer la rotation de l'historique
                if (this.gameHistory.length >= this.maxHistorySize) {
                    this.gameHistory.shift(); // Supprimer la plus ancienne partie
                }
                this.gameHistory.push(gameData);

                // Compression périodique de l'historique
                if (gamesPlayed - this.lastCompressionGame >= this.compressionInterval) {
                    this.compressHistory();
                    this.lastCompressionGame = gamesPlayed;
                }

                // Mise à jour de l'affichage
                const currentGameDiv = document.getElementById('current-game');
                if (currentGameDiv) {
                    const winner = gameData.winner ? 
                        (gameData.winner === PLAYER_WHITE ? "Blanc" : "Noir") : 
                        "Match nul";
                    currentGameDiv.textContent = `Parties jouées: ${gamesPlayed} | Dernière partie: ${winner}`;
                }
                
                // Vérifier si une sauvegarde automatique est nécessaire
                if (gamesPlayed - this.lastAutoSaveGame >= this.autoSaveInterval) {
                    try {
                        await this.storage.exportToFile(true); // true indique une sauvegarde automatique
                        this.lastAutoSaveGame = gamesPlayed;
                        console.log(`Sauvegarde automatique effectuée après ${gamesPlayed} parties`);
                    } catch (error) {
                        console.error("Erreur lors de la sauvegarde automatique:", error);
                    }
                }

                this.metrics.updateGameMetrics(gameData);

                if (this.gameHistory.length >= 5) {
                    await this.trainOnHistory();
                    console.log(`Parties jouées: ${gamesPlayed}, Dernière perte: ${this.metrics.lastPolicyLoss}`);
                }

                if (gamesPlayed % 100 === 0) {
                    console.log(`Étape: ${gamesPlayed} parties jouées`);
                }
            } catch (error) {
                console.error("Erreur pendant l'entraînement continu:", error);
            }
        }
    }

    stopTraining() {
        this.continuousTraining = false;
        console.log("Arrêt de l'entraînement continu...");
    }

    // Nouvelle méthode pour gérer la rotation des données
    manageGameHistory(gameData) {
        // Calculer la qualité de la partie
        const gameQuality = this.evaluateGameQuality(gameData);
        gameData.quality = gameQuality;

        // Si l'historique est plein, appliquer la stratégie de rotation
        if (this.gameHistory.length >= this.maxHistorySize) {
            switch (this.rotationStrategy) {
                case 'fifo':
                    // Supprimer la partie la plus ancienne
                    this.gameHistory.shift();
                    break;
                    
                case 'quality':
                    // Supprimer la partie de plus basse qualité
                    const worstGameIndex = this.findWorstGameIndex();
                    if (worstGameIndex !== -1 && this.gameHistory[worstGameIndex].quality < gameQuality) {
                        this.gameHistory.splice(worstGameIndex, 1);
                    } else {
                        // Si la nouvelle partie est de moins bonne qualité, ne pas l'ajouter
                        return false;
                    }
                    break;
            }
        }

        // Ajouter la nouvelle partie si elle répond aux critères de qualité
        if (gameQuality >= this.gameQualityThreshold) {
            this.gameHistory.push(gameData);
            return true;
        }

        return false;
    }

    // Méthode pour évaluer la qualité d'une partie
    evaluateGameQuality(gameData) {
        let quality = 0;
        
        // Critère 1: Longueur de la partie (éviter les parties trop courtes ou trop longues)
        const optimalLength = 30; // Nombre de coups optimal
        const lengthQuality = Math.exp(-Math.abs(gameData.history.length - optimalLength) / 20);
        
        // Critère 2: Nombre de captures (favoriser les parties avec des captures)
        const captures = this.countCaptures(gameData.finalState);
        const captureQuality = Math.min(captures / 6, 1); // Maximum 6 captures pour un score parfait
        
        // Critère 3: Diversité des actions
        const actionDiversity = this.calculateActionDiversity(gameData.history);
        
        // Pondération des critères
        quality = (lengthQuality * 0.3) + (captureQuality * 0.4) + (actionDiversity * 0.3);
        
        return quality;
    }

    // Méthode pour compter les captures dans une partie
    countCaptures(finalState) {
        return finalState.inventory[PLAYER_WHITE].capturedDiscs + 
               finalState.inventory[PLAYER_BLACK].capturedDiscs +
               finalState.inventory[PLAYER_WHITE].capturedRings + 
               finalState.inventory[PLAYER_BLACK].capturedRings;
    }

    // Méthode pour calculer la diversité des actions
    calculateActionDiversity(history) {
        const actionTypes = new Set();
        const actionPositions = new Set();
        
        history.forEach(step => {
            const action = step.action;
            if (action) {
                actionTypes.add(action.type);
                actionPositions.add(`${action.row},${action.col}`);
            }
        });
        
        // Normaliser la diversité
        const typesDiversity = actionTypes.size / 4; // 4 types d'actions possibles
        const positionsDiversity = actionPositions.size / (BOARD_SIZE * BOARD_SIZE);
        
        return (typesDiversity + positionsDiversity) / 2;
    }

    // Méthode pour trouver l'index de la partie de plus basse qualité
    findWorstGameIndex() {
        if (this.gameHistory.length === 0) return -1;
        
        let worstIndex = 0;
        let worstQuality = this.gameHistory[0].quality;
        
        for (let i = 1; i < this.gameHistory.length; i++) {
            if (this.gameHistory[i].quality < worstQuality) {
                worstQuality = this.gameHistory[i].quality;
                worstIndex = i;
            }
        }
        
        return worstIndex;
    }

    // Méthode utilitaire pour calculer la qualité moyenne
    calculateAverageQuality() {
        if (this.gameHistory.length === 0) return 0;
        
        const totalQuality = this.gameHistory.reduce((sum, game) => sum + game.quality, 0);
        return totalQuality / this.gameHistory.length;
    }

    async saveProgress() {
        return this.storage.exportToFile();
    }

    async loadProgress(file) {
        return this.storage.importFromFile(file);
    }
}

// Fonction pour démarrer l'entraînement
async function startTraining() {
    const selfPlay = new SelfPlay();
    await selfPlay.train();
    return selfPlay.neuralNetwork;
} 

class TrainingMetrics {
    constructor() {
        this.reset();
        this.onUpdate = null;
    }

    reset() {
        this.gameLengths = [];
        this.winRates = { white: 0, black: 0, draw: 0 };
        this.captureRates = { discs: 0, rings: 0 };
        this.averagePolicyEntropy = 0;
        this.averageValueLoss = 0;
        this.totalGames = 0;
    }

    updateGameMetrics(gameData) {
        this.totalGames++;
        this.gameLengths.push(gameData.history.length);
        
        // Mise à jour des taux de victoire
        if (gameData.winner === PLAYER_WHITE) this.winRates.white++;
        else if (gameData.winner === PLAYER_BLACK) this.winRates.black++;
        else this.winRates.draw++;

        // Calcul des taux de capture moyens
        const finalState = gameData.finalState;
        const capturesDiscs = (
            finalState.inventory[PLAYER_WHITE].capturedDiscs + 
            finalState.inventory[PLAYER_BLACK].capturedDiscs
        );
        const capturesRings = (
            finalState.inventory[PLAYER_WHITE].capturedRings + 
            finalState.inventory[PLAYER_BLACK].capturedRings
        );
        
        this.captureRates.discs += capturesDiscs / 12; // 12 disques au total
        this.captureRates.rings += capturesRings / 6;  // 6 anneaux au total

        console.log("\n=== Statistiques de la partie ===");
        console.log({
            numeroPartie: this.totalGames,
            vainqueur: gameData.winner || "match nul",
            nbTours: gameData.history.length,
            captures: {
                disques: capturesDiscs,
                anneaux: capturesRings
            }
        });
    }

    updateTrainingMetrics(policyLoss, valueLoss) {
        // Calcul de l'entropie de la politique (mesure de l'exploration)
        const policyEntropy = -policyLoss * Math.log(policyLoss);
        this.averagePolicyEntropy = (
            this.averagePolicyEntropy * (this.totalGames - 1) + 
            policyEntropy
        ) / this.totalGames;

        // Mise à jour de la perte de valeur moyenne
        this.averageValueLoss = (
            this.averageValueLoss * (this.totalGames - 1) + 
            valueLoss
        ) / this.totalGames;
    }

    getReport() {
        const avgGameLength = this.gameLengths.reduce((a, b) => a + b, 0) / this.totalGames;
        
        return {
            totalGames: this.totalGames,
            averageGameLength: avgGameLength.toFixed(1),
            winRates: {
                white: (this.winRates.white / this.totalGames * 100).toFixed(1) + '%',
                black: (this.winRates.black / this.totalGames * 100).toFixed(1) + '%',
                draw: (this.winRates.draw / this.totalGames * 100).toFixed(1) + '%'
            },
            captureRates: {
                discs: (this.captureRates.discs / this.totalGames * 100).toFixed(1) + '%',
                rings: (this.captureRates.rings / this.totalGames * 100).toFixed(1) + '%'
            },
            policyEntropy: this.averagePolicyEntropy.toFixed(3),
            valueLoss: this.averageValueLoss.toFixed(3)
        };
    }

    logProgress() {
        const report = this.getReport();
        console.log('\n=== Métriques d\'entraînement ===');
        console.log(`Parties jouées: ${report.totalGames}`);
        console.log(`Longueur moyenne: ${report.averageGameLength} coups`);
        console.log('Taux de victoire:', report.winRates);
        console.log('Taux de capture:', report.captureRates);
        console.log(`Entropie politique: ${report.policyEntropy}`);
        console.log(`Perte de valeur: ${report.valueLoss}`);

        if (this.onUpdate) this.onUpdate(this);
    }
} 

async function testTraining() {
    console.log("\n=== Test d'entraînement d'AlphaZero ===");
    
    try {
        const selfPlay = new SelfPlay(5); // 5 parties pour le test
        console.log("Démarrage de l'entraînement test...");
        await selfPlay.train();
        
        // Test de prédiction après entraînement
        const testState = new HexaequoState(
            Array(BOARD_SIZE).fill(null).map(() => 
                Array(BOARD_SIZE).fill(null).map(() => 
                    ({element: {}, tile: null, piece: null})
                )
            ),
            {
                [PLAYER_BLACK]: { tiles: 10, discs: 6, rings: 3, capturedDiscs: 0, capturedRings: 0 },
                [PLAYER_WHITE]: { tiles: 10, discs: 6, rings: 3, capturedDiscs: 0, capturedRings: 0 }
            },
            PLAYER_BLACK
        );

        const prediction = await selfPlay.neuralNetwork.predict(testState);
        console.log("Test de prédiction après entraînement:");
        console.log("- Valeur:", prediction.value.toFixed(3));
        console.log("- Somme des probabilités:", 
            prediction.policy.reduce((a, b) => a + b, 0).toFixed(3));
        
        return "✅ Test d'entraînement réussi";
    } catch (error) {
        console.error("❌ Erreur pendant l'entraînement:", error);
        throw error;
    }
} 