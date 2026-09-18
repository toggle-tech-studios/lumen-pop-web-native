import { Scene } from 'phaser';

const COLS = 6;
const ROWS = 6;
const TILE_SIZE = 50;
const SPACING = 4;
const COLORS = ['aether', 'blaze', 'nova', 'solar', 'terra'];

export default class Game extends Scene {
    private grid: any[][] = [];
    private score: number = 0;
    private targetScore: number = 1000;
    private moves: number = 40;
    private level: number = 1;
    
    private scoreText!: Phaser.GameObjects.Text;
    private movesText!: Phaser.GameObjects.Text;
    
    private isDragging: boolean = false;
    private chain: any[] = [];
    private chainGraphics!: Phaser.GameObjects.Graphics;

    constructor() {
        super('Game');
    }

    create() {
        this.add.image(180, 320, 'bg1').setDisplaySize(360, 640).setAlpha(0.3);

        this.scoreText = this.add.text(20, 40, `Score: ${this.score}`, { fontSize: '20px', color: '#fff' });
        this.movesText = this.add.text(250, 40, `Moves: ${this.moves}`, { fontSize: '20px', color: '#fff' });
        
        this.chainGraphics = this.add.graphics();
        this.chainGraphics.setDepth(10);

        this.createBoard();

        this.input.on('pointerup', this.endDrag, this);
    }

    createBoard() {
        const startX = 180 - (COLS * (TILE_SIZE + SPACING)) / 2 + TILE_SIZE / 2;
        const startY = 320 - (ROWS * (TILE_SIZE + SPACING)) / 2 + TILE_SIZE / 2;

        for (let r = 0; r < ROWS; r++) {
            this.grid[r] = [];
            for (let c = 0; c < COLS; c++) {
                const x = startX + c * (TILE_SIZE + SPACING);
                const y = startY + r * (TILE_SIZE + SPACING);
                const color = COLORS[Phaser.Math.Between(0, COLORS.length - 1)];
                
                const tile = this.add.sprite(x, y, color);
                tile.setDisplaySize(TILE_SIZE, TILE_SIZE);
                tile.setInteractive();
                
                tile.on('pointerdown', () => this.startDrag(tile, r, c));
                tile.on('pointerover', () => this.continueDrag(tile, r, c));

                this.grid[r][c] = { sprite: tile, type: color, r, c };
            }
        }
    }

    startDrag(tile: Phaser.GameObjects.Sprite, r: number, c: number) {
        if (this.moves <= 0) return;
        this.isDragging = true;
        this.chain = [this.grid[r][c]];
        tile.setScale(1.2);
        this.drawChain();
    }

    continueDrag(tile: Phaser.GameObjects.Sprite, r: number, c: number) {
        if (!this.isDragging) return;

        const tileData = this.grid[r][c];
        const lastTile = this.chain[this.chain.length - 1];

        // Ensure same color
        if (tileData.type !== lastTile.type) return;

        // Ensure adjacent
        const dr = Math.abs(tileData.r - lastTile.r);
        const dc = Math.abs(tileData.c - lastTile.c);
        if (dr > 1 || dc > 1 || (dr === 0 && dc === 0)) return;

        // Check if backtracking
        const prevTile = this.chain.length > 1 ? this.chain[this.chain.length - 2] : null;
        if (prevTile && prevTile === tileData) {
            lastTile.sprite.setScale(1.0);
            this.chain.pop();
            this.drawChain();
            return;
        }

        // Prevent loops
        if (this.chain.includes(tileData)) return;

        this.chain.push(tileData);
        tile.setScale(1.2);
        this.drawChain();
    }

    endDrag() {
        if (!this.isDragging) return;
        this.isDragging = false;
        
        if (this.chain.length >= 3) {
            this.popChain();
        } else {
            this.chain.forEach(t => t.sprite.setScale(1.0));
        }
        
        this.chain = [];
        this.chainGraphics.clear();
    }

    popChain() {
        this.moves--;
        this.movesText.setText(`Moves: ${this.moves}`);
        
        const points = this.chain.length * 25;
        this.score += points;
        this.scoreText.setText(`Score: ${this.score}`);

        this.chain.forEach(t => {
            t.sprite.destroy();
            this.grid[t.r][t.c] = null;
        });

        this.fallDown();
    }

    fallDown() {
        const startX = 180 - (COLS * (TILE_SIZE + SPACING)) / 2 + TILE_SIZE / 2;
        const startY = 320 - (ROWS * (TILE_SIZE + SPACING)) / 2 + TILE_SIZE / 2;

        for (let c = 0; c < COLS; c++) {
            let emptySpaces = 0;
            for (let r = ROWS - 1; r >= 0; r--) {
                if (this.grid[r][c] === null) {
                    emptySpaces++;
                } else if (emptySpaces > 0) {
                    const tileData = this.grid[r][c];
                    this.grid[r + emptySpaces][c] = tileData;
                    this.grid[r][c] = null;
                    tileData.r = r + emptySpaces;
                    
                    this.tweens.add({
                        targets: tileData.sprite,
                        y: startY + tileData.r * (TILE_SIZE + SPACING),
                        duration: 200,
                        ease: 'Bounce.easeOut'
                    });
                }
            }

            for (let i = 0; i < emptySpaces; i++) {
                const r = emptySpaces - 1 - i;
                const x = startX + c * (TILE_SIZE + SPACING);
                const y = startY + r * (TILE_SIZE + SPACING);
                const color = COLORS[Phaser.Math.Between(0, COLORS.length - 1)];
                
                const tile = this.add.sprite(x, y - 300, color);
                tile.setDisplaySize(TILE_SIZE, TILE_SIZE);
                tile.setInteractive();
                
                tile.on('pointerdown', () => this.startDrag(tile, r, c));
                tile.on('pointerover', () => this.continueDrag(tile, r, c));

                this.grid[r][c] = { sprite: tile, type: color, r, c };

                this.tweens.add({
                    targets: tile,
                    y: y,
                    duration: 200 + i * 50,
                    ease: 'Bounce.easeOut'
                });
            }
        }
    }

    drawChain() {
        this.chainGraphics.clear();
        if (this.chain.length < 2) return;

        this.chainGraphics.lineStyle(6, 0xffffff, 0.5);
        this.chainGraphics.beginPath();
        
        this.chainGraphics.moveTo(this.chain[0].sprite.x, this.chain[0].sprite.y);
        for (let i = 1; i < this.chain.length; i++) {
            this.chainGraphics.lineTo(this.chain[i].sprite.x, this.chain[i].sprite.y);
        }
        this.chainGraphics.strokePath();
    }
}
