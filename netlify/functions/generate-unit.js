exports.handler = async function(event, context) {
  try {
    // 1. Get the topic and level from the website
    // We parse the incoming data from your HTML form
    if (!event.body) {
      return { statusCode: 400, body: "Missing body" };
    }
    const { topic, level } = JSON.parse(event.body);
    
    // 2. Get your API Key from Netlify Environment Variables
    const apiKey = process.env.GEMINI_API_KEY;

    // 3. The Strict Instruction for Gemini (The "Brain")
    const prompt = `
      Act as an expert ESL textbook writer. Create a lesson unit for level ${level} on the topic: "${topic}".
      You must output ONLY valid JSON. No markdown formatting. No extra text.
      
      Structure the JSON exactly like this:
      {
        "title": "Unit Title",
        "reading": { 
          "headline": "Catchy Headline", 
          "text": "Write a 200-word article suitable for this level." 
        },
        "vocabulary": [ 
          {"word": "Target Word", "definition": "Simple definition"} 
        ],
        "quiz": [ 
          {
            "question": "Comprehension question?", 
            "options": ["Option A", "Option B", "Option C"], 
            "answer": "The correct option text"
          } 
        ]
      }
    `;

    // 4. Call the Gemini API (UPDATED URL)
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
    
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const data = await response.json();

    // Check if Gemini actually sent a valid response
    if (!data.candidates || data.candidates.length === 0) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Gemini sent no data", details: data })
      };
    }
    
    // 5. Clean the result (Gemini sometimes adds '''json markers)
    let rawText = data.candidates[0].content.parts[0].text;
    // Remove markdown code blocks if present
    let cleanJson = rawText.replace(/```json/g, "").replace(/```/g, "").trim();

    // 6. Return the clean JSON to your website
    return {
      statusCode: 200,
      body: cleanJson
    };

  } catch (error) {
    console.error("Function Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};