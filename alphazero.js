// Namespace pour l'IA du jeu Hexaequo
const HexaequoAI = {
// Game constants
    BOARD_SIZE: 10,
    PLAYER_WHITE: 'white',
    PLAYER_BLACK: 'black',

// Action type constants
    ACTION_TYPES: {
    PLACE_TILE: 'place-tile',
    PLACE_DISC: 'place-disc',
    PLACE_RING: 'place-ring',
    MOVE: 'move'
    },

// Movement directions
    MOVE_DIRECTIONS: [
    [-1, 0],  // Nord
    [-1, 1],  // Nord-Est
    [0, 1],   // Est
    [1, 0],   // Sud
    [1, -1],  // Sud-Ouest
    [0, -1]   // Ouest
    ]
};

// Définition de la classe HexaequoState dans le namespace
HexaequoAI.HexaequoState = class {
    constructor(board, inventory, currentPlayer) {
        this.board = JSON.parse(JSON.stringify(board));
        this.inventory = JSON.parse(JSON.stringify(inventory));
        this.currentPlayer = currentPlayer;
    }

    // Vérifie si l'état est terminal (fin de partie)
    isTerminal() {
        return (
            this.inventory[HexaequoAI.PLAYER_WHITE].capturedDiscs === 6 ||
            this.inventory[HexaequoAI.PLAYER_BLACK].capturedDiscs === 6 ||
            this.inventory[HexaequoAI.PLAYER_WHITE].capturedRings === 3 ||
            this.inventory[HexaequoAI.PLAYER_BLACK].capturedRings === 3 ||
            !this.hasValidMoves() ||
            !this.hasRemainingPieces(HexaequoAI.PLAYER_WHITE) ||
            !this.hasRemainingPieces(HexaequoAI.PLAYER_BLACK)
        );
    }

    // Retourne la récompense pour l'état terminal (-1 pour défaite, 1 pour victoire, 0 pour match nul)
    getReward() {
        if (!this.isTerminal()) {
            return 0;
        }

        if (this.inventory[HexaequoAI.PLAYER_WHITE].capturedDiscs === 6 ||
            this.inventory[HexaequoAI.PLAYER_WHITE].capturedRings === 3 ||
            !this.hasRemainingPieces(HexaequoAI.PLAYER_BLACK)) {
            return this.currentPlayer === HexaequoAI.PLAYER_WHITE ? 1 : -1;
        }

        if (this.inventory[HexaequoAI.PLAYER_BLACK].capturedDiscs === 6 ||
            this.inventory[HexaequoAI.PLAYER_BLACK].capturedRings === 3 ||
            !this.hasRemainingPieces(HexaequoAI.PLAYER_WHITE)) {
            return this.currentPlayer === HexaequoAI.PLAYER_BLACK ? 1 : -1;
        }

        return 0; // Match nul
    }

    // Retourne la liste des actions légales possibles
    getLegalActions() {
        const actions = [];
        
        // Actions de placement de tuiles
        if (this.inventory[this.currentPlayer].tiles > 0) {
            for (let row = 0; row < HexaequoAI.BOARD_SIZE; row++) {
                for (let col = 0; col < HexaequoAI.BOARD_SIZE; col++) {
                    if (this.canPlaceTile(row, col)) {
                        actions.push({
                            type: HexaequoAI.ACTION_TYPES.PLACE_TILE,
                            row: row,
                            col: col
                        });
                    }
                }
            }
        }

        // Actions de placement de pièces
        for (let row = 0; row < HexaequoAI.BOARD_SIZE; row++) {
            for (let col = 0; col < HexaequoAI.BOARD_SIZE; col++) {
                if (this.canPlacePiece(row, col)) {
                    if (this.inventory[this.currentPlayer].discs > 0) {
                        actions.push({
                            type: HexaequoAI.ACTION_TYPES.PLACE_DISC,
                            row: row,
                            col: col
                        });
                    }
                    if (this.inventory[this.currentPlayer].rings > 0 && 
                        this.inventory[this.currentPlayer].capturedDiscs > 0) {
                        actions.push({
                            type: HexaequoAI.ACTION_TYPES.PLACE_RING,
                            row: row,
                            col: col
                        });
                    }
                }
            }
        }

        // Actions de mouvement
        for (let row = 0; row < HexaequoAI.BOARD_SIZE; row++) {
            for (let col = 0; col < HexaequoAI.BOARD_SIZE; col++) {
                const piece = this.board[row][col].piece;
                if (piece && piece.color === this.currentPlayer) {
                    const moves = this.getLegalMoves(row, col);
                    moves.forEach(move => {
                        actions.push({
                            type: HexaequoAI.ACTION_TYPES.MOVE,
                            from: { row: row, col: col },
                            to: { row: move.row, col: move.col }
                        });
                    });
                }
            }
        }

        return actions;
    }

    // Méthodes auxiliaires pour vérifier les coups légaux
    canPlaceTile(row, col) {
        if (this.board[row][col].tile || this.inventory[this.currentPlayer].tiles === 0) {
            return false;
        }
        
        const directions = row % 2 === 0 ?
            [[-1, 0], [-1, 1], [0, 1], [1, 1], [1, 0], [0, -1]] :
            [[-1, -1], [-1, 0], [0, 1], [1, 0], [1, -1], [0, -1]];
        
        let adjacentTiles = 0;
        for (const [dx, dy] of directions) {
            const newRow = row + dx;
            const newCol = col + dy;
            if (this.isValidPosition(newRow, newCol) && this.board[newRow][newCol].tile) {
                adjacentTiles++;
            }
        }
        
        return adjacentTiles >= 2;
    }

    canPlacePiece(row, col) {
        return this.board[row][col].tile &&
               this.board[row][col].tile.color === this.currentPlayer &&
               !this.board[row][col].piece;
    }

    isValidPosition(row, col) {
        return row >= 0 && row < HexaequoAI.BOARD_SIZE && 
               col >= 0 && col < HexaequoAI.BOARD_SIZE;
    }

    hasValidMoves() {
        return this.getLegalActions().length > 0;
    }

    hasRemainingPieces(player) {
        for (let row = 0; row < HexaequoAI.BOARD_SIZE; row++) {
            for (let col = 0; col < HexaequoAI.BOARD_SIZE; col++) {
                const piece = this.board[row][col].piece;
                if (piece && piece.color === player) {
                    return true;
                }
            }
        }
        return false;
    }

    // Applique une action et retourne le nouvel état
    applyAction(action) {
        const newState = new HexaequoAI.HexaequoState(
            this.board,
            this.inventory,
            this.currentPlayer
        );

        switch (action.type) {
            case HexaequoAI.ACTION_TYPES.PLACE_TILE:
                newState.board[action.row][action.col].tile = { color: this.currentPlayer };
                newState.inventory[this.currentPlayer].tiles--;
                break;

            case HexaequoAI.ACTION_TYPES.PLACE_DISC:
                newState.board[action.row][action.col].piece = { 
                    type: 'disc',
                    color: this.currentPlayer 
                };
                newState.inventory[this.currentPlayer].discs--;
                break;

            case HexaequoAI.ACTION_TYPES.PLACE_RING:
                newState.board[action.row][action.col].piece = { 
                    type: 'ring',
                    color: this.currentPlayer 
                };
                newState.inventory[this.currentPlayer].rings--;
                newState.inventory[this.currentPlayer].capturedDiscs--;
                break;

            case HexaequoAI.ACTION_TYPES.MOVE:
                const piece = newState.board[action.from.row][action.from.col].piece;
                newState.board[action.from.row][action.from.col].piece = null;
                newState.board[action.to.row][action.to.col].piece = piece;
                break;
        }

        newState.currentPlayer = this.currentPlayer === HexaequoAI.PLAYER_WHITE ? 
            HexaequoAI.PLAYER_BLACK : HexaequoAI.PLAYER_WHITE;

        return newState;
    }

    getLegalMoves(row, col) {
        const moves = [];
        const piece = this.board[row][col].piece;

        if (!piece) {
            return moves;
        }

        if (piece.type === 'disc') {
            // Mouvements adjacents pour les disques
            const directions = row % 2 === 0 ?
                [[-1, 0], [-1, 1], [0, 1], [1, 1], [1, 0], [0, -1]] : // Ligne paire
                [[-1, -1], [-1, 0], [0, 1], [1, 0], [1, -1], [0, -1]]; // Ligne impaire

            // Mouvements simples
            for (const [dx, dy] of directions) {
                const newRow = row + dx;
                const newCol = col + dy;
                if (this.isValidPosition(newRow, newCol) && 
                    !this.board[newRow][newCol].piece && 
                    this.board[newRow][newCol].tile) {
                    moves.push({ row: newRow, col: newCol });
                }
            }

            // Mouvements de saut
            const jumpDirections = [[-2, -1], [-2, 1], [0, 2], [2, 1], [2, -1], [0, -2]];
            for (const [dx, dy] of jumpDirections) {
                let offset = row % 2 === 0 ? 1 : 0;
                let middleRow = row + Math.floor(dx / 2);
                let middleCol = col + Math.floor(dy / 2);
                if (dx !== 0) {
                    middleCol = col + Math.floor(dy / 2) + offset;
                }
                let jumpRow = row + dx;
                let jumpCol = col + dy;

                if (this.isValidPosition(middleRow, middleCol) && 
                    this.isValidPosition(jumpRow, jumpCol) && 
                    this.board[middleRow][middleCol].piece &&
                    !this.board[jumpRow][jumpCol].piece &&
                    this.board[jumpRow][jumpCol].tile) {
                    moves.push({ row: jumpRow, col: jumpCol });
                }
            }
        } else if (piece.type === 'ring') {
            // Mouvements de l'anneau (distance de 2)
            const ringDirections = row % 2 === 0 ?
                [[-2, -1], [-2, 0], [-2, 1], [-1, 2], [0, 2], [1, 2], 
                 [2, 1], [2, 0], [2, -1], [1, -1], [0, -2], [-1, -1]] : // Ligne paire
                [[-2, -1], [-2, 0], [-2, 1], [-1, 1], [0, 2], [1, 1],
                 [2, 1], [2, 0], [2, -1], [1, -2], [0, -2], [-1, -2]];  // Ligne impaire

            for (const [dx, dy] of ringDirections) {
                const newRow = row + dx;
                const newCol = col + dy;
                if (this.isValidPosition(newRow, newCol) && 
                    this.board[newRow][newCol].tile) {
                    const targetPiece = this.board[newRow][newCol].piece;
                    if (!targetPiece || targetPiece.color !== piece.color) {
                        moves.push({ row: newRow, col: newCol });
                    }
                }
            }
        }

        return moves;
    }
};

// Définition de la classe NeuralNetwork dans le namespace
HexaequoAI.NeuralNetwork = class {
    constructor() {
        this.initializeNetwork();
    }

    async initializeNetwork() {
        // Créer le modèle du réseau de politique (policy network)
        this.policyNetwork = tf.sequential({
            layers: [
                tf.layers.conv2d({
                    inputShape: [HexaequoAI.BOARD_SIZE, HexaequoAI.BOARD_SIZE, 3],
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
                    inputShape: [HexaequoAI.BOARD_SIZE, HexaequoAI.BOARD_SIZE, 3],
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
            const boardTensor = tf.zeros([HexaequoAI.BOARD_SIZE, HexaequoAI.BOARD_SIZE, 3]);
            
            // Parcourir le plateau
            for (let row = 0; row < HexaequoAI.BOARD_SIZE; row++) {
                for (let col = 0; col < HexaequoAI.BOARD_SIZE; col++) {
                    const cell = state.board[row][col];
                    
                    // Canal 0: tuiles (1 pour blanc, -1 pour noir)
                    if (cell.tile) {
                        boardTensor.bufferSync().set(
                            row, col, 0,
                            cell.tile.color === HexaequoAI.PLAYER_WHITE ? 1 : -1
                        );
                    }
                    
                    // Canal 1: pièces (1 pour disque blanc, -1 pour disque noir)
                    if (cell.piece && cell.piece.type === 'disc') {
                        boardTensor.bufferSync().set(
                            row, col, 1,
                            cell.piece.color === HexaequoAI.PLAYER_WHITE ? 1 : -1
                        );
                    }
                    
                    // Canal 2: anneaux (1 pour anneau blanc, -1 pour anneau noir)
                    if (cell.piece && cell.piece.type === 'ring') {
                        boardTensor.bufferSync().set(
                            row, col, 2,
                            cell.piece.color === HexaequoAI.PLAYER_WHITE ? 1 : -1
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

    async saveModel() {
        try {
            await this.policyNetwork.save('localstorage://hexaequo-policy');
            await this.valueNetwork.save('localstorage://hexaequo-value');
            console.log('Model saved successfully');
        } catch (error) {
            console.error('Error saving model:', error);
        }
    }

    async loadModel() {
        try {
            this.policyNetwork = await tf.loadLayersModel('localstorage://hexaequo-policy');
            this.valueNetwork = await tf.loadLayersModel('localstorage://hexaequo-value');
            console.log('Model loaded successfully');
            return true;
        } catch (error) {
            console.error('Error loading model:', error);
            return false;
        }
    }
};

// Définition de la classe MCTSNode dans le namespace
HexaequoAI.MCTSNode = class {
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
};

// Définition de la classe MCTS dans le namespace
HexaequoAI.MCTS = class {
    constructor(neuralNetwork, options = {}) {
        this.neuralNetwork = neuralNetwork;
        // Options par défaut
        this.options = {
            maxSimulations: 200,    // Réduit de 1600 à 200
            maxTimeMs: 5000,        // 5 secondes maximum
            minSimulations: 50,     // Minimum de simulations avant de vérifier le temps
            ...options
        };
        this.explorationConstant = 2.0;
        this.dirichletNoise = 0.3;
        this.dirichletAlpha = 0.5;
    }

    async search(state) {
        const root = new HexaequoAI.MCTSNode(state);
        const startTime = performance.now();
        let simCount = 0;
        
        // Continuer tant qu'on n'a pas atteint le nombre max de simulations ou le temps max
        while (simCount < this.options.maxSimulations) {
            // Vérifier le temps écoulé après le minimum de simulations
            if (simCount >= this.options.minSimulations) {
                const elapsedTime = performance.now() - startTime;
                if (elapsedTime >= this.options.maxTimeMs) {
                    console.log(`Arrêt après ${simCount} simulations (${elapsedTime.toFixed(0)}ms)`);
                    break;
                }
            }

            let node = root;
            
            // 1. Sélection
            while (!node.isLeaf() && !node.state.isTerminal()) {
                node = this.select(node);
            }

            // 2. Expansion et évaluation
            if (!node.state.isTerminal()) {
                await this.expand(node);
            }

            // 3. Simulation/Évaluation
            const value = await this.evaluate(node);

            // 4. Rétropropagation
            this.backpropagate(node, value);
            simCount++;
        }

        const totalTime = performance.now() - startTime;
        console.log(`MCTS terminé : ${simCount} simulations en ${totalTime.toFixed(0)}ms`);

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
            node.children.set(action, new HexaequoAI.MCTSNode(nextState, node, priorProb));
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
        const base = HexaequoAI.BOARD_SIZE * HexaequoAI.BOARD_SIZE;
        
        switch(action.type) {
            case HexaequoAI.ACTION_TYPES.PLACE_TILE:
                return action.row * HexaequoAI.BOARD_SIZE + action.col;
            
            case HexaequoAI.ACTION_TYPES.PLACE_DISC:
                return base + (action.row * HexaequoAI.BOARD_SIZE + action.col);
            
            case HexaequoAI.ACTION_TYPES.PLACE_RING:
                return 2 * base + (action.row * HexaequoAI.BOARD_SIZE + action.col);
            
            case HexaequoAI.ACTION_TYPES.MOVE:
                const dirIndex = HexaequoAI.MOVE_DIRECTIONS.findIndex(([dr, dc]) => 
                    dr === (action.to.row - action.from.row) && 
                    dc === (action.to.col - action.from.col)
                );
                return 3 * base + (action.from.row * HexaequoAI.BOARD_SIZE + action.from.col) * 6 + dirIndex;
            
            default:
                throw new Error(`Action type inconnu: ${action.type}`);
        }
    }

    indexToAction(index) {
        const base = HexaequoAI.BOARD_SIZE * HexaequoAI.BOARD_SIZE;
        
        if (index < base) {
            // Place tile
            return {
                type: HexaequoAI.ACTION_TYPES.PLACE_TILE,
                row: Math.floor(index / HexaequoAI.BOARD_SIZE),
                col: index % HexaequoAI.BOARD_SIZE
            };
        }
        
        if (index < 2 * base) {
            // Place disc
            index -= base;
            return {
                type: HexaequoAI.ACTION_TYPES.PLACE_DISC,
                row: Math.floor(index / HexaequoAI.BOARD_SIZE),
                col: index % HexaequoAI.BOARD_SIZE
            };
        }
        
        if (index < 3 * base) {
            // Place ring
            index -= 2 * base;
            return {
                type: HexaequoAI.ACTION_TYPES.PLACE_RING,
                row: Math.floor(index / HexaequoAI.BOARD_SIZE),
                col: index % HexaequoAI.BOARD_SIZE
            };
        }
        
        // Move piece
        index -= 3 * base;
        const fromPos = Math.floor(index / 6);
        const dirIndex = index % 6;
        const fromRow = Math.floor(fromPos / HexaequoAI.BOARD_SIZE);
        const fromCol = fromPos % HexaequoAI.BOARD_SIZE;
        const [dr, dc] = HexaequoAI.MOVE_DIRECTIONS[dirIndex];
        
        return {
            type: HexaequoAI.ACTION_TYPES.MOVE,
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
        return (newInventory[HexaequoAI.PLAYER_WHITE].capturedDiscs > oldInventory[HexaequoAI.PLAYER_WHITE].capturedDiscs) ||
               (newInventory[HexaequoAI.PLAYER_BLACK].capturedDiscs > oldInventory[HexaequoAI.PLAYER_BLACK].capturedDiscs) ||
               (newInventory[HexaequoAI.PLAYER_WHITE].capturedRings > oldInventory[HexaequoAI.PLAYER_WHITE].capturedRings) ||
               (newInventory[HexaequoAI.PLAYER_BLACK].capturedRings > oldInventory[HexaequoAI.PLAYER_BLACK].capturedRings);
    }
};

// Définition de la classe TrainingStorage dans le namespace
HexaequoAI.TrainingStorage = class {
    constructor(selfPlay) {
        this.selfPlay = selfPlay;
    }

    async exportToFile(isAutoSave = false) {
        try {
            const data = {
                metrics: {
                    totalGames: this.selfPlay.metrics.totalGames,
                    winRates: this.selfPlay.metrics.winRates
                },
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

    async compressNetworkWeights() {
        const policyWeights = await Promise.all(
            this.selfPlay.neuralNetwork.policyNetwork.getWeights().map(async w => {
                const array = await w.array();
                return this.compressArray(array);
            })
        );

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
        return Number(Number(array).toFixed(4));
    }
};

// Définition de la classe SelfPlay dans le namespace
HexaequoAI.SelfPlay = class {
    constructor(options = {}) {
        this.options = {
            gamesPerIteration: 100,    // Nombre de parties par itération
            iterations: 10,            // Nombre d'itérations d'entraînement
            savingFrequency: 10,       // Fréquence de sauvegarde du modèle
            ...options
        };
        
        this.neuralNetwork = new HexaequoAI.NeuralNetwork();
        this.gameHistory = new HexaequoAI.GameHistory();
        this.metrics = {
            winRates: [],
            averageGameLength: [],
            trainingLoss: []
        };
    }

    async train() {
        console.log("Démarrage de l'entraînement...");
        
        for (let iteration = 0; iteration < this.options.iterations; iteration++) {
            console.log(`\nItération ${iteration + 1}/${this.options.iterations}`);
            
            // Jouer plusieurs parties
            for (let game = 0; game < this.options.gamesPerIteration; game++) {
                await this.playSingleGame();
            }
            
            // Entraîner le réseau sur les parties jouées
            const losses = await this.trainOnGames();
            
            // Sauvegarder le modèle périodiquement
            if ((iteration + 1) % this.options.savingFrequency === 0) {
                await this.neuralNetwork.saveModel();
            }
            
            // Afficher les métriques
            this.logProgress(iteration);
        }
    }

    async playSingleGame() {
        const mcts = new HexaequoAI.MCTS(this.neuralNetwork, {
            maxSimulations: 100,  // Moins de simulations pendant l'entraînement
            maxTimeMs: 2000,      // Temps plus court pendant l'entraînement
            minSimulations: 25
        });

        let state = new HexaequoAI.HexaequoState(
            this.createInitialBoard(),
            this.createInitialInventory(),
            HexaequoAI.PLAYER_BLACK
        );

        const gameHistory = {
            states: [],
            actions: [],
            winner: null
        };

        while (!state.isTerminal()) {
            gameHistory.states.push(JSON.stringify(state));
            const action = await mcts.search(state);
            gameHistory.actions.push(action);
            state = state.applyAction(action);
        }

        gameHistory.winner = this.determineWinner(state);
        this.gameHistory.addGame(gameHistory);
        
        return gameHistory;
    }

    async trainOnGames() {
        const batchSize = 32;
        let totalPolicyLoss = 0;
        let totalValueLoss = 0;
        let numBatches = 0;

        for (const game of this.gameHistory.getRecentGames()) {
            const states = game.states.map(s => JSON.parse(s));
            const finalReward = game.winner === HexaequoAI.PLAYER_BLACK ? 1 : -1;

            for (let i = 0; i < states.length; i += batchSize) {
                const batch = states.slice(i, i + batchSize);
                const targets = batch.map((_, idx) => {
                    const moveIdx = i + idx;
                    return {
                        policy: this.createPolicyTarget(game.actions[moveIdx]),
                        value: finalReward * Math.pow(0.95, states.length - moveIdx - 1)
                    };
                });

                const { policyLoss, valueLoss } = await this.neuralNetwork.trainStep(
                    batch,
                    targets.map(t => t.policy),
                    targets.map(t => [t.value])
                );

                totalPolicyLoss += policyLoss;
                totalValueLoss += valueLoss;
                numBatches++;
            }
        }

        return {
            policyLoss: totalPolicyLoss / numBatches,
            valueLoss: totalValueLoss / numBatches
        };
    }

    logProgress(iteration) {
        console.log(`\nMétriques d'entraînement (Itération ${iteration + 1}):`);
        console.log(`Taux de victoire moyen: ${this.metrics.winRates[iteration].toFixed(2)}%`);
        console.log(`Longueur moyenne des parties: ${this.metrics.averageGameLength[iteration].toFixed(1)} coups`);
        console.log(`Perte moyenne: ${this.metrics.trainingLoss[iteration].toFixed(4)}`);
    }

    createInitialBoard() {
        const board = Array(HexaequoAI.BOARD_SIZE).fill(null).map(() => 
            Array(HexaequoAI.BOARD_SIZE).fill(null).map(() => 
                ({element: {}, tile: null, piece: null})
            )
        );

        // Position initiale
        board[5][4].tile = { color: HexaequoAI.PLAYER_WHITE };
        board[5][5].tile = { color: HexaequoAI.PLAYER_WHITE };
        board[5][4].piece = { type: 'disc', color: HexaequoAI.PLAYER_WHITE };
        board[4][4].tile = { color: HexaequoAI.PLAYER_BLACK };
        board[4][5].tile = { color: HexaequoAI.PLAYER_BLACK };
        board[4][5].piece = { type: 'disc', color: HexaequoAI.PLAYER_BLACK };

        return board;
    }

    createInitialInventory() {
        return {
            [HexaequoAI.PLAYER_WHITE]: { 
                tiles: 7, discs: 5, rings: 3, 
                capturedDiscs: 0, capturedRings: 0 
            },
            [HexaequoAI.PLAYER_BLACK]: { 
                tiles: 7, discs: 5, rings: 3, 
                capturedDiscs: 0, capturedRings: 0 
            }
        };
    }
};

HexaequoAI.GameHistory = class {
    constructor() {
        this.games = [];
        this.currentGame = null;
    }

    startNewGame() {
        this.currentGame = {
            states: [],
            actions: [],
            winner: null
        };
    }

    addMove(state, action) {
        if (this.currentGame) {
            this.currentGame.states.push(JSON.stringify(state));
            this.currentGame.actions.push(action);
        }
    }

    endGame(winner) {
        if (this.currentGame) {
            this.currentGame.winner = winner;
            this.games.push(this.currentGame);
            this.currentGame = null;
        }
    }

    async trainNetwork(neuralNetwork) {
        console.log('Starting training on', this.games.length, 'games');
        
        for (const game of this.games) {
            const states = game.states.map(s => JSON.parse(s));
            const finalReward = game.winner === HexaequoAI.PLAYER_BLACK ? 1 : -1;
            
            for (let i = 0; i < states.length; i++) {
                const state = states[i];
                const action = game.actions[i];
                
                // Calculer la valeur cible (reward discounté)
                const targetValue = finalReward * Math.pow(0.95, states.length - i - 1);
                
                // Créer le vecteur de politique cible
                const policyTarget = new Array(900).fill(0);
                const actionIndex = HexaequoAI.MCTS.prototype.actionToIndex(action);
                policyTarget[actionIndex] = 1;
                
                // Entraîner le réseau
                await neuralNetwork.trainStep([state], [policyTarget], [[targetValue]]);
            }
        }
        
        console.log('Training completed');
    }
};

// Export du namespace si nécessaire
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HexaequoAI;
} 