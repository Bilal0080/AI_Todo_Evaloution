
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const breakdownTask = async (taskText: string) => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Break down this task into 3-5 actionable subtasks: "${taskText}". For each subtask, provide a priority (low, medium, high) and a short estimated time (e.g., "15m", "1h").`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          subtasks: {
            type: Type.ARRAY,
            items: { 
              type: Type.OBJECT,
              properties: {
                text: { type: Type.STRING },
                priority: { type: Type.STRING, enum: ["low", "medium", "high"] },
                estimatedTime: { type: Type.STRING }
              },
              required: ["text", "priority", "estimatedTime"]
            }
          }
        },
        required: ["subtasks"]
      }
    }
  });
  
  try {
    const data = JSON.parse(response.text || '{"subtasks": []}');
    return data.subtasks as { text: string; priority: string; estimatedTime: string; }[];
  } catch (e) {
    console.error("Failed to parse AI response", e);
    return [];
  }
};

export const suggestScheduling = async (tasks: { id: string; text: string }[]) => {
  const taskListText = tasks.map(t => `ID: ${t.id}, Task: ${t.text}`).join('\n');
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Analyze these tasks and suggest priority, estimated time, and a logical time slot for each. Return the data mapped to the provided IDs.\n\nTasks:\n${taskListText}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            priority: { type: Type.STRING, enum: ["low", "medium", "high"] },
            estimatedTime: { type: Type.STRING },
            suggestedSlot: { type: Type.STRING }
          },
          required: ["id", "priority", "estimatedTime", "suggestedSlot"]
        }
      }
    }
  });

  try {
    return JSON.parse(response.text || '[]');
  } catch (e) {
    console.error("Failed to parse scheduling response", e);
    return [];
  }
};

export const getProjectInsights = async (tasks: any[]) => {
    const completed = tasks.filter(t => t.completed).length;
    const pending = tasks.length - completed;
    const prompt = `Analyze this todo list: ${JSON.stringify(tasks.map(t => t.text))}. 
    Completed: ${completed}, Pending: ${pending}. 
    Provide a 2-sentence executive summary and one "tip of the day" for productivity.`;
    
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt
    });
    return response.text;
};
