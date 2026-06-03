(() => {
    "use strict";

    const MIN_WIDTH = 4;
    const MAX_WIDTH = 40;
    const MIN_HEIGHT = 4;
    const MAX_HEIGHT = 30;
    const META_CHUNK_KEY = "bugma-level-json";
    const EDITOR_VERSION = "1.0.0";
    const EDITOR_PALETTE_TOKENS = new Set([
        "__", "||",
        "h1", "h2", "h3", "l1", "l2", "l3", "r1", "r2", "r3", "hm",
        "e1", "e2", "e3", "e4", "e5", "e6", "g1", "g2", "g3", "g4", "g5", "g6",
        "cs", "ce", "c1", "c2", "c3", "c4", "c6"
    ]);
    const HEROINE_BRUSHES = Object.freeze([
        { brush: "hero1", token: "he", mode: 1, label: "Shirley" },
        { brush: "hero2", token: "he", mode: 2, label: "Ella" }
    ]);
    const COLOR_CHOICES = Object.freeze([
        { value: null, label: "Auto", swatch: "auto" },
        { value: 0, label: "Gray", swatch: "#9ca3a6" },
        { value: 1, label: "Blue", swatch: "#4b8ed8" },
        { value: 2, label: "Red", swatch: "#d95757" },
        { value: 3, label: "Green", swatch: "#5faf68" },
        { value: 4, label: "Yellow", swatch: "#d2b45b" },
        { value: 6, label: "Purple", swatch: "#b070ce" }
    ]);

    // C# custom format: JS token → 3-character token
    const CS_EXPORT_MAP = Object.freeze({
        "__": "___", "||": "|||",
        "h1": "_1_", "h2": "_2_", "h3": "_3_",
        "l1": "1__", "l2": "2__", "l3": "3__",
        "r1": "__1", "r2": "__2", "r3": "__3",
        "hm": "_B_",
        "e1": "Gob", "e2": "Thi", "e3": "Ten", "e4": "Sha", "e5": "Hyp", "e6": "Gol",
        "g1": "GBl", "g2": "GRe", "g3": "GGr", "g4": "GYe", "g5": "GPu", "g6": "GPu",
        "cs": "ChS", "ce": "ChE",
        "c1": "ChB", "c2": "ChR", "c3": "ChG", "c4": "ChY", "c6": "ChP"
    });

    // C# custom format: 3-character token → JS token
    const CS_IMPORT_MAP = Object.freeze({
        "___": "__", "|||": "||",
        "_1_": "h1", "_2_": "h2", "_3_": "h3",
        "1__": "l1", "2__": "l2", "3__": "l3",
        "__1": "r1", "__2": "r2", "__3": "r3",
        "_B_": "hm",
        "Gob": "e1", "Thi": "e2", "Ten": "e3", "Sha": "e4", "Hyp": "e5", "Gol": "e6",
        "GBl": "g1", "GRe": "g2", "GGr": "g3", "GYe": "g4", "GPu": "g5",
        "ChS": "cs", "ChE": "ce",
        "ChB": "c1", "ChR": "c2", "ChG": "c3", "ChY": "c4", "ChP": "c6"
    });

    const CS_COLOR_NAMES = Object.freeze({
        0: " ", 1: "Blue", 2: "Red", 3: "Green", 4: "Yellow", 6: "Purple"
    });

    const CS_COLOR_FROM_NAME = Object.freeze({
        "Blue": 1, "Red": 2, "Green": 3, "Yellow": 4, "Purple": 6
    });
    const COLOR_THEME_CHAMELEON_SUBSTITUTE = Object.freeze({
        1: "g1",
        2: "g2",
        3: "g3",
        4: "g4",
        6: "g5"
    });
    const CATEGORY_ORDER = [
        "Terrain",
        "Hearts",
        "Enemies",
        "Floors"
    ];

    const $ = (id) => document.getElementById(id);
    const textEncoder = new TextEncoder();
    const textDecoder = new TextDecoder();

    function clampInt(value, min, max, fallback) {
        const number = Number(value);
        if (!Number.isInteger(number)) return fallback;
        return Math.max(min, Math.min(max, number));
    }

    function safeId(value) {
        const cleaned = String(value || "untitled")
            .trim()
            .replace(/[^A-Za-z0-9_.-]+/g, "-")
            .replace(/^-+|-+$/g, "");
        return cleaned || "untitled";
    }

    function makeMatrix(width, height, value) {
        return Array.from({ length: width }, () => Array(height).fill(value));
    }

    function makeRectMap(width, height, placements) {
        const map = Array.from({ length: width * height }, (_, index) => {
            const x = index % width;
            const y = Math.floor(index / width);
            return x === 0 || y === 0 || x === width - 1 || y === height - 1 ? "||" : "__";
        });

        placements.forEach(([x, y, token]) => {
            if (x >= 0 && y >= 0 && x < width && y < height) {
                map[y * width + x] = token;
            }
        });

        return map;
    }

    function makeTemplate(id, name, width, height, color, mode, placements) {
        return {
            id,
            name,
            author: "",
            notes: "",
            width,
            height,
            hasColor: color !== undefined && color !== null,
            color,
            mode,
            map: makeRectMap(width, height, placements)
        };
    }

    function previewColor(level) {
        return level.hasColor ? clampInt(level.color, 0, 6, 0) : 0;
    }

    const TEMPLATES = {
        standard14: () => makeTemplate("example-14x14", "Standard 14x14", 14, 14, null, 2, [
            [2, 11, "he"], [4, 11, "h1"], [5, 10, "h2"], [6, 9, "h3"],
            [9, 10, "e1"], [10, 9, "g1"], [7, 5, "||"], [8, 5, "||"],
            [7, 6, "||"], [8, 6, "||"], [3, 8, "ce"], [11, 8, "c2"]
        ]),
        small10x8: () => makeTemplate("example-10x8", "Small 10x8", 10, 8, 1, 2, [
            [1, 6, "he"], [3, 6, "h1"], [4, 5, "h2"], [6, 4, "e1"],
            [5, 2, "||"], [6, 2, "||"], [7, 2, "||"], [8, 5, "c2"]
        ]),
        wide20x14: () => makeTemplate("example-20x14", "Wide 20x14", 20, 14, 3, 1, [
            [1, 12, "he"], [3, 12, "h1"], [4, 11, "h2"], [6, 10, "h3"],
            [8, 9, "e1"], [10, 9, "e2"], [12, 8, "g1"], [15, 11, "ce"],
            [5, 4, "||"], [5, 5, "||"], [5, 6, "||"], [8, 4, "||"],
            [8, 5, "||"], [13, 3, "||"], [14, 3, "||"], [15, 3, "||"]
        ]),
        large24x16: () => makeTemplate("example-24x16", "Large 24x16", 24, 16, 6, 2, [
            [1, 14, "he"], [3, 14, "h1"], [4, 13, "h2"], [5, 12, "h3"],
            [8, 12, "e1"], [10, 11, "e3"], [12, 10, "g4"], [15, 9, "hm"],
            [18, 12, "c6"], [20, 13, "ce"], [6, 4, "||"], [6, 5, "||"],
            [6, 6, "||"], [9, 4, "||"], [9, 5, "||"], [14, 5, "||"],
            [15, 5, "||"], [16, 5, "||"], [17, 5, "||"]
        ])
    };

    class ValidationGameState {
        resizeGrid(width, height) {
            this.gridWidth = width;
            this.gridHeight = height;
            this.gridForeground = makeMatrix(width, height, 0);
            this.gridBackground = makeMatrix(width, height, 0);
            this.gridBuffer = makeMatrix(width, height, 0);
            this.gridTexture = makeMatrix(width, height, 0);
        }

        resetRuntimeStats() { }

        syncMainToBuffer() { }

        forEachCell(callback) {
            for (let x = 0; x < this.gridWidth; x++) {
                for (let y = 0; y < this.gridHeight; y++) {
                    callback(x, y);
                }
            }
        }
    }

    class EditorApp {
        constructor() {
            this.canvas = $("editor-canvas");
            this.ctx = this.canvas.getContext("2d");
            this.lightCanvas = document.createElement("canvas");
            this.lightCtx = this.lightCanvas.getContext("2d");
            this.images = {};
            this.imagesReady = false;
            this.level = TEMPLATES.standard14();
            this.selectedToken = "||";
            this.tool = "paint";
            this.hoverCell = null;
            this.dragStart = null;
            this.dragEnd = null;
            this.isPointerDown = false;
            this.pendingEdit = false;
            this.history = [];
            this.redoStack = [];
            this.tick = 0;
            this.lastTickTime = 0;
            this.lastExportFormat = "json";

            this.bindUI();
            this.syncForm();
            this.renderHeroinePalette();
            this.renderColorPalette();
            this.renderPalette();
            this.resetHistory();
            this.refresh();
            this.loadImages();
            requestAnimationFrame((time) => this.frame(time));
        }

        bindUI() {
            document.querySelectorAll("[data-template]").forEach((button) => {
                button.addEventListener("click", () => this.loadTemplate(button.dataset.template));
            });

            document.querySelectorAll("[data-tool]").forEach((button) => {
                button.addEventListener("click", () => this.selectTool(button.dataset.tool));
            });

            document.querySelectorAll("[data-export]").forEach((button) => {
                button.addEventListener("click", () => {
                    this.updateExport(button.dataset.export);
                    if (button.dataset.export === "png") {
                        this.downloadPng({ autoClick: false });
                    }
                });
            });

            $("undo-button").addEventListener("click", () => this.undo());
            $("redo-button").addEventListener("click", () => this.redo());
            $("apply-size").addEventListener("click", () => this.applySize());
            $("copy-output").addEventListener("click", () => this.copyOutput());
            $("download-output").addEventListener("click", () => this.downloadOutput());
            $("import-file").addEventListener("change", (event) => this.importFile(event));
            $("import-input-button").addEventListener("click", () => this.importText($("import-input").value));

            ["level-id", "level-name", "level-author", "level-notes"].forEach((id) => {
                $(id).addEventListener("input", () => {
                    const key = id.replace("level-", "");
                    this.level[key] = $(id).value;
                    this.refresh();
                });
            });

            this.canvas.addEventListener("pointerdown", (event) => this.onPointerDown(event));
            this.canvas.addEventListener("pointermove", (event) => this.onPointerMove(event));
            this.canvas.addEventListener("pointerup", (event) => this.onPointerUp(event));
            this.canvas.addEventListener("pointerleave", () => {
                this.hoverCell = null;
                this.isPointerDown = false;
                this.dragStart = null;
                this.dragEnd = null;
                this.updateStatus();
                this.draw();
            });
        }

        async loadImages() {
            const entries = Object.entries(IMAGES);
            await Promise.all(entries.map(([key, src]) => new Promise((resolve) => {
                const img = new Image();
                img.onload = resolve;
                img.onerror = resolve;
                img.src = src.startsWith("assets/") ? `../${src}` : src;
                this.images[key] = img;
                this.images[src] = img;
            })));
            this.imagesReady = true;
            this.renderHeroinePalette();
            this.renderColorPalette();
            this.renderPalette();
            this.draw();
        }

        frame(time) {
            const nextTick = Math.floor(time / (1000 / 60)) % 60;
            if (nextTick !== this.tick) {
                this.tick = nextTick;
                this.lastTickTime = time;
                this.draw();
            }
            requestAnimationFrame((nextTime) => this.frame(nextTime));
        }

        loadTemplate(name) {
            const factory = TEMPLATES[name] || TEMPLATES.standard14;
            this.level = factory();
            this.syncForm();
            this.renderHeroinePalette();
            this.renderColorPalette();
            this.renderPalette();
            this.resetHistory();
            this.setStatus(`Loaded ${this.level.width}x${this.level.height}`);
            this.refresh();
        }

        syncForm() {
            $("level-id").value = this.level.id || "";
            $("level-name").value = this.level.name || "";
            $("level-author").value = this.level.author || "";
            $("level-notes").value = this.level.notes || "";
            $("level-width").value = String(this.level.width);
            $("level-height").value = String(this.level.height);
        }

        resetHistory() {
            this.history = [this.snapshot()];
            this.redoStack = [];
            this.updateHistoryButtons();
        }

        snapshot() {
            return JSON.stringify({
                id: this.level.id,
                name: this.level.name,
                author: this.level.author,
                notes: this.level.notes,
                width: this.level.width,
                height: this.level.height,
                hasColor: this.level.hasColor,
                color: this.level.color,
                mode: this.level.mode,
                map: this.level.map
            });
        }

        pushHistory() {
            const snap = this.snapshot();
            if (this.history[this.history.length - 1] !== snap) {
                this.history.push(snap);
                if (this.history.length > 80) this.history.shift();
            }
            this.redoStack = [];
            this.updateHistoryButtons();
        }

        restoreSnapshot(snap) {
            const level = JSON.parse(snap);
            this.level = {
                hasColor: level.hasColor !== undefined ? level.hasColor : level.color !== undefined,
                ...level,
                map: level.map.slice()
            };
            this.syncForm();
            this.renderHeroinePalette();
            this.renderColorPalette();
            this.renderPalette();
            this.refresh();
            this.updateHistoryButtons();
        }

        undo() {
            if (this.history.length <= 1) return;
            this.redoStack.push(this.history.pop());
            this.restoreSnapshot(this.history[this.history.length - 1]);
            this.setStatus("Undo");
        }

        redo() {
            if (!this.redoStack.length) return;
            const snap = this.redoStack.pop();
            this.history.push(snap);
            this.restoreSnapshot(snap);
            this.setStatus("Redo");
        }

        updateHistoryButtons() {
            $("undo-button").disabled = this.history.length <= 1;
            $("redo-button").disabled = this.redoStack.length === 0;
        }

        selectTool(tool) {
            this.tool = tool;
            document.querySelectorAll("[data-tool]").forEach((button) => {
                button.classList.toggle("active", button.dataset.tool === tool);
            });
            this.setStatus(`Tool: ${tool}`);
        }

        renderHeroinePalette() {
            const palette = $("heroine-palette");
            palette.textContent = "";

            HEROINE_BRUSHES.forEach((brush) => {
                const button = document.createElement("button");
                button.type = "button";
                button.className = "heroine-token";
                button.dataset.token = brush.brush;
                button.title = `${brush.label} - places the player and exports mode ${brush.mode}`;

                const icon = document.createElement("canvas");
                icon.width = TILE_SIZE;
                icon.height = TILE_SIZE;
                const iconCtx = icon.getContext("2d");
                iconCtx.imageSmoothingEnabled = false;
                this.drawTokenIcon(iconCtx, "he", brush.mode);

                const label = document.createElement("span");
                label.textContent = brush.label;

                button.appendChild(icon);
                button.appendChild(label);
                button.classList.toggle("active", this.selectedToken === brush.brush || this.level.mode === brush.mode && this.selectedToken === "he");
                button.addEventListener("click", () => this.selectToken(brush.brush));
                palette.appendChild(button);
            });
        }

        renderColorPalette() {
            const palette = $("color-palette");
            palette.textContent = "";

            COLOR_CHOICES.forEach((choice) => {
                const button = document.createElement("button");
                button.type = "button";
                button.className = "color-swatch";
                button.dataset.color = choice.value === null ? "auto" : String(choice.value);
                button.title = choice.value === null ? "Auto theme - omit color from exports" : `${choice.value} ${choice.label}`;
                button.style.setProperty("--swatch", choice.swatch);
                button.classList.toggle("auto-swatch", choice.value === null);
                button.classList.toggle("active", choice.value === null ? !this.level.hasColor : this.level.hasColor && previewColor(this.level) === choice.value);
                button.addEventListener("click", () => this.selectColor(choice.value));
                palette.appendChild(button);
            });
        }

        selectColor(value) {
            this.level.hasColor = value !== null;
            this.level.color = value === null ? 0 : clampInt(value, 0, 6, 0);

            if (this.isTokenConvertedByTheme(this.selectedBrushToken())) {
                this.selectedToken = "e6";
            }

            this.renderColorPalette();
            this.renderPalette();
            this.refresh();
            this.setStatus(value === null ? "Theme: Auto" : `Theme: ${value}`);
        }

        renderPalette() {
            const palette = $("palette");
            palette.textContent = "";

            CATEGORY_ORDER.forEach((category) => {
                const defs = LEVEL_TOKEN_DEFS.filter((def) => {
                    return def.category === category
                        && def.palette !== false
                        && EDITOR_PALETTE_TOKENS.has(def.token);
                });
                if (!defs.length) return;

                const group = document.createElement("div");
                group.className = "palette-group";

                const heading = document.createElement("div");
                heading.className = "palette-heading";
                heading.textContent = category;
                group.appendChild(heading);

                const items = document.createElement("div");
                items.className = "palette-items";

                defs.forEach((def) => {
                    const convertedByTheme = this.isTokenConvertedByTheme(def.token);
                    const button = document.createElement("button");
                    button.type = "button";
                    button.className = "palette-token";
                    button.title = convertedByTheme
                        ? `${def.token} - original generator substitutes e6 for this theme`
                        : `${def.token} - ${def.label}`;
                    button.dataset.token = def.token;
                    button.disabled = convertedByTheme;

                    const icon = document.createElement("canvas");
                    icon.width = TILE_SIZE;
                    icon.height = TILE_SIZE;
                    const iconCtx = icon.getContext("2d");
                    iconCtx.imageSmoothingEnabled = false;
                    this.drawTokenIcon(iconCtx, def.token);

                    const label = document.createElement("span");
                    label.textContent = def.token;

                    button.appendChild(icon);
                    button.appendChild(label);
                    button.classList.toggle("active", def.token === this.selectedBrushToken());
                    button.classList.toggle("disabled-token", convertedByTheme);
                    button.addEventListener("click", () => this.selectToken(def.token));
                    items.appendChild(button);
                });

                group.appendChild(items);
                palette.appendChild(group);
            });
        }

        selectToken(token) {
            let heroBrush = HEROINE_BRUSHES.find((brush) => brush.brush === token);
            if (!heroBrush && (token === "he" || token === "HE")) {
                heroBrush = this.currentHeroBrush();
            }
            const nextToken = heroBrush ? heroBrush.token : token;

            if (heroBrush) {
                this.level.mode = heroBrush.mode;
            }

            if (!heroBrush && !LEVEL_TOKEN_MAP[nextToken]) return;
            if (this.isTokenConvertedByTheme(heroBrush ? heroBrush.token : nextToken)) {
                this.setStatus(`${nextToken} becomes e6 in this theme`);
                return;
            }
            this.selectedToken = heroBrush ? heroBrush.brush : nextToken === "HE" ? "he" : nextToken;
            $("selected-token").textContent = this.selectedLabel();
            document.querySelectorAll(".palette-token").forEach((button) => {
                button.classList.toggle("active", button.dataset.token === this.selectedBrushToken());
            });
            document.querySelectorAll(".heroine-token").forEach((button) => {
                button.classList.toggle("active", button.dataset.token === this.selectedToken);
            });
            if (this.tool === "erase") this.selectTool("paint");
            this.renderHeroinePalette();
            this.refresh();
            this.setStatus(`Token: ${this.selectedLabel()}`);
        }

        currentHeroBrush() {
            return HEROINE_BRUSHES.find((brush) => brush.mode === this.level.mode) || HEROINE_BRUSHES[1];
        }

        selectedBrushToken() {
            const brush = HEROINE_BRUSHES.find((item) => item.brush === this.selectedToken);
            return brush ? brush.token : this.selectedToken;
        }

        selectedBrushMode() {
            const brush = HEROINE_BRUSHES.find((item) => item.brush === this.selectedToken);
            return brush ? brush.mode : null;
        }

        selectedLabel() {
            const brush = HEROINE_BRUSHES.find((item) => item.brush === this.selectedToken);
            return brush ? brush.label : this.selectedToken;
        }

        isTokenConvertedByTheme(token) {
            if (!this.level.hasColor) return false;
            return COLOR_THEME_CHAMELEON_SUBSTITUTE[previewColor(this.level)] === token;
        }

        refresh() {
            this.updateStatus();
            this.updateValidation();
            this.updateExport(this.lastExportFormat);
            this.draw();
        }

        updateStatus() {
            $("status-size").textContent = `${this.level.width} x ${this.level.height}`;
            if (!this.hoverCell) {
                $("status-cell").textContent = "Cell: --";
                return;
            }
            const token = this.getToken(this.hoverCell.x, this.hoverCell.y);
            $("status-cell").textContent = `Cell: ${this.hoverCell.x},${this.hoverCell.y} ${token}`;
        }

        setStatus(message) {
            $("status-message").textContent = message;
        }

        applySize() {
            const nextWidth = clampInt($("level-width").value, MIN_WIDTH, MAX_WIDTH, this.level.width);
            const nextHeight = clampInt($("level-height").value, MIN_HEIGHT, MAX_HEIGHT, this.level.height);
            if (nextWidth === this.level.width && nextHeight === this.level.height) return;

            const old = this.level;
            const nextMap = makeRectMap(nextWidth, nextHeight, []);
            for (let y = 0; y < Math.min(old.height, nextHeight); y++) {
                for (let x = 0; x < Math.min(old.width, nextWidth); x++) {
                    nextMap[y * nextWidth + x] = old.map[y * old.width + x];
                }
            }
            this.level.width = nextWidth;
            this.level.height = nextHeight;
            this.level.map = nextMap;
            this.ensureSinglePlayer();
            this.pushHistory();
            this.syncForm();
            this.setStatus(`Resized ${nextWidth}x${nextHeight}`);
            this.refresh();
        }

        eventToCell(event) {
            const rect = this.canvas.getBoundingClientRect();
            const x = Math.floor(((event.clientX - rect.left) / rect.width) * this.level.width);
            const y = Math.floor(((event.clientY - rect.top) / rect.height) * this.level.height);
            if (x < 0 || y < 0 || x >= this.level.width || y >= this.level.height) return null;
            return { x, y };
        }

        onPointerDown(event) {
            const cell = this.eventToCell(event);
            if (!cell) return;
            event.preventDefault();
            this.canvas.setPointerCapture(event.pointerId);
            this.hoverCell = cell;
            this.isPointerDown = true;

            if (this.tool === "pick") {
                this.selectToken(this.getToken(cell.x, cell.y));
                this.isPointerDown = false;
                return;
            }

            if (this.tool === "fill") {
                this.applySelectedMode();
                this.floodFill(cell.x, cell.y, this.selectedBrushToken());
                this.pushHistory();
                this.refresh();
                return;
            }

            if (this.tool === "rect") {
                this.dragStart = cell;
                this.dragEnd = cell;
                this.draw();
                return;
            }

            this.applySelectedMode();
            this.pendingEdit = this.paintCell(cell.x, cell.y, this.tool === "erase" ? "__" : this.selectedBrushToken());
            this.refresh();
        }

        onPointerMove(event) {
            const cell = this.eventToCell(event);
            this.hoverCell = cell;
            this.updateStatus();
            if (!cell) {
                this.draw();
                return;
            }

            if (this.isPointerDown && this.tool === "rect") {
                this.dragEnd = cell;
                this.draw();
                return;
            }

            if (this.isPointerDown && (this.tool === "paint" || this.tool === "erase")) {
                this.applySelectedMode();
                const token = this.tool === "erase" ? "__" : this.selectedBrushToken();
                if (this.paintCell(cell.x, cell.y, token)) {
                    this.pendingEdit = true;
                    this.refresh();
                }
                return;
            }

            this.draw();
        }

        onPointerUp(event) {
            if (!this.isPointerDown) return;
            this.isPointerDown = false;

            if (this.tool === "rect" && this.dragStart && this.dragEnd) {
                this.applySelectedMode();
                this.fillRect(this.dragStart, this.dragEnd, this.selectedBrushToken());
                this.pushHistory();
            } else if (this.pendingEdit) {
                this.pushHistory();
            }

            this.dragStart = null;
            this.dragEnd = null;
            this.pendingEdit = false;
            if (event.pointerId !== undefined) this.canvas.releasePointerCapture(event.pointerId);
            this.refresh();
        }

        getToken(x, y) {
            return this.level.map[y * this.level.width + x] || "__";
        }

        applySelectedMode() {
            const mode = this.selectedBrushMode();
            if (mode) {
                this.level.mode = mode;
                this.renderHeroinePalette();
            }
        }

        setToken(x, y, token) {
            const index = y * this.level.width + x;
            const next = token === "HE" ? "he" : token;
            if (next === "he") {
                this.level.map = this.level.map.map((value, i) => (i === index ? value : value === "he" || value === "HE" ? "__" : value));
            }
            this.level.map[index] = next;
        }

        paintCell(x, y, token) {
            const current = this.getToken(x, y);
            const next = token === "HE" ? "he" : token;
            if (current === next) return false;
            this.setToken(x, y, next);
            return true;
        }

        floodFill(x, y, token) {
            const target = this.getToken(x, y);
            const next = token === "HE" ? "he" : token;
            if (target === next) return;

            const queue = [[x, y]];
            const seen = new Set();
            while (queue.length) {
                const [cx, cy] = queue.shift();
                const key = `${cx},${cy}`;
                if (seen.has(key)) continue;
                seen.add(key);
                if (cx < 0 || cy < 0 || cx >= this.level.width || cy >= this.level.height) continue;
                if (this.getToken(cx, cy) !== target) continue;
                this.setToken(cx, cy, next);
                queue.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
            }
        }

        fillRect(start, end, token) {
            const minX = Math.min(start.x, end.x);
            const maxX = Math.max(start.x, end.x);
            const minY = Math.min(start.y, end.y);
            const maxY = Math.max(start.y, end.y);

            for (let y = minY; y <= maxY; y++) {
                for (let x = minX; x <= maxX; x++) {
                    this.setToken(x, y, token);
                }
            }
        }

        ensureSinglePlayer() {
            const playerIndexes = [];
            this.level.map.forEach((token, index) => {
                if (token === "he" || token === "HE") playerIndexes.push(index);
            });

            if (playerIndexes.length === 0 && this.level.width > 2 && this.level.height > 2) {
                this.level.map[(this.level.height - 2) * this.level.width + 1] = "he";
                return;
            }

            playerIndexes.slice(1).forEach((index) => {
                this.level.map[index] = "__";
            });
            if (playerIndexes.length) this.level.map[playerIndexes[0]] = "he";
        }

        buildPreviewState() {
            const width = this.level.width;
            const height = this.level.height;
            const state = {
                gridWidth: width,
                gridHeight: height,
                colorTheme: previewColor(this.level),
                playerForm: this.level.mode || 2,
                player: { x: 1, y: 1, dir: DIR.RIGHT },
                gameStatus: 0,
                lightLevel: 0.7,
                viewVector: { dx: 1, dy: 0 },
                gridForeground: makeMatrix(width, height, 0),
                gridBackground: makeMatrix(width, height, 0),
                gridTexture: makeMatrix(width, height, 0),
                torches: [],
                torchBackgroundCells: [],
                inBounds(x, y) {
                    return x >= 0 && y >= 0 && x < this.gridWidth && y < this.gridHeight;
                },
                lastX() {
                    return this.gridWidth - 1;
                },
                lastY() {
                    return this.gridHeight - 1;
                },
                forEachCell(callback) {
                    for (let x = 0; x < this.gridWidth; x++) {
                        for (let y = 0; y < this.gridHeight; y++) {
                            callback(x, y);
                        }
                    }
                },
                drawX(x) {
                    return x * TILE_SIZE;
                },
                drawY(y) {
                    return (this.gridHeight - 1 - y) * TILE_SIZE;
                }
            };

            for (let row = 0; row < height; row++) {
                for (let col = 0; col < width; col++) {
                    const token = this.level.map[row * width + col] || "__";
                    const def = LEVEL_TOKEN_MAP[token] || LEVEL_TOKEN_MAP.__;
                    const targetY = height - 1 - row;
                    if (def.fg !== undefined) state.gridForeground[col][targetY] = def.fg;
                    if (def.bg !== undefined) state.gridBackground[col][targetY] = def.bg;
                    if (def.fg === 1) state.player = { x: col, y: targetY, dir: DIR.RIGHT };
                }
            }

            if (typeof VisualLogic !== "undefined") {
                new VisualLogic(state).updateAutoTiling();
            }

            return state;
        }

        draw() {
            const width = this.level.width * TILE_SIZE;
            const height = this.level.height * TILE_SIZE;
            if (this.canvas.width !== width) this.canvas.width = width;
            if (this.canvas.height !== height) this.canvas.height = height;
            this.canvas.style.setProperty("--board-ratio", String(this.level.width / this.level.height));
            this.ctx.imageSmoothingEnabled = false;

            const state = this.buildPreviewState();
            this.drawLevel(this.ctx, state, { grid: true, lighting: true, overlays: true });
        }

        drawLevel(ctx, state, options) {
            const width = state.gridWidth * TILE_SIZE;
            const height = state.gridHeight * TILE_SIZE;
            ctx.clearRect(0, 0, width, height);
            this.drawBackground(ctx, width, height, state.colorTheme);

            state.forEachCell((x, y) => {
                const drawX = state.drawX(x);
                const drawY = state.drawY(y);
                this.drawBackgroundTile(ctx, state.gridBackground[x][y], drawX, drawY, state.colorTheme);
            });

            state.forEachCell((x, y) => {
                this.drawForegroundTile(ctx, state, x, y, state.drawX(x), state.drawY(y), this.tick);
            });

            if (options.lighting) {
                this.drawLighting(ctx, state);
                this.drawTorches(ctx, state);
            }

            if (options.grid) this.drawGrid(ctx, state.gridWidth, state.gridHeight);
            if (options.overlays) this.drawInteractionOverlay(ctx);
        }

        drawBackground(ctx, width, height, colorTheme) {
            const key = colorTheme === 0 ? "assets/yuka.png" : `assets/yuka${colorTheme}.png`;
            const img = this.images[key] || this.images["assets/yuka.png"];
            if (!img || !img.naturalWidth) {
                ctx.fillStyle = "#222";
                ctx.fillRect(0, 0, width, height);
                return;
            }

            for (let y = 0; y < height; y += img.height) {
                for (let x = 0; x < width; x += img.width) {
                    ctx.drawImage(img, x, y);
                }
            }
        }

        drawTokenIcon(ctx, token, mode = this.level.mode || 2) {
            ctx.clearRect(0, 0, TILE_SIZE, TILE_SIZE);
            ctx.fillStyle = "#24272d";
            ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
            const def = LEVEL_TOKEN_MAP[token] || LEVEL_TOKEN_MAP.__;
            if (def.bg !== undefined) this.drawBackgroundTile(ctx, def.bg, 0, 0, 0);
            if (def.fg !== undefined) {
                const state = {
                    colorTheme: previewColor(this.level),
                    playerForm: mode,
                    player: { dir: DIR.RIGHT },
                    gridForeground: [[def.fg]],
                    gridBackground: [[def.bg || 0]],
                    gridTexture: [[0]]
                };
                this.drawForegroundTile(ctx, state, 0, 0, 0, 0, this.tick);
            }
        }

        drawBackgroundTile(ctx, bgId, drawX, drawY, colorTheme) {
            if (bgId === 2 || bgId === 3) {
                this.drawSprite(ctx, SPRITE_CONFIG.TRIGGERS.getSprite(bgId, colorTheme), drawX, drawY);
            } else if (bgId >= 11 && bgId <= 16) {
                this.drawSprite(ctx, SPRITE_CONFIG.COLOR_TRIGGERS.getSprite(bgId), drawX, drawY);
            } else if (bgId === 999) {
                ctx.save();
                ctx.globalAlpha = 0.25;
                ctx.fillStyle = "#000";
                ctx.fillRect(drawX, drawY, TILE_SIZE, TILE_SIZE);
                ctx.restore();
            }
        }

        drawForegroundTile(ctx, state, x, y, drawX, drawY, tick) {
            const id = state.gridForeground[x][y];
            if (id === 0) return;

            if (id === 2 || id === 7 || id === 8) {
                const moyou = state.gridTexture[x][y] || 0;
                this.drawSprite(ctx, SPRITE_CONFIG.WALLS.getSprite(state.colorTheme, moyou), drawX, drawY);
                if (id === 8) {
                    const bgId = state.gridBackground[x][y];
                    if (bgId > 0 && bgId < 200) {
                        this.drawSprite(ctx, SPRITE_CONFIG.HEARTS.getSprite(bgId, tick), drawX, drawY);
                    }
                }
            } else if (id >= 400) {
                let lockColor = state.colorTheme;
                if (id >= 401 && id <= 405) lockColor = id - 400;
                else if (id === 416 || id === 419) lockColor = 6;
                this.drawSprite(ctx, SPRITE_CONFIG.WALLS.getSprite(lockColor, 26), drawX, drawY);
            } else if (id === 1) {
                this.drawSprite(ctx, SPRITE_CONFIG.HEROINE.getSprite(state.playerForm, DIR.RIGHT, tick), drawX, drawY);
            } else if (id >= 11 && id <= 26) {
                if (id === 16 || (id >= 21 && id <= 26)) {
                    this.drawSprite(ctx, SPRITE_CONFIG.ENEMIES.COLOR.getSprite(id, state.colorTheme, tick), drawX, drawY);
                } else if (id === 18) {
                    this.drawSprite(ctx, SPRITE_CONFIG.ENEMIES.COLOR.getSprite(25, state.colorTheme, tick), drawX, drawY);
                } else if (id === 17) {
                    this.drawSprite(ctx, SPRITE_CONFIG.ENEMIES.COLOR.getSprite(16, state.colorTheme, tick), drawX, drawY);
                } else {
                    this.drawSprite(ctx, SPRITE_CONFIG.ENEMIES.SIMPLE.getSprite(id, tick), drawX, drawY);
                }
            } else if (id >= 100 && id <= 131) {
                this.drawSprite(ctx, SPRITE_CONFIG.HEARTS.getSprite(id, tick), drawX, drawY);
            } else if (id === 3) {
                this.drawSprite(ctx, SPRITE_CONFIG.TRIGGERS.getSprite(id, state.colorTheme), drawX, drawY);
            }
        }

        drawSprite(ctx, conf, x, y) {
            if (!conf) return;
            const img = this.images[conf.img];
            if (!img || !img.naturalWidth) return;
            ctx.drawImage(img, conf.x, conf.y, TILE_SIZE, TILE_SIZE, x, y, TILE_SIZE, TILE_SIZE);
        }

        drawLighting(ctx, state) {
            const width = state.gridWidth * TILE_SIZE;
            const height = state.gridHeight * TILE_SIZE;
            if (this.lightCanvas.width !== width) this.lightCanvas.width = width;
            if (this.lightCanvas.height !== height) this.lightCanvas.height = height;

            const lightCtx = this.lightCtx;
            lightCtx.clearRect(0, 0, width, height);
            lightCtx.fillStyle = "rgba(0, 0, 0, 0.22)";
            lightCtx.fillRect(0, 0, width, height);

            lightCtx.save();
            lightCtx.globalCompositeOperation = "destination-out";
            const center = {
                x: state.drawX(state.player.x) + TILE_SIZE / 2,
                y: state.drawY(state.player.y) + TILE_SIZE / 2
            };
            this.drawLightHole(lightCtx, center.x, center.y, TILE_SIZE * 4.6, 0.62);
            lightCtx.save();
            lightCtx.translate(center.x + TILE_SIZE * 2, center.y);
            lightCtx.scale(1.65, 0.55);
            this.drawLightHole(lightCtx, 0, 0, TILE_SIZE * 4.7, 0.42);
            lightCtx.restore();

            state.torches.forEach((torch, index) => {
                const cx = state.drawX(torch.x) + TILE_SIZE / 2;
                const cy = state.drawY(torch.y) + TILE_SIZE / 2;
                const pulse = 1 + Math.sin(this.tick / 7 + index) * 0.02;
                this.drawLightHole(lightCtx, cx, cy, TILE_SIZE * 3.45 * pulse, 0.58);
            });
            lightCtx.restore();

            ctx.drawImage(this.lightCanvas, 0, 0);

            ctx.save();
            ctx.globalCompositeOperation = "screen";
            state.torches.forEach((torch, index) => {
                const cx = state.drawX(torch.x) + TILE_SIZE / 2;
                const cy = state.drawY(torch.y) + TILE_SIZE / 2;
                const pulse = 1 + Math.sin(this.tick / 8 + index) * 0.025;
                const radius = TILE_SIZE * 2.8 * pulse;
                const gradient = ctx.createRadialGradient(cx, cy, 2, cx, cy, radius);
                gradient.addColorStop(0, "rgba(255, 220, 140, 0.16)");
                gradient.addColorStop(0.5, "rgba(255, 150, 70, 0.06)");
                gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
                ctx.fillStyle = gradient;
                ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
            });
            ctx.restore();
        }

        drawLightHole(ctx, x, y, radius, strength) {
            const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
            gradient.addColorStop(0, `rgba(0, 0, 0, ${strength})`);
            gradient.addColorStop(0.55, `rgba(0, 0, 0, ${strength * 0.45})`);
            gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
            ctx.fillStyle = gradient;
            ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
        }

        drawTorches(ctx, state) {
            state.torches.forEach((torch, index) => {
                const x = state.drawX(torch.x);
                const y = state.drawY(torch.y);
                const phase = Math.floor(this.tick / 8) % 3;
                const wobble = torch.side === "right" ? [1, 0, -1] : [-1, 0, 1];
                this.drawTorch(ctx, x, y, wobble[(phase + index) % 3], state.colorTheme);
            });
        }

        drawTorch(ctx, x, y, flameOffsetX, colorTheme) {
            const base = SPRITE_CONFIG.TORCHES.getBaseSprite(colorTheme);
            const flame = SPRITE_CONFIG.TORCHES.getFlameSprite(colorTheme);
            this.drawSprite(ctx, base, x, y);
            const img = flame && this.images[flame.img];
            if (!img || !img.naturalWidth) return;
            ctx.drawImage(img, flame.x, flame.y, TILE_SIZE, 10, x + flameOffsetX, y, TILE_SIZE, 10);
        }

        drawGrid(ctx, width, height) {
            ctx.save();
            ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
            ctx.lineWidth = 1;
            for (let x = 0; x <= width; x++) {
                ctx.beginPath();
                ctx.moveTo(x * TILE_SIZE + 0.5, 0);
                ctx.lineTo(x * TILE_SIZE + 0.5, height * TILE_SIZE);
                ctx.stroke();
            }
            for (let y = 0; y <= height; y++) {
                ctx.beginPath();
                ctx.moveTo(0, y * TILE_SIZE + 0.5);
                ctx.lineTo(width * TILE_SIZE, y * TILE_SIZE + 0.5);
                ctx.stroke();
            }
            ctx.restore();
        }

        drawInteractionOverlay(ctx) {
            if (this.dragStart && this.dragEnd) {
                const minX = Math.min(this.dragStart.x, this.dragEnd.x);
                const maxX = Math.max(this.dragStart.x, this.dragEnd.x);
                const minY = Math.min(this.dragStart.y, this.dragEnd.y);
                const maxY = Math.max(this.dragStart.y, this.dragEnd.y);
                ctx.save();
                ctx.fillStyle = "rgba(229, 179, 94, 0.18)";
                ctx.strokeStyle = "#e5b35e";
                ctx.fillRect(minX * TILE_SIZE, minY * TILE_SIZE, (maxX - minX + 1) * TILE_SIZE, (maxY - minY + 1) * TILE_SIZE);
                ctx.strokeRect(minX * TILE_SIZE + 0.5, minY * TILE_SIZE + 0.5, (maxX - minX + 1) * TILE_SIZE - 1, (maxY - minY + 1) * TILE_SIZE - 1);
                ctx.restore();
                return;
            }

            if (!this.hoverCell) return;
            ctx.save();
            ctx.strokeStyle = "#6dd6c2";
            ctx.lineWidth = 1;
            ctx.strokeRect(this.hoverCell.x * TILE_SIZE + 0.5, this.hoverCell.y * TILE_SIZE + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
            ctx.restore();
        }

        updateValidation() {
            const result = this.validateLevel();
            const list = $("validation-list");
            list.textContent = "";

            const items = [];
            result.errors.forEach((message) => items.push({ type: "error", message }));
            result.warnings.forEach((message) => items.push({ type: "warn", message }));
            if (!items.length) items.push({ type: "ok", message: "OK: LevelLoader accepts this level." });

            items.forEach((item) => {
                const li = document.createElement("li");
                li.className = item.type;
                li.textContent = item.message;
                list.appendChild(li);
            });
        }

        validateLevel() {
            const errors = [];
            const warnings = [];
            const width = this.level.width;
            const height = this.level.height;

            if (!Number.isInteger(width) || width < MIN_WIDTH || width > MAX_WIDTH) {
                errors.push(`Width must be ${MIN_WIDTH}-${MAX_WIDTH}.`);
            }
            if (!Number.isInteger(height) || height < MIN_HEIGHT || height > MAX_HEIGHT) {
                errors.push(`Height must be ${MIN_HEIGHT}-${MAX_HEIGHT}.`);
            }
            if (this.level.map.length !== width * height) {
                errors.push(`Map length must be ${width * height}, got ${this.level.map.length}.`);
            }

            const invalid = Array.from(new Set(this.level.map.filter((token) => !LEVEL_TOKEN_MAP[token])));
            if (invalid.length) errors.push(`Unknown tokens: ${invalid.join(", ")}`);

            const playerCount = this.level.map.filter((token) => {
                const def = LEVEL_TOKEN_MAP[token];
                return def && def.fg === 1;
            }).length;
            if (playerCount !== 1) errors.push(`Expected exactly one player, got ${playerCount}.`);

            if (this.level.hasColor) {
                const convertedToken = COLOR_THEME_CHAMELEON_SUBSTITUTE[previewColor(this.level)];
                if (convertedToken && this.level.map.includes(convertedToken)) {
                    warnings.push(`Original generator converts ${convertedToken} to e6/chameleon for this color theme.`);
                }
            }

            if (!errors.length && !this.validateWithLevelLoader()) {
                errors.push("LevelLoader rejected this level.");
            }

            if (!safeId(this.level.id)) warnings.push("Level ID will be exported as untitled.");
            return { errors, warnings };
        }

        validateWithLevelLoader() {
            if (typeof LevelLoader === "undefined") return true;
            const oldLog = console.log;
            const oldError = console.error;
            try {
                console.log = () => { };
                console.error = () => { };
                const loader = new LevelLoader(new ValidationGameState());
                return loader.loadCustomLevel(this.getLevelObject(false), "editor-validation");
            } catch (error) {
                return false;
            } finally {
                console.log = oldLog;
                console.error = oldError;
            }
        }

        getLevelObject(includeMeta = true) {
            const level = {
                width: this.level.width,
                height: this.level.height
            };

            if (this.level.hasColor) {
                level.color = previewColor(this.level);
            }

            level.mode = clampInt(this.level.mode, 1, 2, 2);
            level.map = this.level.map.slice();

            if (includeMeta) {
                const meta = {
                    id: safeId(this.level.id),
                    name: this.level.name || "",
                    author: this.level.author || "",
                    notes: this.level.notes || "",
                    editor: "Bugma HTML Level Editor",
                    editorVersion: EDITOR_VERSION
                };
                level.meta = meta;
            }

            return level;
        }

        updateExport(format) {
            this.lastExportFormat = format || this.lastExportFormat;
            document.querySelectorAll("[data-export]").forEach((button) => {
                button.classList.toggle("active", button.dataset.export === this.lastExportFormat);
            });
            const output = $("export-output");
            if (this.lastExportFormat === "text") output.value = this.exportText();
            else if (this.lastExportFormat === "js") output.value = this.exportJs();
            else if (this.lastExportFormat === "png") output.value = this.exportPngSummary();
            else output.value = this.exportJson();
        }

        exportText() {
            // C# custom format: 10 rows × 12 cols inner area, 3-character tokens
            const width = this.level.width;
            const height = this.level.height;

            // Determine export area: for 14×14 standard grid, export inner 10×12
            // For custom sizes, export the full grid
            let startX, startY, exportW, exportH;
            if (width === 14 && height === 14) {
                startX = 1; startY = 3; exportW = 12; exportH = 10;
            } else {
                startX = 0; startY = 0; exportW = width; exportH = height;
            }

            const rows = [];
            for (let y = 0; y < exportH; y++) {
                const rowTokens = [];
                for (let x = 0; x < exportW; x++) {
                    const mapIdx = (startY + y) * width + (startX + x);
                    const token = this.level.map[mapIdx] || "__";
                    if (token === "he") {
                        // Shirley=SHI, Ella=ELL
                        rowTokens.push(this.level.mode === 1 ? "SHI" : "ELL");
                    } else {
                        rowTokens.push(CS_EXPORT_MAP[token] || "___");
                    }
                }
                rows.push(rowTokens.join(" "));
            }

            const color = this.level.hasColor ? previewColor(this.level) : 0;
            const colorLine = CS_COLOR_NAMES[color] !== undefined ? CS_COLOR_NAMES[color] : " ";
            return [...rows, "", colorLine].join("\n");
        }

        exportJson() {
            return JSON.stringify(this.getLevelObject(true), null, 2);
        }

        exportJs() {
            const id = safeId(this.level.id);
            return `CUSTOM_LEVELS.levels[${JSON.stringify(id)}] = ${this.exportJson()};`;
        }

        exportPngSummary() {
            const width = this.level.width * TILE_SIZE * 4;
            const height = this.level.height * TILE_SIZE * 4;
            return [
                "PNG export selected.",
                `Download will render the current canvas as ${width} x ${height}px PNG.`,
                `Metadata chunk: ${META_CHUNK_KEY}`,
                `Filename: ${safeId(this.level.id)}.png`
            ].join("\n");
        }

        async copyOutput() {
            await navigator.clipboard.writeText($("export-output").value);
            this.setStatus("Copied");
        }

        downloadOutput() {
            if (this.lastExportFormat === "png") {
                this.downloadPng({ autoClick: true });
                return;
            }

            const ext = this.lastExportFormat === "js" ? "js" : this.lastExportFormat === "text" ? "txt" : "json";
            this.downloadBlob(new Blob([$("export-output").value], { type: "text/plain;charset=utf-8" }), `${safeId(this.level.id)}.${ext}`);
        }

        renderExportCanvas(scale) {
            const canvas = document.createElement("canvas");
            canvas.width = this.level.width * TILE_SIZE * scale;
            canvas.height = this.level.height * TILE_SIZE * scale;
            const ctx = canvas.getContext("2d");
            ctx.imageSmoothingEnabled = false;
            ctx.scale(scale, scale);
            this.drawLevel(ctx, this.buildPreviewState(), { grid: false, lighting: true, overlays: false });
            return canvas;
        }

        downloadPng(options = {}) {
            const autoClick = options.autoClick !== false;
            if (!this.imagesReady) {
                this.setStatus("Images are still loading");
                return;
            }

            const validation = this.validateLevel();
            if (validation.errors.length) {
                this.setStatus("Fix validation errors first");
                return;
            }

            try {
                const canvas = this.renderExportCanvas(4);
                const bytes = dataUrlToBytes(canvas.toDataURL("image/png"));
                const json = JSON.stringify(this.getLevelObject(true));
                const taggedBytes = insertPngTextChunks(bytes, [
                    [META_CHUNK_KEY, `base64:${encodeBase64Utf8(json)}`],
                    ["Description", `Bugma level ${safeId(this.level.id)}`]
                ]);
                this.downloadHref(bytesToDataUrl(taggedBytes, "image/png"), `${safeId(this.level.id)}.png`, {
                    mime: "image/png",
                    byteSize: taggedBytes.length,
                    autoClick
                });
                this.setStatus(autoClick ? "PNG exported" : "PNG ready");
            } catch (error) {
                this.setStatus(error.message || "PNG export failed");
            }
        }

        downloadBlob(blob, filename) {
            const url = URL.createObjectURL(blob);
            this.downloadHref(url, filename, {
                mime: blob.type || "",
                byteSize: blob.size,
                objectUrl: url,
                autoClick: true
            });
        }

        downloadHref(href, filename, options = {}) {
            const objectUrl = options.objectUrl || "";
            let link = $("last-download-link");
            if (!link) {
                link = document.createElement("a");
                link.id = "last-download-link";
                link.hidden = true;
                link.setAttribute("aria-hidden", "true");
                document.body.appendChild(link);
            }

            const preparedLink = $("prepared-download-link");
            const staleUrls = new Set([
                link.dataset.objectUrl,
                preparedLink ? preparedLink.dataset.objectUrl : null
            ].filter(Boolean));
            staleUrls.forEach((staleUrl) => URL.revokeObjectURL(staleUrl));

            const configureLink = (target) => {
                target.href = href;
                target.download = filename;
                target.dataset.objectUrl = objectUrl;
                target.dataset.filename = filename;
                target.dataset.mime = options.mime || "";
                target.dataset.byteSize = String(options.byteSize || 0);
            };

            configureLink(link);

            if (preparedLink) {
                configureLink(preparedLink);
                preparedLink.hidden = false;
                preparedLink.textContent = `Ready: ${filename}`;
                preparedLink.title = `Download ${filename}`;
            }

            if (options.autoClick !== false) {
                link.click();
            }
        }

        async importFile(event) {
            const file = event.target.files && event.target.files[0];
            if (!file) return;
            try {
                if (file.type === "image/png" || file.name.toLowerCase().endsWith(".png")) {
                    const levelJson = await readPngLevelJson(file);
                    this.setImportedLevel(JSON.parse(levelJson));
                } else {
                    this.importText(await file.text());
                }
                this.setStatus(`Imported ${file.name}`);
            } catch (error) {
                this.setStatus(error.message);
            } finally {
                event.target.value = "";
            }
        }

        importText(text) {
            try {
                const parsed = parseLevelText(text);
                this.setImportedLevel(parsed);
                this.setStatus("Imported text");
            } catch (error) {
                this.setStatus(error.message);
            }
        }

        setImportedLevel(input) {
            const level = normalizeImportedLevel(input);
            this.level = level;
            this.syncForm();
            this.renderPalette();
            this.resetHistory();
            this.refresh();
        }
    }

    function normalizeImportedLevel(input) {
        if (!input || typeof input !== "object") throw new Error("Import failed: expected a level object.");
        const width = input.width === undefined ? 14 : Number(input.width);
        const height = input.height === undefined ? 14 : Number(input.height);
        if (!Number.isInteger(width) || !Number.isInteger(height)) throw new Error("Import failed: invalid width/height.");
        if (width < MIN_WIDTH || width > MAX_WIDTH || height < MIN_HEIGHT || height > MAX_HEIGHT) {
            throw new Error(`Import failed: size must be ${MIN_WIDTH}-${MAX_WIDTH} by ${MIN_HEIGHT}-${MAX_HEIGHT}.`);
        }
        if (!Array.isArray(input.map)) throw new Error("Import failed: map must be an array.");
        if (input.map.length !== width * height) throw new Error(`Import failed: expected ${width * height} cells.`);

        const map = input.map.map((token) => {
            const value = String(token);
            if (!LEVEL_TOKEN_MAP[value]) throw new Error(`Import failed: unknown token ${value}.`);
            return value === "HE" ? "he" : value;
        });

        const meta = input.meta || {};
        const hasColor = input.hasColor !== undefined ? input.hasColor : (input.color !== undefined && input.color !== null && input.color !== "");
        return {
            id: input.id || meta.id || "imported-level",
            name: input.name || meta.name || "Imported Level",
            author: input.author || meta.author || "",
            notes: input.notes || meta.notes || "",
            width,
            height,
            hasColor,
            color: hasColor ? clampInt(input.color, 0, 6, 0) : 0,
            mode: clampInt(input.mode, 1, 2, 2),
            map
        };
    }

    function tryParseCSFormat(lines) {
        // Detect C# 3-character format: each line is space-separated 3-char tokens
        // Lines with empty or color name, 10-12 map rows, then optional color line
        const nonEmpty = lines.filter((l) => l.trim() !== "");
        if (nonEmpty.length < 10) return null;

        // Check if the majority of non-empty lines look like CS format
        const mapStart = 0;
        let mapEnd = nonEmpty.length;
        let colorName = null;

        // Check if last non-empty line is a color name
        const lastLine = nonEmpty[nonEmpty.length - 1];
        if (CS_COLOR_FROM_NAME[lastLine] !== undefined || lastLine === " ") {
            colorName = lastLine === " " ? null : lastLine;
            mapEnd = nonEmpty.length - 1;
        }

        // Validate: first 10+ lines should contain space-separated 3-char tokens
        const csTokenSet = new Set(Object.keys(CS_IMPORT_MAP));
        csTokenSet.add("SHI"); csTokenSet.add("ELL");
        let csScore = 0;
        let totalScore = 0;
        const mapLines = nonEmpty.slice(mapStart, mapEnd);

        for (const line of mapLines) {
            const tokens = line.split(/\s+/).filter(Boolean);
            totalScore += tokens.length;
            for (const token of tokens) {
                if (csTokenSet.has(token) || token === "___" || token === "|||") csScore++;
            }
        }

        // Require >80% of tokens to be recognized CS format
        if (totalScore === 0 || csScore / totalScore < 0.8) return null;

        // Parse the CS format
        const csRows = mapLines.length;
        const csCols = Math.max(...mapLines.map((l) => l.split(/\s+/).filter(Boolean).length));
        const map = [];

        // CS format is 10×12 inner area of 14×14 grid
        // For non-standard sizes, use the parsed dimensions directly
        const isStandard = (csRows === 10 && csCols === 12);
        const outWidth = isStandard ? 14 : csCols;
        const outHeight = isStandard ? 14 : csRows;
        const startX = isStandard ? 1 : 0;
        const startY = isStandard ? 3 : 0;

        // Initialize full grid with walls for standard, empty for custom
        const defaultToken = isStandard ? "||" : "__";
        for (let y = 0; y < outHeight; y++) {
            for (let x = 0; x < outWidth; x++) {
                if (isStandard && (x === 0 || x === 13 || y === 0 || y === 1 || y === 2 || y === 13)) {
                    map.push("||");
                } else {
                    map.push("__");
                }
            }
        }

        // Fill in the parsed tokens
        let mode = 2; // default Ella
        for (let y = 0; y < Math.min(csRows, mapLines.length); y++) {
            const tokens = mapLines[y].split(/\s+/).filter(Boolean);
            for (let x = 0; x < Math.min(csCols, tokens.length); x++) {
                const csToken = tokens[x];
                const mapIdx = (startY + y) * outWidth + (startX + x);
                if (csToken === "SHI") {
                    map[mapIdx] = "he";
                    mode = 1;
                } else if (csToken === "ELL") {
                    map[mapIdx] = "he";
                    mode = 2;
                } else if (CS_IMPORT_MAP[csToken]) {
                    map[mapIdx] = CS_IMPORT_MAP[csToken];
                }
            }
        }

        // Determine color from color line
        const hasColor = colorName !== null && CS_COLOR_FROM_NAME[colorName] !== undefined;
        const color = hasColor ? CS_COLOR_FROM_NAME[colorName] : 0;

        return {
            id: "imported-cs",
            name: "Imported CS Stage",
            author: "",
            width: outWidth,
            height: outHeight,
            hasColor,
            color,
            mode,
            map
        };
    }

    function parseLevelText(text) {
        const trimmed = String(text || "").trim();
        if (!trimmed) throw new Error("Import failed: empty input.");

        try {
            return JSON.parse(trimmed);
        } catch (error) {
            const match = trimmed.match(/CUSTOM_LEVELS\.levels\[[^\]]+\]\s*=\s*({[\s\S]*});?\s*$/);
            if (match) return JSON.parse(match[1]);
        }

        const lines = trimmed.split(/\r?\n/).map((line) => line.trim());

        // Detect C# 3-character token format
        const csResult = tryParseCSFormat(lines);
        if (csResult) return csResult;

        const filtered = lines.filter(Boolean);
        const header = {};
        const mapRows = [];
        let inMap = false;

        filtered.forEach((line) => {
            if (line.startsWith("#")) return;
            if (line === "[map]") {
                inMap = true;
                return;
            }
            if (!inMap && line.includes("=")) {
                const index = line.indexOf("=");
                header[line.slice(0, index).trim()] = line.slice(index + 1).trim();
                return;
            }
            mapRows.push(line.split(/\s+/));
        });

        if (!mapRows.length) throw new Error("Import failed: no map rows found.");
        const width = header.width ? Number(header.width) : mapRows[0].length;
        const height = header.height ? Number(header.height) : mapRows.length;
        const hasColor = header.color !== undefined && header.color !== "auto" && header.color !== "";
        return {
            id: header.id || "imported-text",
            name: header.name || "Imported Text",
            author: header.author || "",
            width,
            height,
            hasColor,
            color: hasColor ? Number(header.color) : 0,
            mode: header.mode ? Number(header.mode) : 2,
            map: mapRows.flat()
        };
    }

    function encodeBase64Utf8(text) {
        const bytes = textEncoder.encode(text);
        let binary = "";
        bytes.forEach((byte) => {
            binary += String.fromCharCode(byte);
        });
        return btoa(binary);
    }

    function decodeBase64Utf8(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return textDecoder.decode(bytes);
    }

    function dataUrlToBytes(dataUrl) {
        const match = String(dataUrl).match(/^data:image\/png;base64,(.+)$/);
        if (!match) throw new Error("PNG export failed: canvas did not produce PNG data.");
        const binary = atob(match[1]);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return bytes;
    }

    function bytesToDataUrl(bytes, mime) {
        let binary = "";
        const chunkSize = 0x8000;
        for (let offset = 0; offset < bytes.length; offset += chunkSize) {
            binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
        }
        return `data:${mime};base64,${btoa(binary)}`;
    }

    function readUint32(bytes, offset) {
        return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
    }

    function writeUint32(bytes, offset, value) {
        bytes[offset] = (value >>> 24) & 0xff;
        bytes[offset + 1] = (value >>> 16) & 0xff;
        bytes[offset + 2] = (value >>> 8) & 0xff;
        bytes[offset + 3] = value & 0xff;
    }

    function asciiBytes(text) {
        return Uint8Array.from(String(text), (char) => char.charCodeAt(0) & 0xff);
    }

    function concatBytes(parts) {
        const length = parts.reduce((total, part) => total + part.length, 0);
        const out = new Uint8Array(length);
        let offset = 0;
        parts.forEach((part) => {
            out.set(part, offset);
            offset += part.length;
        });
        return out;
    }

    let crcTable = null;
    function getCrcTable() {
        if (crcTable) return crcTable;
        crcTable = new Uint32Array(256);
        for (let n = 0; n < 256; n++) {
            let c = n;
            for (let k = 0; k < 8; k++) {
                c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
            }
            crcTable[n] = c >>> 0;
        }
        return crcTable;
    }

    function crc32(bytes) {
        const table = getCrcTable();
        let c = 0xffffffff;
        for (let i = 0; i < bytes.length; i++) {
            c = table[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
        }
        return (c ^ 0xffffffff) >>> 0;
    }

    function makePngChunk(type, data) {
        const typeBytes = asciiBytes(type);
        const chunk = new Uint8Array(12 + data.length);
        writeUint32(chunk, 0, data.length);
        chunk.set(typeBytes, 4);
        chunk.set(data, 8);
        writeUint32(chunk, 8 + data.length, crc32(concatBytes([typeBytes, data])));
        return chunk;
    }

    function insertPngTextChunks(pngBytes, entries) {
        const signature = [137, 80, 78, 71, 13, 10, 26, 10];
        for (let i = 0; i < signature.length; i++) {
            if (pngBytes[i] !== signature[i]) throw new Error("PNG export failed: invalid PNG data.");
        }

        const ihdrLength = readUint32(pngBytes, 8);
        const insertOffset = 8 + 12 + ihdrLength;
        const chunks = entries.map(([key, value]) => {
            const textData = concatBytes([asciiBytes(key), new Uint8Array([0]), asciiBytes(value)]);
            return makePngChunk("tEXt", textData);
        });
        return concatBytes([pngBytes.slice(0, insertOffset), ...chunks, pngBytes.slice(insertOffset)]);
    }

    async function readPngLevelJson(file) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        let offset = 8;

        while (offset + 12 <= bytes.length) {
            const length = readUint32(bytes, offset);
            const type = String.fromCharCode(...bytes.slice(offset + 4, offset + 8));
            const dataStart = offset + 8;
            const dataEnd = dataStart + length;

            if (type === "tEXt") {
                const data = bytes.slice(dataStart, dataEnd);
                const split = data.indexOf(0);
                const key = String.fromCharCode(...data.slice(0, split));
                const value = String.fromCharCode(...data.slice(split + 1));
                if (key === META_CHUNK_KEY) {
                    if (value.startsWith("base64:")) return decodeBase64Utf8(value.slice(7));
                    return value;
                }
            }

            offset = dataEnd + 4;
        }

        throw new Error("PNG import failed: no Bugma metadata.");
    }

    window.addEventListener("DOMContentLoaded", () => {
        window.bugmaEditor = new EditorApp();
    });
})();
