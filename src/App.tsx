import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import {
  ArrowLeft,
  ChevronRight,
  CircleHelp,
  Crown,
  Gem,
  Gift,
  Home,
  Lock,
  Music2,
  Pause,
  Play,
  RotateCcw,
  Settings as SettingsIcon,
  Sparkles,
  Star,
  Volume2,
  VolumeX,
} from 'lucide-react';

type Screen = 'loading' | 'start' | 'home' | 'level-loading' | 'game' | 'settings';
type LumenColor = 'solar' | 'verdant' | 'terra' | 'nova' | 'cosmic' | 'aether' | 'blaze';
type Tile = { id: number; color: LumenColor; fusion?: boolean };
type BoosterKind = 'shuffle' | 'bomb' | 'burst';
type SavedProgress = {
  highestUnlocked: number;
  completed: Record<number, { stars: number; bestScore: number }>;
  coins: number;
  sound: boolean;
  music: boolean;
  dailyGiftClaimedOn?: string;
};
type LineDirection = { row: number; col: number };

const ASSET = './assets/';
const BOARD_SIZE = 6;
const colors: LumenColor[] = ['solar', 'verdant', 'terra', 'nova', 'cosmic', 'aether', 'blaze'];
const lumenAssets: Record<LumenColor, { opened: string; closed: string }> = {
  solar: { opened: 'solar_opened.png', closed: 'solar_closed.png' },
  verdant: { opened: 'verdant_opened.png', closed: 'verdant_closed.png' },
  terra: { opened: 'terra_opened.png', closed: 'terra_closed.png' },
  nova: { opened: 'nova_opened.png', closed: 'nova_closed.png' },
  cosmic: { opened: 'cosmic_opened.png', closed: 'cosmic_closed.png' },
  aether: { opened: 'aether_opened.png', closed: 'aether_closed.png' },
  blaze: { opened: 'blaze_opened.png', closed: 'blaze_closed.png' },
};
const fusionOrbAsset = 'fusion_orb.png';
const boosterPrices: Record<BoosterKind, number> = { shuffle: 100, bomb: 150, burst: 250 };
const backgrounds = Array.from({ length: 10 }, (_, index) => `bg_level_${index + 1}.png`);
const logoAsset = 'lumen-pop-logo.png';
const loadingAsset = 'lumen-pop-loading.png';
const homepageMusicAsset = 'homepage_music.mp3';
const gameplayMusicAsset = 'gameplay_music.mp3';

const defaultProgress: SavedProgress = {
  highestUnlocked: 1,
  completed: {},
  coins: 1000,
  sound: true,
  music: true,
};

let nextTileId = 100;
const freshTileId = () => nextTileId++;

const readProgress = (): SavedProgress => {
  try {
    const raw = localStorage.getItem('lumen-pop-progress');
    return raw ? { ...defaultProgress, ...JSON.parse(raw) } : defaultProgress;
  } catch {
    return defaultProgress;
  }
};

const writeProgress = (progress: SavedProgress) => {
  localStorage.setItem('lumen-pop-progress', JSON.stringify(progress));
};

const todayKey = () => new Date().toISOString().slice(0, 10);

const levelConfig = (level: number) => ({
  level,
  targetScore: 5000 + (level - 1) * 1000,
  moves: 40 + (level - 1) * 20,
  world: level < 11 ? 'Starlight Meadows' : level < 26 ? 'Crystal Valley' : 'Twilight Grove',
  title: level < 11 ? 'First Glow' : level < 26 ? 'Crystal Drift' : 'Moonlit Bloom',
  lesson: level <= 2 ? 'Make an easy 3-link to wake the meadow' : level <= 5 ? 'Longer chains charge brighter rewards' : 'Find the clearest line through the glow',
  canSpawnVortex: level >= 5,
});

const randomColor = () => colors[Math.floor(Math.random() * colors.length)];
const rowOf = (index: number) => Math.floor(index / BOARD_SIZE);
const colOf = (index: number) => index % BOARD_SIZE;
const lineDirections: LineDirection[] = [
  { row: -1, col: -1 }, { row: -1, col: 0 }, { row: -1, col: 1 },
  { row: 0, col: -1 }, { row: 0, col: 1 },
  { row: 1, col: -1 }, { row: 1, col: 0 }, { row: 1, col: 1 },
];
const directionBetween = (from: number, to: number): LineDirection | null => {
  const row = rowOf(to) - rowOf(from);
  const col = colOf(to) - colOf(from);
  if (Math.abs(row) > 1 || Math.abs(col) > 1 || (row === 0 && col === 0)) return null;
  return { row: Math.sign(row), col: Math.sign(col) };
};
const lineStep = (from: number, to: number, direction: LineDirection) => {
  return rowOf(to) - rowOf(from) === direction.row && colOf(to) - colOf(from) === direction.col;
};

const hasPlayableChain = (board: (Tile | null)[]) => {
  for (let start = 0; start < board.length; start += 1) {
    const tile = board[start];
    if (!tile) continue;
    for (const direction of lineDirections) {
      let length = 1;
      let row = rowOf(start) + direction.row;
      let col = colOf(start) + direction.col;
      while (row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE) {
        const next = row * BOARD_SIZE + col;
        if (board[next]?.color !== tile.color) break;
        length += 1;
        if (length >= 3) return true;
        row += direction.row;
        col += direction.col;
      }
    }
  }
  return false;
};

const installGuaranteedLine = (board: Tile[], color: LumenColor = 'solar') => {
  const directions = [
    { row: 0, col: 1 },
    { row: 1, col: 0 },
    { row: 1, col: 1 },
    { row: 1, col: -1 },
  ];
  const direction = directions[Math.floor(Math.random() * directions.length)];
  const starts: number[] = [];
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const endRow = row + direction.row * 2;
      const endCol = col + direction.col * 2;
      if (endRow >= 0 && endRow < BOARD_SIZE && endCol >= 0 && endCol < BOARD_SIZE) starts.push(row * BOARD_SIZE + col);
    }
  }
  const start = starts[Math.floor(Math.random() * starts.length)] ?? 0;
  const startRow = rowOf(start);
  const startCol = colOf(start);
  for (let step = 0; step < 3; step += 1) {
    const index = (startRow + direction.row * step) * BOARD_SIZE + startCol + direction.col * step;
    if (board[index] && !board[index].fusion) board[index].color = color;
  }
};

const makeBoard = (level = 1): Tile[] => {
  let board: Tile[] = Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, id) => ({
    id,
    color: randomColor(),
  }));
  installGuaranteedLine(board, level <= 2 ? 'solar' : randomColor());
  if (level >= 8 && Math.random() < 0.1) board[17] = { id: freshTileId(), color: 'cosmic', fusion: true };
  return board;
};

const collapseBoard = (board: (Tile | null)[], level = 1, spawnVortex = false) => {
  const next: (Tile | null)[] = Array(36).fill(null);
  const refilled: number[] = [];
  for (let col = 0; col < BOARD_SIZE; col += 1) {
    const survivors: Tile[] = [];
    for (let row = BOARD_SIZE - 1; row >= 0; row -= 1) {
      const tile = board[row * BOARD_SIZE + col];
      if (tile) survivors.push(tile);
    }
    for (let row = BOARD_SIZE - 1, i = 0; row >= 0; row -= 1, i += 1) {
      if (survivors[i]) next[row * BOARD_SIZE + col] = survivors[i];
      else {
        next[row * BOARD_SIZE + col] = { id: freshTileId(), color: randomColor() };
        refilled.push(row * BOARD_SIZE + col);
      }
    }
  }
  if (spawnVortex && level >= 5 && Math.random() < 0.72) {
    const slot = refilled[Math.floor(Math.random() * refilled.length)];
    if (slot !== undefined) next[slot] = { id: freshTileId(), color: 'cosmic', fusion: true };
  }
  if (!hasPlayableChain(next)) {
    installGuaranteedLine(next as Tile[], level <= 2 ? 'solar' : randomColor());
  }
  return { board: next as Tile[], refilled };
};

type SoundKind = 'wake' | 'link' | 'backtrack' | 'pop' | 'gravity' | 'booster' | 'special' | 'win' | 'lose';

function createSoundEngine() {
  let context: AudioContext | null = null;
  let ambient: OscillatorNode | null = null;
  let ambientGain: GainNode | null = null;

  const unlock = () => {
    const AudioContextClass = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    context ??= new AudioContextClass();
    if (context.state === 'suspended') void context.resume();
  };

  const tone = (frequency: number, duration: number, wave: OscillatorType, volume: number, delay = 0) => {
    unlock();
    if (!context) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime + delay;
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.03);
  };

  return {
    unlock,
    ambient(enabled: boolean) {
      unlock();
      if (!context) return;
      if (enabled && !ambient) {
        ambient = context.createOscillator();
        ambientGain = context.createGain();
        ambient.type = 'sine';
        ambient.frequency.value = 110;
        ambientGain.gain.value = 0.008;
        ambient.connect(ambientGain).connect(context.destination);
        ambient.start();
      } else if (!enabled && ambient) {
        ambient.stop();
        ambient.disconnect();
        ambient = null;
        ambientGain?.disconnect();
        ambientGain = null;
      }
    },
    play(kind: SoundKind, intensity = 1) {
      const volume = Math.min(0.055, 0.024 * intensity);
      if (kind === 'wake') tone(420, 0.12, 'sine', volume);
      if (kind === 'link') tone(510 + intensity * 35, 0.1, 'triangle', volume, 0.01);
      if (kind === 'backtrack') tone(260, 0.1, 'sine', volume * 0.8);
      if (kind === 'pop') {
        tone(560 + intensity * 35, 0.16, 'triangle', volume);
        tone(840 + intensity * 55, 0.2, 'sine', volume * 0.65, 0.04);
      }
      if (kind === 'gravity') tone(180, 0.18, 'sine', volume * 0.55);
      if (kind === 'booster') {
        tone(280, 0.2, 'triangle', volume);
        tone(620, 0.28, 'sine', volume * 0.75, 0.08);
      }
      if (kind === 'special') {
        tone(220, 0.42, 'sine', volume * 1.15);
        tone(660, 0.5, 'triangle', volume, 0.16);
        tone(990, 0.52, 'sine', volume * 0.7, 0.28);
      }
      if (kind === 'win') {
        tone(520, 0.22, 'sine', volume);
        tone(660, 0.24, 'sine', volume, 0.12);
        tone(880, 0.38, 'triangle', volume, 0.24);
      }
      if (kind === 'lose') {
        tone(300, 0.2, 'sine', volume);
        tone(220, 0.3, 'sine', volume, 0.15);
      }
    },
    dispose() {
      ambient?.stop();
      ambient?.disconnect();
      ambientGain?.disconnect();
      if (context) void context.close();
    },
  };
}

function Brand({ small = false }: { small?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <img className={small ? 'logo-mark' : 'landing-art'} src={`${ASSET}${logoAsset}`} alt="Lumen Pop star" />
      {small && <span className="display text-white text-lg font-bold tracking-tight">Lumen Pop</span>}
    </div>
  );
}

function Topbar({ onSettings, onBack, label = 'LUMEN POP' }: { onSettings?: () => void; onBack?: () => void; label?: string }) {
  return (
    <header className="topbar">
      {onBack ? <button className="icon-btn" onClick={onBack} aria-label="Go back"><ArrowLeft size={19} /></button> : <Brand small />}
      <span className="eyebrow">{label}</span>
      {onSettings ? <button className="icon-btn" onClick={onSettings} aria-label="Open settings"><SettingsIcon size={19} /></button> : <div className="w-[42px]" />}
    </header>
  );
}

function MusicLayer({ screen, enabled }: { screen: Screen; enabled: boolean }) {
  const homepageRef = useRef<HTMLAudioElement>(null);
  const gameplayRef = useRef<HTMLAudioElement>(null);
  const isGame = screen === 'game';

  useEffect(() => {
    const homepage = homepageRef.current;
    const gameplay = gameplayRef.current;
    if (!homepage || !gameplay) return;
    const active = isGame ? gameplay : homepage;
    const inactive = isGame ? homepage : gameplay;
    inactive.pause();
    if (!enabled) {
      active.pause();
      return;
    }
    active.volume = isGame ? 0.26 : 0.32;
    void active.play().catch(() => undefined);
  }, [enabled, isGame]);

  useEffect(() => {
    const resume = () => {
      const audio = isGame ? gameplayRef.current : homepageRef.current;
      if (enabled && audio?.paused) void audio.play().catch(() => undefined);
    };
    document.addEventListener('pointerdown', resume);
    return () => document.removeEventListener('pointerdown', resume);
  }, [enabled, isGame]);

  return (
    <>
      <audio className="audio-track" ref={homepageRef} src={`${ASSET}${homepageMusicAsset}`} loop preload="auto" aria-hidden="true" />
      <audio className="audio-track" ref={gameplayRef} src={`${ASSET}${gameplayMusicAsset}`} loop preload="auto" aria-hidden="true" />
    </>
  );
}

function LoadingScreen({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, 1500);
    return () => window.clearTimeout(timer);
  }, [onDone]);
  return (
    <div className="center-screen game-shell">
      <div className="text-center">
        <img className="loading-art" src={`${ASSET}${loadingAsset}`} alt="Lumen Pop loading" />
        <p className="eyebrow mt-3">Waking the Lumens...</p>
        <div className="loading-bar mx-auto mt-4 h-1 w-36 overflow-hidden rounded-full bg-white/15"><i className="block h-full w-1/2 animate-[shimmer_1.5s_ease-in-out_infinite] bg-cyan-300" /></div>
      </div>
    </div>
  );
}

function LevelLoadingScreen({ level, onReady }: { level: number; onReady: () => void }) {
  const [loaded, setLoaded] = useState(0);
  const [total, setTotal] = useState(1);
  const loadedRef = useRef(0);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    let cancelled = false;
    let finished = false;
    loadedRef.current = 0;
    setLoaded(0);
    const sources = [
      ...Object.values(lumenAssets).flatMap((asset) => [asset.closed, asset.opened]),
      fusionOrbAsset,
      backgrounds[Math.min(backgrounds.length - 1, Math.floor(level / 2))],
    ];
    setTotal(sources.length);
    const markLoaded = () => {
      if (cancelled) return;
      loadedRef.current += 1;
      setLoaded(loadedRef.current);
      if (loadedRef.current >= sources.length) reveal();
    };
    const images = sources.map((source) => {
      const image = new Image();
      image.onload = markLoaded;
      image.onerror = markLoaded;
      image.src = `${ASSET}${source}`;
      return image;
    });
    const reveal = () => {
      if (!cancelled && !finished) {
        finished = true;
        onReadyRef.current();
      }
    };
    const waitForAssets = window.setTimeout(reveal, 2400);
    return () => {
      cancelled = true;
      images.forEach((image) => { image.onload = null; image.onerror = null; });
      window.clearTimeout(waitForAssets);
    };
  }, [level]);

  const percent = Math.max(8, Math.round((loaded / total) * 100));
  return (
    <div className="center-screen game-shell level-loading-screen">
      <div className="level-loading-card">
        <img className="level-loading-logo" src={`${ASSET}${logoAsset}`} alt="Lumen Pop" />
        <p className="eyebrow">Preparing level {level}</p>
        <h1 className="display">Gathering the glow...</h1>
        <div className="loading-bar wide-loading-bar"><i style={{ width: `${percent}%` }} /></div>
        <span className="loading-status">{loaded >= total ? 'The Lumens are ready' : 'Waking the Lumens for your board'}</span>
      </div>
    </div>
  );
}

function StartScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="center-screen game-shell">
      <div className="land-blob left-[8%] top-[15%] h-28 w-28 bg-cyan-300/15" />
      <div className="land-blob bottom-[13%] right-[7%] h-44 w-44 bg-pink-300/15" />
      <div className="stagger relative flex max-w-md flex-col items-center text-center">
        <div className="sparkle"><img className="landing-art" src={`${ASSET}${logoAsset}`} alt="Lumen Pop" /></div>
        <p className="eyebrow mt-7">A pocket adventure of tiny lights</p>
        <h1 className="display mt-3 text-4xl font-bold leading-[.95] tracking-[-.07em] text-white sm:text-5xl">Wake the wonder.<br /><span className="text-cyan-200">Pop the light.</span></h1>
        <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/65">Link three or more Lumens by touch. Every chain wakes a little more of the world.</p>
        <button className="btn-primary mt-8 flex items-center gap-3" onClick={onStart}><Play size={18} fill="currentColor" /> Begin the journey <ChevronRight size={18} /></button>
        <p className="mt-5 text-[11px] text-white/40">No rush. Just little bursts of magic.</p>
      </div>
    </div>
  );
}

function MapNode({ level, left, top, locked, current, stars, onClick }: { level: number; left: string; top: string; locked?: boolean; current?: boolean; stars?: number; onClick: () => void }) {
  return (
    <button className={`map-node ${locked ? 'locked' : ''} ${current ? 'current' : ''} ${stars ? 'completed' : ''}`} style={{ left, top }} onClick={onClick} aria-label={`Level ${level}${locked ? ', locked' : ''}`}>
      <span className="node-orb">{locked ? <Lock size={18} /> : level}</span>
      <span className="node-label">{locked ? 'Locked' : stars ? `${stars} stars` : level === 1 ? 'First glow' : 'Ready'}</span>
    </button>
  );
}

function HomeScreen({ progress, onGame, onSettings, onGift }: { progress: SavedProgress; onGame: (level?: number) => void; onSettings: () => void; onGift: () => boolean }) {
  const latest = progress.highestUnlocked;
  const mapLevels = Array.from({ length: Math.max(10, Math.min(16, latest + 3)) }, (_, index) => index + 1);
  const mapRows = Math.ceil(mapLevels.length / 4);
  const mapPosition = (level: number) => {
    const row = Math.floor((level - 1) / 4);
    const slot = (level - 1) % 4;
    const order = row % 2 === 0 ? slot : 3 - slot;
    return { left: `${14 + order * 24}%`, top: `${10 + row * (78 / Math.max(1, mapRows - 1))}%` };
  };
  const pathPoints = mapLevels.map((level) => {
    const position = mapPosition(level);
    return `${parseFloat(position.left) * 4},${parseFloat(position.top) * 3.3}`;
  }).join(' ');
  const [notice, setNotice] = useState('');
  const giftClaimed = progress.dailyGiftClaimedOn === todayKey();
  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2200);
  };
  return (
    <div className="screen game-shell">
      <div className="world-bg" style={{ backgroundImage: `url(${ASSET}${backgrounds[0]})` }} />
      <Topbar onSettings={onSettings} />
      <main className="home-content stagger">
        <section className="welcome-card">
          <div><p className="eyebrow">The first spark</p><h1>Good morning,<br /><span className="text-cyan-200">stargazer.</span></h1><p>The Lumens are humming your name.</p></div>
          <div className="energy-pill"><span className="energy-core" /> {progress.coins.toLocaleString()}</div>
        </section>
        <section className="map-card" aria-label="Level map">
          <div className="map-scene" style={{ minHeight: `${Math.max(100, mapRows * 25)}%` }}>
            <svg className="map-path" viewBox="0 0 400 330" preserveAspectRatio="none" aria-hidden="true"><polyline points={pathPoints} fill="none" stroke="rgba(255,242,154,.6)" strokeWidth="3" strokeDasharray="6 8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            {mapLevels.map((level) => {
              const position = mapPosition(level);
              const unlocked = level <= progress.highestUnlocked;
              return <MapNode key={level} level={level} left={position.left} top={position.top} locked={!unlocked} current={level === latest} stars={progress.completed[level]?.stars} onClick={() => unlocked ? onGame(level) : showNotice('Complete the previous glow to unlock this level')} />;
            })}
          </div>
        </section>
        <div className="home-actions">
          <button className="btn-primary wide-action" onClick={() => onGame(latest)}><Sparkles size={18} /> Continue to Level {latest} <ChevronRight size={18} /></button>
          <button className="glass btn-ghost flex items-center justify-center gap-2" onClick={() => showNotice(onGift() ? '250 shards added to your pocket' : 'Your daily gift is already claimed')}><Gift size={17} /> {giftClaimed ? 'Gift claimed' : 'Daily gift'}</button>
          <button className="glass btn-ghost flex items-center justify-center gap-2" onClick={onSettings}><SettingsIcon size={17} /> Settings</button>
        </div>
        <section className="glass mini-panel"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-yellow-300/20 text-yellow-200"><Crown size={20} /></div><div><strong>Star trail</strong><span className="block">Complete a level to fill your constellation</span></div></div><span>{Object.keys(progress.completed).length} lit</span></section>
      </main>
      {notice && <div className="game-toast" role="status">{notice}</div>}
    </div>
  );
}

function LumenTile({ tile, index, selected, popping, fresh, onPointerDown }: { tile: Tile; index: number; selected: boolean; popping: boolean; fresh?: boolean; onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void }) {
  const artwork = tile.fusion ? fusionOrbAsset : lumenAssets[tile.color][selected ? 'opened' : 'closed'];
  return (
    <button data-index={index} className={`tile ${selected ? 'selected' : ''} ${popping ? 'popping' : ''} ${fresh ? 'fresh-tile' : ''} ${tile.fusion ? 'fusion-tile' : ''}`} onPointerDown={onPointerDown} aria-label={`${tile.fusion ? 'Prism Vortex, ' : ''}${tile.color} Lumen`}>
      <img className={tile.fusion ? 'fusion-art' : 'lumen-art'} src={`${ASSET}${artwork}`} alt="" draggable="false" />
    </button>
  );
}

const trailColors: Record<LumenColor, string> = {
  solar: '#ffe56f',
  verdant: '#7ef4b0',
  terra: '#ff9a65',
  nova: '#ff8ccc',
  cosmic: '#c29aff',
  aether: '#69eaff',
  blaze: '#ff6f8d',
};

function ChainTrail({ selected, activeType }: { selected: number[]; activeType: LumenColor | null }) {
  if (!selected.length || !activeType) return null;
  const points = selected.map((index) => `${(colOf(index) + 0.5) * (100 / BOARD_SIZE)},${(rowOf(index) + 0.5) * (100 / BOARD_SIZE)}`).join(' ');
  const last = selected[selected.length - 1];
  return (
    <svg className="chain-trail" viewBox="0 0 100 100" preserveAspectRatio="none" data-length={selected.length} aria-hidden="true">
      {selected.length > 1 && <polyline points={points} fill="none" stroke={trailColors[activeType]} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" opacity=".18" />}
      {selected.length > 1 && <polyline points={points} fill="none" stroke={trailColors[activeType]} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" opacity=".86" />}
      {selected.map((index) => <circle key={index} className="trail-node" cx={(colOf(index) + 0.5) * (100 / BOARD_SIZE)} cy={(rowOf(index) + 0.5) * (100 / BOARD_SIZE)} r="3.1" fill={trailColors[activeType]} />)}
      <circle className="touch-pulse" cx={(colOf(last) + 0.5) * (100 / BOARD_SIZE)} cy={(rowOf(last) + 0.5) * (100 / BOARD_SIZE)} r="7" fill="none" stroke={trailColors[activeType]} strokeWidth="1.2" />
    </svg>
  );
}

function BoosterIcon({ kind }: { kind: BoosterKind }) {
  if (kind === 'shuffle') {
    return <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M6 9h4c5 0 6 14 12 14h4M6 23h4c2.3 0 3.6-3 4.7-5.8M19.2 9.7C20.2 7.7 21.5 9 23 9h3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /><path d="m23 6 4 3-4 3M23 20l4 3-4 3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  }
  if (kind === 'bomb') {
    return <svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="15" cy="18" r="8.5" fill="none" stroke="currentColor" strokeWidth="2.4" /><path d="M20.5 11.5 24 8M23.5 7.5l2 2M14 6v3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /><circle cx="12.5" cy="15.5" r="1.5" fill="currentColor" /></svg>;
  }
  return <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 4v6M16 22v6M4 16h6M22 16h6M7.5 7.5l4 4M20.5 20.5l4 4M24.5 7.5l-4 4M11.5 20.5l-4 4" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /><circle cx="16" cy="16" r="5.5" fill="none" stroke="currentColor" strokeWidth="2.4" /></svg>;
}

function Booster({ kind, onClick, disabled }: { kind: BoosterKind; onClick: () => void; disabled?: boolean }) {
  const descriptions: Record<BoosterKind, string> = { shuffle: 'cross the glow', bomb: 'clear a pocket', burst: 'send a wave' };
  return <button className="booster" onClick={onClick} disabled={disabled} aria-label={`${kind}, costs ${boosterPrices[kind]} shards`}><span className="booster-icon"><BoosterIcon kind={kind} /></span><span><b>{kind[0].toUpperCase() + kind.slice(1)}</b><small>{boosterPrices[kind]} shards · {descriptions[kind]}</small></span></button>;
}

function GameScreen({ levelNumber, progress, onBack, onSettings, onComplete, onCoinsChange, onNextLevel }: { levelNumber: number; progress: SavedProgress; onBack: () => void; onSettings: () => void; onComplete: (score: number, stars: number) => void; onCoinsChange: (coins: number) => void; onNextLevel: () => void }) {
  const config = useMemo(() => levelConfig(levelNumber), [levelNumber]);
  const [board, setBoard] = useState<Tile[]>(() => makeBoard(levelNumber));
  const [selected, setSelected] = useState<number[]>([]);
  const [popping, setPopping] = useState<number[]>([]);
  const [freshTiles, setFreshTiles] = useState<number[]>([]);
  const [score, setScore] = useState(0);
  const [moves, setMoves] = useState(config.moves);
  const [overlay, setOverlay] = useState<'complete' | 'fail' | 'pause' | null>(null);
  const [dragging, setDragging] = useState(false);
  const [activeType, setActiveType] = useState<LumenColor | null>(null);
  const [activeBooster, setActiveBooster] = useState<BoosterKind | null>(null);
  const [coins, setCoins] = useState(progress.coins);
  const [toast, setToast] = useState('');
  const [effect, setEffect] = useState<'pop' | 'vortex' | 'booster' | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const chainRef = useRef<number[]>([]);
  const chainDirectionRef = useRef<LineDirection | null>(null);
  const busyRef = useRef(false);
  const completionSentRef = useRef(false);
  const soundRef = useRef<ReturnType<typeof createSoundEngine> | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const effectTimerRef = useRef<number | null>(null);
  const freshTimerRef = useRef<number | null>(null);
  if (!soundRef.current) soundRef.current = createSoundEngine();

  const starsForScore = (value: number) => value >= config.targetScore ? 3 : value >= config.targetScore * 0.66 ? 2 : value >= config.targetScore * 0.33 ? 1 : 0;
  const stars = starsForScore(score);
  const progressPercent = Math.min(100, (score / config.targetScore) * 100);
  const play = (kind: SoundKind, intensity = 1) => {
    if (progress.sound) soundRef.current?.play(kind, intensity);
  };
  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(''), 1800);
  }, []);
  const scoreForChain = (length: number) => length === 3 ? 75 : length === 4 ? 160 : length === 5 ? 275 : 275 + (length - 5) * 110;

  const clearActiveChain = useCallback(() => {
    setSelected([]);
    chainRef.current = [];
    chainDirectionRef.current = null;
    setDragging(false);
    setActiveType(null);
  }, []);

  const performRemoval = useCallback((indices: number[], chainColor: LumenColor, bonus = 0, mode: 'pop' | 'vortex' | 'booster' = 'pop', spawnVortex = false) => {
    if (busyRef.current) return;
    busyRef.current = true;
    const uniqueIndices = [...new Set(indices)];
    setPopping(uniqueIndices);
    setEffect(mode);
    play(mode === 'vortex' ? 'special' : mode === 'booster' ? 'booster' : 'pop', Math.min(3, uniqueIndices.length / 3));
    if (effectTimerRef.current) window.clearTimeout(effectTimerRef.current);
    effectTimerRef.current = window.setTimeout(() => setEffect(null), mode === 'vortex' ? 720 : 460);
    window.setTimeout(() => {
      setBoard((current) => {
        const cleared = current.map((tile, index) => uniqueIndices.includes(index) ? null : tile);
        const result = collapseBoard(cleared, levelNumber, spawnVortex);
        setFreshTiles(result.refilled);
        if (freshTimerRef.current) window.clearTimeout(freshTimerRef.current);
        freshTimerRef.current = window.setTimeout(() => setFreshTiles([]), 720);
        play('gravity', Math.min(2, result.refilled.length / 5));
        return result.board;
      });
      setPopping([]);
      setScore((current) => current + bonus);
      window.setTimeout(() => { busyRef.current = false; }, 270);
    }, mode === 'vortex' ? 460 : 300);
  }, [levelNumber, play]);

  const activateVortex = useCallback((index: number, chainColor: LumenColor) => {
    if (busyRef.current) return;
    const centerRow = rowOf(index);
    const centerCol = colOf(index);
    const cleared = board.reduce<number[]>((indices, tile, cell) => {
      const distance = Math.hypot(rowOf(cell) - centerRow, colOf(cell) - centerCol);
      if (distance <= 2.25 || (distance <= 3.1 && tile.color === chainColor)) indices.push(cell);
      return indices;
    }, []);
    setMoves((current) => Math.max(0, current - 1));
    showToast('Prism Vortex released · nearby energy mixed');
    clearActiveChain();
    performRemoval(cleared, chainColor, 1350, 'vortex');
  }, [board, clearActiveChain, performRemoval, showToast]);

  const finishTurn = useCallback((chain: number[]) => {
    if (busyRef.current) return;
    const specialIndex = chain.find((index) => board[index]?.fusion);
    if (specialIndex !== undefined) {
      activateVortex(specialIndex, board[specialIndex]?.color ?? 'cosmic');
      return;
    }
    if (chain.length < 3) {
      if (chain.length > 0) showToast('Almost there · link one more Lumen');
      play('backtrack');
      clearActiveChain();
      return;
    }
    const chainColor = board[chain[0]].color;
    const extra: number[] = [];
    if (chain.length >= 6) {
      const center = chain[Math.floor(chain.length / 2)];
      const centerRow = rowOf(center);
      const centerCol = colOf(center);
      board.forEach((tile, index) => {
        if (!chain.includes(index) && Math.max(Math.abs(rowOf(index) - centerRow), Math.abs(colOf(index) - centerCol)) <= 1 && tile.color === chainColor) extra.push(index);
      });
    }
    const gained = scoreForChain(chain.length);
    const nextScore = score + gained;
    setMoves((current) => Math.max(0, current - 1));
    if (chain.length >= 6) showToast(`${chain.length}-Lumen surge · cross-pulse cleared`);
    else if (chain.length === 5) showToast('Five-link charge · a Prism Vortex may appear');
    else if (chain.length === 4) showToast('Four-link glow · brighter reward');
    play('link', Math.min(3, chain.length / 2));
    performRemoval([...chain, ...extra], chainColor, gained, 'pop', config.canSpawnVortex && chain.length >= 5);
    clearActiveChain();
    if (nextScore >= config.targetScore && !completionSentRef.current) {
      completionSentRef.current = true;
      window.setTimeout(() => {
        play('win');
        setOverlay('complete');
        onComplete(nextScore, starsForScore(nextScore));
      }, 760);
    } else if (moves <= 1) {
      window.setTimeout(() => {
        play('lose');
        setOverlay('fail');
      }, 820);
    }
  }, [activateVortex, board, clearActiveChain, config.canSpawnVortex, config.targetScore, moves, onComplete, play, score, showToast]);

  const addToChain = useCallback((index: number) => {
    if (busyRef.current || activeBooster) return;
    const tile = board[index];
    if (!tile || !activeType) return;
    const chain = chainRef.current;
    if (chain.length > 1 && chain[chain.length - 2] === index) {
      chain.pop();
      chainDirectionRef.current = chain.length > 1 ? directionBetween(chain[0], chain[1]) : null;
      setSelected([...chain]);
      play('backtrack');
      return;
    }
    if (chain.includes(index) || tile.color !== activeType) return;
    const direction = chainDirectionRef.current ?? directionBetween(chain[chain.length - 1], index);
    if (!direction || !lineStep(chain[chain.length - 1], index, direction)) return;
    if (chain.length === 1) chainDirectionRef.current = direction;
    chain.push(index);
    setSelected([...chain]);
    play('link', Math.min(3, chain.length / 2));
  }, [activeBooster, activeType, board, play]);

  const applyBooster = (kind: BoosterKind, index: number) => {
    const price = boosterPrices[kind];
    if (coins < price) {
      showToast('Not enough shards yet');
      setActiveBooster(null);
      return;
    }
    const nextCoins = coins - price;
    setCoins(nextCoins);
    onCoinsChange(nextCoins);
    setActiveBooster(null);
    if (kind === 'shuffle') {
      const shuffled = [...board];
      for (let cursor = shuffled.length - 1; cursor > 0; cursor -= 1) {
        const swap = Math.floor(Math.random() * (cursor + 1));
        [shuffled[cursor], shuffled[swap]] = [shuffled[swap], shuffled[cursor]];
      }
      setBoard(hasPlayableChain(shuffled) ? shuffled : makeBoard(levelNumber));
      play('booster');
      showToast('The board rearranged · a path remains');
      return;
    }
    const centerRow = rowOf(index);
    const centerCol = colOf(index);
    const radius = kind === 'bomb' ? 1 : 2;
    const cleared = board.reduce<number[]>((indices, tile, cell) => {
      const distance = kind === 'bomb'
        ? Math.max(Math.abs(rowOf(cell) - centerRow), Math.abs(colOf(cell) - centerCol))
        : Math.hypot(rowOf(cell) - centerRow, colOf(cell) - centerCol);
      if (distance <= radius) indices.push(cell);
      return indices;
    }, []);
    performRemoval(cleared, board[index]?.color ?? 'solar', kind === 'bomb' ? 450 : 900, 'booster');
    showToast(kind === 'bomb' ? 'Pulse Bomb cleared a pocket' : 'Burst Wave released');
  };

  const selectBooster = (kind: BoosterKind) => {
    if (busyRef.current) return;
    if (coins < boosterPrices[kind]) {
      showToast('Not enough shards yet');
      return;
    }
    if (kind === 'shuffle') {
      applyBooster(kind, 0);
      return;
    }
    setActiveBooster((current) => current === kind ? null : kind);
    showToast(activeBooster === kind ? 'Tool holstered' : `Tap a Lumen to aim your ${kind}`);
  };

  const resetGame = () => {
    busyRef.current = false;
    completionSentRef.current = false;
    clearActiveChain();
    setBoard(makeBoard(levelNumber));
    setSelected([]);
    setPopping([]);
    setFreshTiles([]);
    setScore(0);
    setMoves(config.moves);
    setActiveBooster(null);
    setOverlay(null);
    showToast('A fresh glow is ready');
  };

  const onTilePointerDown = (index: number, event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    soundRef.current?.unlock();
    if (activeBooster) {
      applyBooster(activeBooster, index);
      return;
    }
    if (busyRef.current || !board[index]) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    chainRef.current = [index];
    chainDirectionRef.current = null;
    setSelected([index]);
    setActiveType(board[index].color);
    setDragging(true);
    play('wake');
  };

  const onBoardPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging || activeBooster) return;
    const element = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-index]') as HTMLElement | null;
    let index = element?.dataset.index === undefined ? undefined : Number(element.dataset.index);
    if (index === undefined) {
      const grid = boardRef.current?.querySelector('.board');
      const rect = grid?.getBoundingClientRect();
      if (rect && rect.width > 0 && rect.height > 0) {
        const col = Math.max(0, Math.min(BOARD_SIZE - 1, Math.round(((event.clientX - rect.left) / rect.width) * BOARD_SIZE - 0.5)));
        const row = Math.max(0, Math.min(BOARD_SIZE - 1, Math.round(((event.clientY - rect.top) / rect.height) * BOARD_SIZE - 0.5)));
        index = row * BOARD_SIZE + col;
      }
    }
    if (index !== undefined) addToChain(index);
  };

  useEffect(() => {
    const release = () => {
      if (dragging) finishTurn(chainRef.current);
    };
    window.addEventListener('pointerup', release);
    return () => window.removeEventListener('pointerup', release);
  }, [dragging, finishTurn]);

  useEffect(() => {
    if (score < config.targetScore || completionSentRef.current || overlay) return;
    completionSentRef.current = true;
    window.setTimeout(() => {
      play('win');
      setOverlay('complete');
      onComplete(score, starsForScore(score));
    }, 700);
  }, [config.targetScore, onComplete, overlay, play, score]);

  useEffect(() => () => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    if (effectTimerRef.current) window.clearTimeout(effectTimerRef.current);
    if (freshTimerRef.current) window.clearTimeout(freshTimerRef.current);
    soundRef.current?.dispose();
  }, []);

  return (
    <div className="screen game-shell">
      <div className="world-bg" style={{ backgroundImage: `url(${ASSET}${backgrounds[Math.min(backgrounds.length - 1, Math.floor((levelNumber - 1) / 2))]})`, opacity: .28 }} />
      <Topbar onBack={onBack} onSettings={onSettings} label={config.world.toUpperCase()} />
      <main className="game-content">
        <section className="level-heading"><div><h1>Level {levelNumber} <span className="text-cyan-200">·</span> {config.title}</h1><p>{activeBooster ? `Choose a cell for your ${activeBooster}` : config.lesson}</p></div><button className="pause-btn" onClick={() => { clearActiveChain(); setActiveBooster(null); setOverlay('pause'); }} aria-label="Pause game"><Pause size={18} fill="currentColor" /></button></section>
        <section className="stats-row">
          <div className="stat-box"><div className="stat-label">Target score</div><div className="stat-value">{config.targetScore.toLocaleString()}</div><div className="progress-track milestone-track"><i style={{ width: `${progressPercent}%` }} /><span className={stars >= 1 ? 'milestone on' : 'milestone'} style={{ left: '33%' }}>★</span><span className={stars >= 2 ? 'milestone on' : 'milestone'} style={{ left: '66%' }}>★</span><span className={stars >= 3 ? 'milestone on' : 'milestone'} style={{ left: '100%' }}>★</span></div><small className="score-readout">{score.toLocaleString()} glow</small></div>
          <div className="stat-box"><div className="stat-label">Stars</div><div className="stars" aria-label={`${stars} stars`}>{[1, 2, 3].map((star) => <Star key={star} className={stars >= star ? 'star on' : 'star'} fill="currentColor" size={18} />)}</div><div className="stat-note">33 · 66 · 100%</div></div>
          <div className="stat-box"><div className="stat-label">Moves remaining</div><div className="stat-value text-yellow-200">{moves}</div><div className="stat-note">Make it glow</div></div>
        </section>
        {levelNumber <= 2 && <div className="play-guide"><span className="guide-step"><b>1</b> Touch</span><span className="guide-line" /><span className="guide-step"><b>2</b> Drag straight</span><span className="guide-line" /><span className="guide-step"><b>3</b> Release</span></div>}
        <section className={`board-wrap ${dragging ? 'is-linking' : ''} ${effect ? `effect-${effect}` : ''}`} ref={boardRef} onPointerMove={onBoardPointerMove}>
          <div className="board">
            {board.map((tile, index) => <LumenTile key={`${tile.id}-${index}`} tile={tile} index={index} selected={selected.includes(index)} popping={popping.includes(index)} fresh={freshTiles.includes(index)} onPointerDown={(event) => onTilePointerDown(index, event)} />)}
          </div>
          <ChainTrail selected={selected} activeType={activeType} />
          {effect && <div className="board-effect" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>}
          {dragging && selected.length > 1 && <div className="chain-count"><b>{selected.length}</b><small>{selected.length >= 5 ? 'charge' : 'link'}</small></div>}
        </section>
        <p className="hint"><Sparkles size={12} className="mr-1 inline text-yellow-200" /> {selected.length >= 2 ? `${selected.length} linked · ${selected.length >= 3 ? 'release to pop' : 'find one more'}` : 'Drag through matching Lumens to link 3 or more'}</p>
        <div className="booster-row">
          <Booster kind="shuffle" onClick={() => selectBooster('shuffle')} disabled={busyRef.current} />
          <Booster kind="bomb" onClick={() => selectBooster('bomb')} disabled={busyRef.current} />
          <Booster kind="burst" onClick={() => selectBooster('burst')} disabled={busyRef.current} />
        </div>
        <div className="currency-line"><span><span className="shard-icon" /> {coins.toLocaleString()} shards</span><span>{activeBooster ? 'Tap a Lumen to aim' : 'Prism Vortexes appear after 5-link charges'}</span></div>
      </main>
      {toast && <div className="game-toast" role="status">{toast}</div>}
      {overlay && <ResultOverlay type={overlay} score={score} target={config.targetScore} stars={stars} onPrimary={overlay === 'complete' ? onNextLevel : overlay === 'fail' ? resetGame : () => setOverlay(null)} onSecondary={overlay === 'complete' ? resetGame : overlay === 'pause' ? onBack : undefined} onClose={() => setOverlay(null)} />}
    </div>
  );
}

function ResultOverlay({ type, score, target, stars, onPrimary, onSecondary, onClose }: { type: 'complete' | 'fail' | 'pause'; score: number; target: number; stars: number; onPrimary: () => void; onSecondary?: () => void; onClose: () => void }) {
  const won = type === 'complete';
  const paused = type === 'pause';
  return <div className="overlay"><div className="modal"><div className="success-orb">{won ? <Sparkles size={34} /> : paused ? <Pause size={31} fill="currentColor" /> : <RotateCcw size={31} />}</div><h2>{won ? 'Glow-getter!' : paused ? 'Glow paused' : 'The Lumens went shy'}</h2><p>{won ? 'That chain lit up the whole meadow. Your constellation is shining.' : paused ? 'Your board is waiting exactly where you left it.' : 'Every little light gets another chance. Try a shorter, brighter chain.'}</p>{won && <div className="result-row"><div className="result-pill"><b>{score.toLocaleString()}</b><span>of {target.toLocaleString()}</span></div><div className="result-pill"><b className="result-stars">{[1, 2, 3].map((star) => <Star key={star} className={stars >= star ? 'star on' : 'star'} fill="currentColor" size={16} />)}</b><span>stars</span></div></div>}<button className="btn-primary flex items-center justify-center gap-2" onClick={onPrimary}>{won ? <>Next level <ChevronRight size={17} /></> : paused ? <>Resume glow <Play size={17} fill="currentColor" /></> : <>Try again <RotateCcw size={17} /></>}</button>{onSecondary && <button className="btn-ghost" onClick={onSecondary}>{won ? 'Replay level' : 'Leave level'} <ArrowLeft size={16} /></button>}<button className="btn-ghost" onClick={onClose}>{won ? 'Keep exploring' : paused ? 'Close pause' : 'Keep playing'}</button></div></div>;
}

function SettingsScreen({ progress, onChange, onBack }: { progress: SavedProgress; onChange: (next: SavedProgress) => void; onBack: () => void }) {
  const [info, setInfo] = useState<'how' | 'about' | null>(null);
  return <div className="screen game-shell"><Topbar onBack={onBack} label="YOUR POCKET" /><main className="settings"><p className="eyebrow">A small constellation of controls</p><h1>Settings</h1><p>Make the meadow feel like yours.</p><div className="setting-group"><div className="setting-row"><span className="setting-icon">{progress.sound ? <Volume2 size={17} /> : <VolumeX size={17} />}</span><div className="setting-copy"><b>Sound effects</b><span>Every pop, sparkle, and tiny wake-up</span></div><button className={`switch ${progress.sound ? 'on' : ''}`} onClick={() => onChange({ ...progress, sound: !progress.sound })} aria-label="Toggle sound"><i /></button></div><div className="setting-row"><span className="setting-icon"><Music2 size={17} /></span><div className="setting-copy"><b>Meadow music</b><span>Soft loops for longer journeys</span></div><button className={`switch ${progress.music ? 'on' : ''}`} onClick={() => onChange({ ...progress, music: !progress.music })} aria-label="Toggle music"><i /></button></div></div><div className="setting-group"><button className="setting-row setting-button" onClick={() => setInfo(info === 'how' ? null : 'how')}><span className="setting-icon"><CircleHelp size={17} /></span><span className="setting-copy"><b>How to play</b><span>Link one straight line in any direction</span></span><ChevronRight size={17} className="text-white/50" /></button><button className="setting-row setting-button" onClick={() => setInfo(info === 'about' ? null : 'about')}><span className="setting-icon"><Gem size={17} /></span><span className="setting-copy"><b>About Lumen Pop</b><span>Made for curious thumbs and bright minds</span></span><ChevronRight size={17} className="text-white/50" /></button></div>{info === 'how' && <div className="info-panel"><b>How to play</b><span>Press and drag through 3 or more matching Lumens in a single horizontal, vertical, or diagonal line. Release to pop them, then watch gravity refill the board.</span></div>}{info === 'about' && <div className="info-panel"><b>About Lumen Pop</b><span>A tiny constellation game about waking friendly Lumens, building bright chains, and finding a little wonder in every move.</span></div>}<button className="btn-soft mt-4 flex items-center gap-2" onClick={onBack}><Home size={16} /> Return to meadow</button></main></div>;
}

function App() {
  const [screen, setScreen] = useState<Screen>('loading');
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState<SavedProgress>(() => readProgress());
  const [level, setLevel] = useState(1);
  const finishLoading = useCallback(() => {
    if (!ready) { setReady(true); setScreen('start'); }
  }, [ready]);
  const updateProgress = (next: SavedProgress) => { setProgress(next); writeProgress(next); };
  const completeLevel = (score: number, stars: number) => {
    const existing = progress.completed[level];
    const next: SavedProgress = {
      ...progress,
      highestUnlocked: Math.max(progress.highestUnlocked, level + 1),
      coins: progress.coins + 100 + stars * 25,
      completed: { ...progress.completed, [level]: { stars: Math.max(stars, existing?.stars ?? 0), bestScore: Math.max(score, existing?.bestScore ?? 0) } },
    };
    updateProgress(next);
  };
  const claimDailyGift = () => {
    if (progress.dailyGiftClaimedOn === todayKey()) return false;
    updateProgress({ ...progress, coins: progress.coins + 250, dailyGiftClaimedOn: todayKey() });
    return true;
  };
  const openLevel = (nextLevel?: number) => {
    const destination = nextLevel ?? progress.highestUnlocked;
    setLevel(destination);
    setScreen('level-loading');
  };
  const renderScreen = () => {
    if (screen === 'loading') return <LoadingScreen onDone={finishLoading} />;
    if (screen === 'start') return <StartScreen onStart={() => setScreen('home')} />;
    if (screen === 'settings') return <SettingsScreen progress={progress} onChange={updateProgress} onBack={() => setScreen('home')} />;
    if (screen === 'level-loading') return <LevelLoadingScreen level={level} onReady={() => setScreen('game')} />;
    if (screen === 'game') return <GameScreen key={level} levelNumber={level} progress={progress} onBack={() => setScreen('home')} onSettings={() => setScreen('settings')} onComplete={completeLevel} onCoinsChange={(coins) => updateProgress({ ...progress, coins })} onNextLevel={() => openLevel(level + 1)} />;
    return <HomeScreen progress={progress} onGame={openLevel} onSettings={() => setScreen('settings')} onGift={claimDailyGift} />;
  };
  return <><MusicLayer screen={screen} enabled={progress.music} />{renderScreen()}</>;
}

export default App;