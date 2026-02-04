// functions/quiz-generator.js
// UPDATED: Strictly follows CEFR Levels for ESL Learners

exports.handler = async function(event, context) {
  const API_KEY = process.env.GEMINI_API_KEY;

  try {
    if (!event.body) {
        return { statusCode: 400, body: "Missing body" };
    }
    const { topic, level, type } = JSON.parse(event.body);

    // 1. DEFINE CEFR-SPECIFIC TONE RULES
    let toneInstruction = "";

    switch (level) {
        case 'kids':
            toneInstruction = "TARGET: Young ESL Learners (A1 Level). Use extremely basic vocabulary (animals, colors, numbers, simple verbs). Use short, simple sentences. Use emojis (🐶, 🍦) to make it fun. AVOID complex grammar.";
            break;
        case 'A1':
            toneInstruction = "TARGET: Adult/Teen Beginners (CEFR A1). Use basic phrases, high-frequency vocabulary, and simple sentence structures. No idioms.";
            break;
        case 'A2':
            toneInstruction = "TARGET: Elementary Learners (CEFR A2). Use simple everyday language. Sentences should be direct.";
            break;
        case 'B1':
            toneInstruction = "TARGET: Intermediate Learners (CEFR B1). Use standard English with some variation in sentence structure. Topics can be descriptive.";
            break;
        case 'B2':
            toneInstruction = "TARGET: Upper Intermediate (CEFR B2). Use a wider range of vocabulary and some abstract ideas.";
            break;
        case 'C1':
        case 'C2':
            toneInstruction = "TARGET: Advanced/Proficiency (CEFR C1/C2). Use sophisticated vocabulary, idioms, nuances, and complex grammatical structures.";
            break;
        default:
            toneInstruction = "TARGET: Intermediate English Learners.";
    }

    // 2. THE SYSTEM PROMPT
    const systemPrompt = `
      You are an expert ESL/EFL Teacher creating a quiz for Spanish students.
      Create a ${type} quiz for level ${level} about: "${topic}".
      
      INSTRUCTIONS: ${toneInstruction}
      
      JSON RULES:
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
            "explanation": "Simple explanation of why."
          }
        ]
      }
    `;

    // USING MODEL: gemini-flash-latest
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