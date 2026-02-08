
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function parseScript(rawText: string) {
  const prompt = `Act as a professional script supervisor. Analyze the following theatrical or film script text and extract all character lines and stage directions.

Requirements:
1. Extract every single line of dialogue.
2. Character names must be converted to ALL CAPS (e.g., "Hamlet" -> "HAMLET").
3. Stage directions (remarks) must preserve their original casing and be kept in parentheses (e.g., "(happily)" remains "(happily)").
4. Stage directions must be separate from the text body.
5. If a block of text is only a stage direction without a specific character, assign it to a character named "STAGE".
6. Do not merge adjacent lines from different characters.
7. Support both theater format (Character: Text) and film format (Character on a new line).

Input Script Text:
${rawText}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              character: { 
                type: Type.STRING,
                description: "The name of the character in ALL CAPS."
              },
              text: { 
                type: Type.STRING,
                description: "The dialogue text of the line."
              },
              direction: { 
                type: Type.STRING, 
                description: "Stage direction or remark in parentheses, if any exists for this line." 
              }
            },
            required: ["character", "text"],
            propertyOrdering: ["character", "direction", "text"]
          }
        }
      }
    });

    const result = response.text;
    if (!result) {
      throw new Error("Model returned an empty response.");
    }

    const parsed = JSON.parse(result.trim());
    if (!Array.isArray(parsed)) {
      throw new Error("Model response is not an array.");
    }

    return parsed;
  } catch (error) {
    console.error("Gemini Parsing Error:", error);
    throw error;
  }
}
