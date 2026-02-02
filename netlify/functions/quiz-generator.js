// functions/quiz-generator.js
// USING MODEL: gemini-flash-latest (The 'Safe Mode' Alias)

exports.handler = async function(event, context) {
  const API_KEY = process.env.GEMINI_API_KEY;

  try {
    if (!event.body) {
        return { statusCode: 400, body: "Missing body" };
    }
    const { topic, level, type } = JSON.parse(event.body);

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

    // CHANGED MODEL TO 'gemini-flash-latest' 
    // This automatically picks the best available Flash model for your key
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: systemPrompt }] }]
      })
    });

    const data = await response.json();
    
    // ERROR LOGGING
    if (data.error) {
        return { statusCode: 500, body: JSON.stringify({ error: "Google Error: " + data.error.message }) };
    }

    if (!data.candidates || data.candidates.length === 0) {
        return { statusCode: 500, body: JSON.stringify({ error: "Gemini replied but gave no text.", details: data }) };
    }

    let rawText = data.candidates[0].content.parts[0].text;
    rawText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
    
    return {
      statusCode: 200,
      body: rawText
    };

  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: "Server Error: " + error.message }) };
  }
};