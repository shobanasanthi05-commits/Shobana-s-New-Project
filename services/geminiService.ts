
import { GoogleGenAI, Type } from "@google/genai";
import { GameTheme } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const getThemeFromAI = async (prompt: string): Promise<GameTheme> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Create a Flappy Bird game theme based on this description: "${prompt}". Provide colors in HEX format.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          birdColor: { type: Type.STRING },
          pipeColor: { type: Type.STRING },
          skyColor: { type: Type.STRING },
          groundColor: { type: Type.STRING },
          accentColor: { type: Type.STRING },
          description: { type: Type.STRING }
        },
        required: ["name", "birdColor", "pipeColor", "skyColor", "groundColor", "accentColor", "description"]
      }
    }
  });

  try {
    return JSON.parse(response.text.trim());
  } catch (e) {
    console.error("Failed to parse AI theme", e);
    throw e;
  }
};

export const getCommentary = async (score: number, highScore: number): Promise<string> => {
  const isNewHighScore = score > highScore && highScore > 0;
  const prompt = isNewHighScore 
    ? `The player just set a new high score of ${score}! Give a brief, funny, high-energy congratulation (max 15 words).`
    : score === 0 
    ? `The player died immediately at 0 points. Give a hilarious, savage roast (max 15 words).`
    : `The player scored ${score} points (High score: ${highScore}). Give a witty, slightly snarky comment about their performance (max 15 words).`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      systemInstruction: "You are a witty, slightly sarcastic arcade game announcer. Keep it very short and punchy."
    }
  });

  return response.text.trim();
};
