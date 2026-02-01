// functions/quiz-generator.js
// DIAGNOSTIC MODE: LIST AVAILABLE MODELS

exports.handler = async function(event, context) {
  const API_KEY = process.env.GEMINI_API_KEY;

  try {
    // We are IGNORING the user input for a moment.
    // We just want to ask Google what is on the menu.

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`, {
      method: "GET", // GET request just lists items
      headers: { "Content-Type": "application/json" }
    });

    const data = await response.json();

    // 1. If Google errors out (e.g. Region Lock), show that error
    if (data.error) {
        return { 
            statusCode: 500, 
            body: JSON.stringify({ error: "Google blocked us: " + data.error.message }) 
        };
    }

    // 2. If successful, filter for models that support "generateContent"
    // and just list their NAMES.
    const availableModels = data.models
        .filter(m => m.supportedGenerationMethods.includes("generateContent"))
        .map(m => m.name);

    if (availableModels.length === 0) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "No models found! Your API Key might be region-locked in the EU." })
        };
    }

    // 3. Send the list back to the user as an error message (so it pops up in the alert box)
    return {
      statusCode: 500, // We use 500 so your frontend shows the alert
      body: JSON.stringify({ 
          error: "AVAILABLE MODELS: " + availableModels.join(", ") 
      })
    };

  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: "Server Error: " + error.message }) };
  }
};