
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameTheme, GameState, Bird, Pipe } from './types';
import { 
  CANVAS_WIDTH, 
  CANVAS_HEIGHT, 
  BIRD_RADIUS, 
  PIPE_WIDTH, 
  PIPE_GAP, 
  PIPE_SPACING, 
  GRAVITY, 
  JUMP_STRENGTH, 
  PIPE_SPEED, 
  DEFAULT_THEME 
} from './constants';
import { getThemeFromAI, getCommentary } from './services/geminiService';

const App: React.FC = () => {
  const [theme, setTheme] = useState<GameTheme>(DEFAULT_THEME);
  const [gameState, setGameState] = useState<GameState>({
    score: 0,
    highScore: parseInt(localStorage.getItem('flappyHighScore') || '0'),
    status: 'START',
    commentary: "Ready to fly?",
    isAIThinking: false
  });
  
  const [themePrompt, setThemePrompt] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);

  // Game physics state
  const birdRef = useRef<Bird>({ y: CANVAS_HEIGHT / 2, velocity: 0, rotation: 0 });
  const pipesRef = useRef<Pipe[]>([]);
  const frameCountRef = useRef(0);

  const resetGame = useCallback(() => {
    birdRef.current = { y: CANVAS_HEIGHT / 2, velocity: 0, rotation: 0 };
    pipesRef.current = [];
    frameCountRef.current = 0;
    setGameState(prev => ({ ...prev, score: 0, status: 'PLAYING', commentary: "Good luck!" }));
  }, []);

  const handleJump = useCallback(() => {
    if (gameState.status === 'START') {
      resetGame();
    } else if (gameState.status === 'PLAYING') {
      birdRef.current.velocity = JUMP_STRENGTH;
    } else if (gameState.status === 'GAMEOVER' && !gameState.isAIThinking) {
      resetGame();
    }
  }, [gameState.status, gameState.isAIThinking, resetGame]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'ArrowUp' || e.code === 'Space') {
        e.preventDefault();
        handleJump();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleJump]);

  const gameOver = useCallback(async () => {
    setGameState(prev => {
      const isNewHigh = prev.score > prev.highScore;
      if (isNewHigh) localStorage.setItem('flappyHighScore', prev.score.toString());
      return {
        ...prev,
        status: 'GAMEOVER',
        highScore: isNewHigh ? prev.score : prev.highScore,
        isAIThinking: true
      };
    });

    try {
      const roast = await getCommentary(gameState.score, gameState.highScore);
      setGameState(prev => ({ ...prev, commentary: roast, isAIThinking: false }));
    } catch (err) {
      setGameState(prev => ({ ...prev, commentary: "Ouch! That hurt.", isAIThinking: false }));
    }
  }, [gameState.score, gameState.highScore]);

  const update = useCallback(() => {
    if (gameState.status !== 'PLAYING') return;

    // Bird physics
    birdRef.current.velocity += GRAVITY;
    birdRef.current.y += birdRef.current.velocity;
    birdRef.current.rotation = Math.min(Math.PI / 4, Math.max(-Math.PI / 4, birdRef.current.velocity * 0.1));

    // Collision check: Floor/Ceiling
    if (birdRef.current.y + BIRD_RADIUS > CANVAS_HEIGHT - 50 || birdRef.current.y - BIRD_RADIUS < 0) {
      gameOver();
      return;
    }

    // Pipes physics
    if (frameCountRef.current % Math.floor(PIPE_SPACING / PIPE_SPEED) === 0) {
      const minHeight = 50;
      const maxHeight = CANVAS_HEIGHT - 100 - PIPE_GAP - minHeight;
      const topHeight = Math.floor(Math.random() * maxHeight) + minHeight;
      pipesRef.current.push({ x: CANVAS_WIDTH, topHeight, passed: false });
    }

    pipesRef.current.forEach((pipe) => {
      pipe.x -= PIPE_SPEED;

      // Collision check: Pipes
      const birdX = 80; // Fixed visual X
      if (
        birdX + BIRD_RADIUS > pipe.x &&
        birdX - BIRD_RADIUS < pipe.x + PIPE_WIDTH &&
        (birdRef.current.y - BIRD_RADIUS < pipe.topHeight || birdRef.current.y + BIRD_RADIUS > pipe.topHeight + PIPE_GAP)
      ) {
        gameOver();
      }

      // Scoring
      if (!pipe.passed && pipe.x + PIPE_WIDTH < birdX) {
        pipe.passed = true;
        setGameState(prev => ({ ...prev, score: prev.score + 1 }));
      }
    });

    // Remove old pipes
    pipesRef.current = pipesRef.current.filter(p => p.x + PIPE_WIDTH > 0);
    frameCountRef.current++;
  }, [gameState.status, gameOver]);

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    // Clear
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Background
    ctx.fillStyle = theme.skyColor;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Pipes
    pipesRef.current.forEach(pipe => {
      ctx.fillStyle = theme.pipeColor;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      
      // Top pipe
      ctx.fillRect(pipe.x, 0, PIPE_WIDTH, pipe.topHeight);
      ctx.strokeRect(pipe.x, 0, PIPE_WIDTH, pipe.topHeight);
      
      // Bottom pipe
      ctx.fillRect(pipe.x, pipe.topHeight + PIPE_GAP, PIPE_WIDTH, CANVAS_HEIGHT - (pipe.topHeight + PIPE_GAP) - 50);
      ctx.strokeRect(pipe.x, pipe.topHeight + PIPE_GAP, PIPE_WIDTH, CANVAS_HEIGHT - (pipe.topHeight + PIPE_GAP) - 50);
    });

    // Ground
    ctx.fillStyle = theme.groundColor;
    ctx.fillRect(0, CANVAS_HEIGHT - 50, CANVAS_WIDTH, 50);
    ctx.fillStyle = theme.accentColor;
    ctx.fillRect(0, CANVAS_HEIGHT - 50, CANVAS_WIDTH, 5);

    // Bird
    ctx.save();
    ctx.translate(80, birdRef.current.y);
    ctx.rotate(birdRef.current.rotation);
    
    // Body
    ctx.fillStyle = theme.birdColor;
    ctx.beginPath();
    ctx.arc(0, 0, BIRD_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Eye
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(7, -5, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'black';
    ctx.beginPath();
    ctx.arc(9, -5, 2, 0, Math.PI * 2);
    ctx.fill();

    // Wing
    ctx.fillStyle = theme.accentColor;
    ctx.beginPath();
    ctx.ellipse(-5, 0, 8, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.restore();

    // HUD if playing
    if (gameState.status === 'PLAYING') {
      ctx.fillStyle = 'white';
      ctx.font = '30px "Press Start 2P"';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'black';
      ctx.shadowBlur = 4;
      ctx.fillText(gameState.score.toString(), CANVAS_WIDTH / 2, 80);
      ctx.shadowBlur = 0;
    }
  }, [theme, gameState]);

  const loop = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        update();
        draw(ctx);
      }
    }
    requestRef.current = requestAnimationFrame(loop);
  }, [update, draw]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(loop);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [loop]);

  const handleThemeChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!themePrompt) return;
    setGameState(prev => ({ ...prev, isAIThinking: true }));
    try {
      const newTheme = await getThemeFromAI(themePrompt);
      setTheme(newTheme);
      setThemePrompt('');
    } catch (err) {
      console.error(err);
    } finally {
      setGameState(prev => ({ ...prev, isAIThinking: false }));
    }
  };

  return (
    <div className="flex flex-col md:flex-row items-center justify-center min-h-screen p-4 gap-8 bg-zinc-900 overflow-auto">
      {/* Game Area */}
      <div className="relative group shadow-2xl rounded-xl overflow-hidden" onClick={handleJump}>
        <canvas 
          ref={canvasRef} 
          width={CANVAS_WIDTH} 
          height={CANVAS_HEIGHT}
          className="bg-sky-400 cursor-pointer border-4 border-zinc-800"
        />
        
        {/* Overlays */}
        {gameState.status === 'START' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 text-white p-6 text-center animate-pulse">
            <h1 className="text-2xl font-bold mb-4">FLAPPY AI</h1>
            <p className="text-sm">CLICK or SPACE to Jump</p>
            <p className="mt-8 text-xs text-zinc-300">Theme: {theme.name}</p>
          </div>
        )}

        {gameState.status === 'GAMEOVER' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 text-white p-6 text-center">
            <h2 className="text-3xl font-bold text-red-500 mb-2">GAME OVER</h2>
            <p className="text-xl mb-1">Score: {gameState.score}</p>
            <p className="text-xs text-zinc-400 mb-6">Best: {gameState.highScore}</p>
            
            <div className="bg-white/10 p-4 rounded-lg mb-8 max-w-[300px]">
              <p className="text-[10px] leading-relaxed italic">
                {gameState.isAIThinking ? "AI is judging you..." : `"${gameState.commentary}"`}
              </p>
            </div>

            <button 
              className="bg-green-500 hover:bg-green-400 px-6 py-3 rounded text-sm transition-transform active:scale-95"
              onClick={(e) => { e.stopPropagation(); resetGame(); }}
            >
              RETRY
            </button>
          </div>
        )}
      </div>

      {/* Control Panel */}
      <div className="w-full max-w-sm flex flex-col gap-6 text-white font-sans">
        <div className="bg-zinc-800 p-6 rounded-2xl shadow-xl border border-zinc-700">
          <h2 className="text-lg font-bold mb-2 flex items-center gap-2">
            <span className="text-xl">🎨</span> AI Theme Generator
          </h2>
          <p className="text-zinc-400 text-sm mb-4">
            Describe a vibe (e.g., "Cyberpunk", "Ocean", "Volcano") to change the game's look.
          </p>
          <form onSubmit={handleThemeChange} className="space-y-4">
            <input 
              type="text" 
              value={themePrompt}
              onChange={(e) => setThemePrompt(e.target.value)}
              placeholder="Describe your theme..."
              className="w-full bg-zinc-900 border border-zinc-600 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 transition-all"
              disabled={gameState.isAIThinking}
            />
            <button 
              type="submit"
              disabled={gameState.isAIThinking || !themePrompt}
              className={`w-full py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                gameState.isAIThinking ? 'bg-zinc-700' : 'bg-blue-600 hover:bg-blue-500 active:scale-95'
              }`}
            >
              {gameState.isAIThinking ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                  Generating...
                </>
              ) : "Update Theme"}
            </button>
          </form>
        </div>

        <div className="bg-zinc-800 p-6 rounded-2xl shadow-xl border border-zinc-700">
          <h2 className="text-lg font-bold mb-2 flex items-center gap-2">
            <span className="text-xl">🏆</span> Stats
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-zinc-900 p-3 rounded-lg border border-zinc-700">
              <p className="text-[10px] text-zinc-500 uppercase">Personal Best</p>
              <p className="text-xl font-mono text-yellow-400">{gameState.highScore}</p>
            </div>
            <div className="bg-zinc-900 p-3 rounded-lg border border-zinc-700">
              <p className="text-[10px] text-zinc-500 uppercase">Current Theme</p>
              <p className="text-xs truncate text-green-400">{theme.name}</p>
            </div>
          </div>
          <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
             <p className="text-[11px] text-blue-300 leading-tight">
               {theme.description}
             </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
