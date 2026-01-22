
export interface GameTheme {
  name: string;
  birdColor: string;
  pipeColor: string;
  skyColor: string;
  groundColor: string;
  accentColor: string;
  description: string;
}

export interface GameState {
  score: number;
  highScore: number;
  status: 'START' | 'PLAYING' | 'GAMEOVER';
  commentary: string;
  isAIThinking: boolean;
}

export interface Bird {
  y: number;
  velocity: number;
  rotation: number;
}

export interface Pipe {
  x: number;
  topHeight: number;
  passed: boolean;
}
