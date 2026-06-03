class GameState {
    constructor() {
        this.tileSize = 16;
        this.resizeGrid(14, 14);

        this.player = { x: 0, y: 0, dir: DIR.RIGHT };

        this.playerForm = 2;
        this.colorTheme = 0;
        this.isInvincible = 0;

        this.gameStatus = 0;
        this.effects = [];
        this.animTick = 0;
        this.currentStageId = "1";
        this.currentLevelKey = "1";

        this.history = [];
        this.stepCount = 0;
        this.replayString = "";
        this.MAX_HISTORY = 100;
        this.initialSnapshot = null;

        this.isReplayMode = false;
        this.replayData = "";
        this.replayIndex = 0;
        this.replayTimer = null;
        this.replaySpeed = 200;

        this.torches = [];
        this.torchBackgroundCells = [];
        this.lightLevel = 0;
        this.viewVector = { dx: 1, dy: 0 };
    }

    resizeGrid(width, height) {
        this.gridWidth = Number.isInteger(width) && width > 0 ? width : 14;
        this.gridHeight = Number.isInteger(height) && height > 0 ? height : 14;
        this.gridSize = this.gridWidth === this.gridHeight ? this.gridWidth : Math.max(this.gridWidth, this.gridHeight);

        this.gridForeground = this.createGrid();
        this.gridBuffer = this.createGrid();
        this.gridBackground = this.createGrid();
        this.gridTexture = this.createGrid();
        this.torches = [];
        this.torchBackgroundCells = [];
    }

    createGrid(fill = 0) {
        return Array.from({ length: this.gridWidth }, () => Array(this.gridHeight).fill(fill));
    }

    inBounds(x, y) {
        return x >= 0 && x < this.gridWidth && y >= 0 && y < this.gridHeight;
    }

    lastX() {
        return this.gridWidth - 1;
    }

    lastY() {
        return this.gridHeight - 1;
    }

    forEachCell(callback) {
        for (let x = 0; x < this.gridWidth; x++) {
            for (let y = 0; y < this.gridHeight; y++) {
                callback(x, y);
            }
        }
    }

    canvasWidth() {
        return this.gridWidth * this.tileSize;
    }

    canvasHeight() {
        return this.gridHeight * this.tileSize;
    }

    drawX(x) {
        return x * this.tileSize;
    }

    drawY(y) {
        return (this.gridHeight - 1 - y) * this.tileSize;
    }

    resetRuntimeStats() {
        this.gameStatus = 0;
        this.isInvincible = 0;
        this.history = [];
        this.stepCount = 0;
        this.replayString = "";
        this.effects = [];
        this.animTick = 0;
        this.lightLevel = 0;
        this.viewVector = { dx: 1, dy: 0 };
    }

    _cloneGrid(grid) {
        return grid.map(col => [...col]);
    }

    _createSnapshotData() {
        return {
            width: this.gridWidth,
            height: this.gridHeight,
            fg: this._cloneGrid(this.gridForeground),
            bg: this._cloneGrid(this.gridBackground),
            player: { ...this.player },
            form: this.playerForm,
            color: this.colorTheme,
            invincible: this.isInvincible,
            status: this.gameStatus,
            steps: this.stepCount,
            replay: this.replayString,
            viewVector: { ...this.viewVector }
        };
    }

    _applySnapshot(snapshot) {
        if (snapshot.width !== this.gridWidth || snapshot.height !== this.gridHeight) {
            this.resizeGrid(snapshot.width || 14, snapshot.height || 14);
        }

        this.gridForeground = this._cloneGrid(snapshot.fg);
        this.gridBackground = this._cloneGrid(snapshot.bg);
        this.gridTexture = this.createGrid();
        this.syncMainToBuffer();

        this.player = { ...snapshot.player };
        this.playerForm = snapshot.form;
        this.colorTheme = snapshot.color;
        this.isInvincible = snapshot.invincible;
        this.gameStatus = snapshot.status;
        this.stepCount = snapshot.steps;
        this.replayString = snapshot.replay;
        this.viewVector = snapshot.viewVector ? { ...snapshot.viewVector } : { dx: 1, dy: 0 };
    }

    syncBufferToMain() {
        this.forEachCell((x, y) => {
            this.gridForeground[x][y] = this.gridBuffer[x][y];
        });
    }

    syncMainToBuffer() {
        this.forEachCell((x, y) => {
            this.gridBuffer[x][y] = this.gridForeground[x][y];
        });
    }

    saveSnapshot() {
        this.history.push(this._createSnapshotData());

        if (this.history.length > this.MAX_HISTORY) {
            this.history.shift();
        }
    }

    recordInitialState() {
        this.initialSnapshot = this._createSnapshotData();
        this.history = [];
    }

    resetGame() {
        if (!this.initialSnapshot) return;

        this._applySnapshot(this.initialSnapshot);
        this.stepCount = 0;
        this.replayString = "";
        this.effects = [];
        this.animTick = 0;
        this.lightLevel = 0;
        this.history = [this._createSnapshotData()];
    }

    restoreSnapshot() {
        if (this.history.length === 0) return false;

        const snapshot = this.history.pop();
        this._applySnapshot(snapshot);
        this.effects = [];

        return true;
    }
}
