// functions/quiz-generator.js
// This file runs on the Server. It does NOT know about HTML or "document".

exports.handler = async function(event, context) {
  // 1. Get the API Key from Netlify Settings
  const API_KEY = process.env.GEMINI_API_KEY;

  try {
    // 2. Parse what the user typed (Topic and Level)
    if (!event.body) {
        return { statusCode: 400, body: "Missing body" };
    }
    const { topic, level, type } = JSON.parse(event.body);

    // 3. The Strict Instructions for Gemini (The Prompt)
    const systemPrompt = `
      You are a strict JSON generator for a Cambridge English quiz app.
      Create a ${type} quiz for level ${level} about: "${topic}".
      
      RULES:
      1. Output ONLY valid JSON. No Markdown, no backticks.
      2. "answer" must be the NUMBER index of the correct option (0, 1, 2, or 3).
      3. "questions" must have exactly 5 items.
      4. Follow this exact structure:
      {
        "title": "Creative Title Here",
        "category": "${type}",
        "level": "${level}",
        "topic": "${topic}",
        "questions": [
          {
            "text": "Question text?",
            "options": ["A", "B", "C", "D"],
            "answer": 0,
            "explanation": "Why this is correct."
          }
        ]
      }
    `;

    // 4. Call Google Gemini 1.5 Pro
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: systemPrompt }] }]
      })
    });

    const data = await response.json();
    
    // Check if Gemini actually replied
    if (!data.candidates || data.candidates.length === 0) {
        return { statusCode: 500, body: JSON.stringify({ error: "Gemini didn't answer." }) };
    }

    // 5. Clean up the response (Gemini sometimes adds text around the JSON)
    let rawText = data.candidates[0].content.parts[0].text;
    // Remove markdown code blocks if present
    rawText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
    
    // 6. Send the clean JSON back to your website
    return {
      statusCode: 200,
      body: rawText
    };

  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};