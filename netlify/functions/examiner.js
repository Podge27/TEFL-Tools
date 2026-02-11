exports.handler = async function(event, context) {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  try {
    const { history, currentLevel } = JSON.parse(event.body);
    const apiKey = process.env.GEMINI_API_KEY;
    
    // The exact 2.5 Flash URL that works in your other program
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

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

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const data = await response.json();
    
    if (!data.candidates || !data.candidates[0].content) {
      throw new Error("AI response was empty. Check your API key in Netlify.");
    }

    let aiText = data.candidates[0].content.parts[0].text;
    
    // This scrubs off the ```json markers so the browser doesn't crash
    const cleanJson = aiText.replace(/```json|```/g, "").trim();

    return {
      statusCode: 200,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*" 
      },
      body: cleanJson
    };

  } catch (error) {
    console.error("Examiner Error:", error);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: "Brain failure", message: error.message }) 
    };
  }
};