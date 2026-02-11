const { GoogleGenerativeAI } = require("@google/generative-ai");

exports.handler = async function(event, context) {
  // 1. SECURITY: Only allow POST requests
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { history, currentLevel } = JSON.parse(event.body);

    // 2. AI CONFIG: Initialize Gemini 2.5
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    // UPDATED: Using the 2.5 Flash model for speed
    const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash",
        generationConfig: { responseMimeType: "application/json" }
    });

    // 3. THE PROMPT
    const prompt = `
      You are a strict British Director of Studies at a language school.
      Your goal is to accurately determine the CEFR level of a student (A1 to C2).

      CONTEXT:
      - Current Estimated Level: ${currentLevel}
      - Test History (Last 5 answers): ${JSON.stringify(history.slice(-5))}

      TASK:
      Generate the NEXT multiple-choice question.
      1. If the last answer was WRONG, generate an EASIER question.
      2. If the last answer was CORRECT, generate a SLIGHTLY HARDER question.
      3. STRICTLY use British English spelling and vocabulary (e.g., 'lorry', 'colour', 'flat').
      4. Ensure the question tests a specific grammar point.

      OUTPUT:
      Return a JSON object with this exact structure:
      {
        "question": "The question text",
        "options": ["Option A", "Option B", "Option C", "Option D"],
        "correct_answer": "The text of the correct option",
        "level": "The CEFR level of this specific question (e.g. B1)",
        "grammar_point": "Short tag (e.g. Present Perfect)"
      }
    `;

    // 4. GENERATE
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: responseText
    };

  } catch (error) {
    console.error("Examiner Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "The examiner is having a tea break. Please try again." })
    };
  }
};