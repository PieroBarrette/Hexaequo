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
    constructor(board, inventory, currentPlayer, rewardWeights = null) {
        this.board = JSON.parse(JSON.stringify(board));
        this.inventory = JSON.parse(JSON.stringify(inventory));
        this.currentPlayer = currentPlayer;
        // Utiliser les poids par défaut si non fournis
        this.rewardWeights = rewardWeights || {
            capturedDisc: 0.1,
            capturedRing: 0.2,
            lostDisc: 0.1,
            lostRing: 0.2
        };
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
    /*getReward() {
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
    }*/

        getReward() {
            // Récompense finale si l'état est terminal
            if (this.isTerminal()) {
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
        
            let intermediateReward = 0;
            const weights = this.rewardWeights; // Utiliser les poids locaux
            const opponent = this.currentPlayer === HexaequoAI.PLAYER_WHITE ? 
                HexaequoAI.PLAYER_BLACK : HexaequoAI.PLAYER_WHITE;
        
            // Récompenses pour les captures
            intermediateReward += this.inventory[this.currentPlayer].capturedDiscs * weights.capturedDisc;
            intermediateReward += this.inventory[this.currentPlayer].capturedRings * weights.capturedRing;
        
            // Pénalités pour les pertes
            intermediateReward -= this.inventory[opponent].capturedDiscs * weights.lostDisc;
            intermediateReward -= this.inventory[opponent].capturedRings * weights.lostRing;
        
            return intermediateReward;
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
            this.currentPlayer,
            this.rewardWeights // Passer les poids au nouvel état
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
        this.policyNetwork = null;
        this.valueNetwork = null;
        this.VERSION = {
            MAJOR: 1,  // Change lors de modifications incompatibles
            MINOR: 0,  // Change lors d'ajouts de fonctionnalités
            PATCH: 0   // Change lors de corrections de bugs
        };
        // Ajouter les statistiques
        this.stats = {
            selfPlayGames: 0,
            humanGames: 0,
            lastUpdate: null
        };
        this.isTraining = false; // Verrou d'entraînement
        this.rewardWeights = {
            capturedDisc: 0.1,
            capturedRing: 0.2,
            lostDisc: 0.1,
            lostRing: 0.2
        };
    }

    getVersionString() {
        return `${this.VERSION.MAJOR}.${this.VERSION.MINOR}.${this.VERSION.PATCH}`;
    }

    // Ajouter la fonction arraysEqual comme méthode de classe
    arraysEqual(a, b) {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) return false;
        }
        return true;
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
        if (this.isTraining) {
            console.warn('Training already in progress, skipping this step');
            return null;
        }

        try {
            this.isTraining = true;
            const batchSize = states.length;
            const inputTensor = tf.tidy(() => {
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
        } catch (error) {
            console.error('Error during training step:', error);
            return null;
        } finally {
            this.isTraining = false;
        }
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

    async getWeights() {
        try {
            console.log('Getting network weights...');
            const policyWeights = this.policyNetwork.getWeights();
            const valueWeights = this.valueNetwork.getWeights();
            return [...policyWeights, ...valueWeights];
        } catch (error) {
            console.error('Error getting weights:', error);
            throw error;
        }
    }

    async setWeights(weights) {
        try {
            console.log('Setting network weights...');
            const policyWeightCount = this.policyNetwork.getWeights().length;
            console.log(`Policy network expects ${policyWeightCount} weight tensors`);
            
            const policyWeights = weights.slice(0, policyWeightCount);
            const valueWeights = weights.slice(policyWeightCount);
            
            // Vérifier la compatibilité des formes avant de définir les poids
            const policyShapes = this.policyNetwork.getWeights().map(w => w.shape);
            const valueShapes = this.valueNetwork.getWeights().map(w => w.shape);
            
            policyWeights.forEach((w, i) => {
                if (!this.arraysEqual(w.shape, policyShapes[i])) {
                    throw new Error(`Policy network shape mismatch at layer ${i}: expected ${policyShapes[i]}, got ${w.shape}`);
                }
            });
            
            valueWeights.forEach((w, i) => {
                if (!this.arraysEqual(w.shape, valueShapes[i])) {
                    throw new Error(`Value network shape mismatch at layer ${i}: expected ${valueShapes[i]}, got ${w.shape}`);
                }
            });
            
            this.policyNetwork.setWeights(policyWeights);
            this.valueNetwork.setWeights(valueWeights);
            console.log('✅ Weights set successfully');
        } catch (error) {
            console.error('Error setting weights:', error);
            throw error;
        }
    }

    async saveNetwork(filename = 'hexaequo-network.json') {
        try {
            console.log('Saving network...');
            const weights = await this.getWeights();
            
            const serializedWeights = await Promise.all(
                weights.map(async w => ({
                    shape: w.shape,
                    data: Array.from(await w.data()).map(n => Math.round(n * 10000) / 10000)
                }))
            );

            const saveData = {
                v: this.getVersionString(),
                d: new Date().toISOString().split('T')[0],
                w: serializedWeights,
                metadata: {
                    architecture: {
                        policy: this.policyNetwork.layers.map(l => l.getConfig()),
                        value: this.valueNetwork.layers.map(l => l.getConfig())
                    },
                    training: {
                        lastUpdate: this.stats.lastUpdate,
                        selfPlayGames: this.stats.selfPlayGames,
                        humanGames: this.stats.humanGames
                    },
                    rewardWeights: this.rewardWeights,
                }
            };

            // Compression supplémentaire : convertir les nombres en chaînes plus courtes
            const compressedData = JSON.stringify(saveData, (key, value) => {
                if (typeof value === 'number') {
                    // Convertir les petits nombres en notation scientifique si plus efficace
                    if (Math.abs(value) < 0.0001 || Math.abs(value) >= 10000) {
                        return value.toExponential(4);
                    }
                    return Number(value.toFixed(4));
                }
                return value;
            });

            // Créer et télécharger le fichier
            const blob = new Blob([compressedData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            console.log('Network saved successfully');
            return true;
        } catch (error) {
            console.error('Error saving network:', error);
            return false;
        }
    }

    async loadNetwork(file) {
        try {
            const saveData = JSON.parse(await file.text());
            
            // Charger les poids des récompenses s'ils existent
            if (saveData.metadata?.rewardWeights) {
                this.rewardWeights = saveData.metadata.rewardWeights;
                console.log('Reward weights loaded:', this.rewardWeights);
            }
            
            // Charger les statistiques si elles existent
            if (saveData.metadata?.training) {
                this.stats = {
                    selfPlayGames: saveData.metadata.training.selfPlayGames || 0,
                    humanGames: saveData.metadata.training.humanGames || 0,
                    lastUpdate: saveData.metadata.training.lastUpdate || null
                };
                console.log('Network statistics loaded:');
                console.log('- Self-play games:', this.stats.selfPlayGames);
                console.log('- Human games:', this.stats.humanGames);
                console.log('- Last update:', this.stats.lastUpdate);
            }

            const version = saveData.v || saveData.version;
            
            // Vérifier la compatibilité des versions
            const [major, minor] = version.split('.').map(Number);
            if (major !== this.VERSION.MAJOR) {
                throw new Error(`Incompatible network version: ${version}. Current version: ${this.getVersionString()}`);
            }
            
            if (minor > this.VERSION.MINOR) {
                console.warn(`Loading newer minor version (${version}) with current version ${this.getVersionString()}`);
            }

            // Convertir les données compressées en tenseurs
            console.log('🧮 Converting weights to tensors...');
            const weights = (saveData.w || saveData.weights).map((w, i) => {
                console.log(`Layer ${i + 1}: Shape [${w.shape.join(', ')}]`);
                // Convertir explicitement les données en nombres flottants
                const floatData = w.data.map(val => {
                    // Gérer les notations scientifiques et les chaînes de caractères
                    if (typeof val === 'string') {
                        return parseFloat(val);
                    }
                    return val;
                });
                console.log(`  Sample values: [${floatData.slice(0, 3).join(', ')}...]`);
                return tf.tensor(floatData, w.shape, 'float32');
            });
            
            console.log('⚙️ Setting network weights...');
            try {
                await this.setWeights(weights);
                // Vérifier que les poids ont été correctement chargés
                const layerCount = this.policyNetwork.layers.length + this.valueNetwork.layers.length;
                console.log(`✅ Network loaded successfully (${layerCount} layers)`);
                
                // Libérer la mémoire des tenseurs temporaires
                weights.forEach(tensor => tensor.dispose());
                return true;
            } catch (error) {
                // Libérer la mémoire en cas d'erreur
                weights.forEach(tensor => tensor.dispose());
                throw error;
            }
        } catch (error) {
            console.error('❌ Error loading network:', error);
            throw new Error(`Failed to load network: ${error.message}`);
        }
    }

    incrementSelfPlayGames() {
        this.stats.selfPlayGames++;
        this.stats.lastUpdate = new Date().toISOString();
    }

    incrementHumanGames() {
        this.stats.humanGames++;
        this.stats.lastUpdate = new Date().toISOString();
    }

    // Ajoutons une méthode pour vérifier l'état de l'entraînement
    isCurrentlyTraining() {
        return this.isTraining;
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
        const prediction = await this.neuralNetwork.predict(node.state);
        node.actionProbabilities = prediction.policy;

        const legalActions = node.state.getLegalActions();
        for (const action of legalActions) {
            const nextState = node.state.applyAction(action);
            const priorProb = node.actionProbabilities[this.actionToIndex(action)];
            node.children.set(action, new HexaequoAI.MCTSNode(nextState, node, priorProb));
        }
    }

    async evaluate(node) {
        const reward = node.state.getReward(); // Obtenir la récompense (finale ou intermédiaire)
        
        if (node.state.isTerminal()) {
            return reward;
        }
        
        const prediction = await this.neuralNetwork.predict(node.state);
        // Combiner la récompense immédiate avec la prédiction future
        return reward + 0.95 * prediction.value;
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
            gamesPerIteration: 2,    // Nombre de parties par itération
            iterations: 1,            // Nombre d'itérations d'entraînement
            savingFrequency: 1,       // Fréquence de sauvegarde du modèle
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
                const targets = batch.map((state, idx) => {
                    const moveIdx = i + idx;
                    const immediateReward = new HexaequoAI.HexaequoState(
                        state.board, 
                        state.inventory, 
                        state.currentPlayer,
                        this.neuralNetwork.rewardWeights
                    ).getReward();
                    
                    return {
                        policy: this.createPolicyTarget(game.actions[moveIdx]),
                        value: immediateReward + finalReward * Math.pow(0.95, states.length - moveIdx - 1)
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
        console.log('Starting new game for training...');
        this.currentGame = {
            states: [],
            actions: [],
            winner: null
        };
    }

    addMove(state, action) {
        if (this.currentGame && action) {  // Vérifier que action existe
            console.log('Recording move:', action);
            this.currentGame.states.push(JSON.stringify(state));
            this.currentGame.actions.push(action);
        }
    }

    endGame(winner) {
        if (this.currentGame) {
            console.log('Ending game with winner:', winner);
            this.currentGame.winner = winner;
            this.games.push(this.currentGame);
            this.currentGame = null;
        }
    }

    async trainNetwork(neuralNetwork) {
        if (neuralNetwork.isCurrentlyTraining()) {
            console.warn('Network is currently training, skipping this training session');
            return;
        }

        console.log('Starting training on', this.games.length, 'games');
        
        for (const game of this.games) {
            if (neuralNetwork.isCurrentlyTraining()) {
                console.warn('Training interrupted due to concurrent training session');
                break;
            }

            const states = game.states.map(s => JSON.parse(s));
            const finalReward = game.winner === HexaequoAI.PLAYER_BLACK ? 1 : -1;
            
            for (let i = 0; i < states.length; i++) {
                if (neuralNetwork.isCurrentlyTraining()) break;

                const state = states[i];
                const action = game.actions[i];
                
                if (!action) {
                    console.warn('Skipping undefined action at index', i);
                    continue;
                }
                
                const targetValue = finalReward * Math.pow(0.95, states.length - i - 1);
                const policyTarget = new Array(900).fill(0);
                const actionIndex = this.actionToIndex(action);
                if (actionIndex !== null) {
                    policyTarget[actionIndex] = 1;
                }
                
                const result = await neuralNetwork.trainStep([state], [policyTarget], [[targetValue]]);
                if (!result) {
                    console.warn('Training step failed, skipping remaining steps');
                    break;
                }
            }
        }
        
        console.log('Training completed');
    }

    actionToIndex(action) {
        if (!action || !action.type) {
            console.warn('Invalid action:', action);
            return null;
        }

        try {
            let base = 0;
            switch (action.type) {
                case 'place-tile':
                    base = 0;
                    return base + action.row * 10 + action.col;
                case 'place-disc':
                    base = 100;
                    return base + action.row * 10 + action.col;
                case 'place-ring':
                    base = 200;
                    return base + action.row * 10 + action.col;
                case 'move':
                    base = 300;
                    if (!action.from || !action.to) {
                        console.warn('Invalid move action:', action);
                        return null;
                    }
                    return base + action.from.row * 100 + action.from.col * 10 + 
                           action.to.row * 10 + action.to.col;
                default:
                    console.warn('Unknown action type:', action.type);
                    return null;
            }
        } catch (error) {
            console.error('Error in actionToIndex:', error);
            return null;
        }
    }
};

// Export du namespace si nécessaire
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HexaequoAI;
} 