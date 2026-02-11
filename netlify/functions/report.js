const { GoogleGenerativeAI } = require("@google/generative-ai");

exports.handler = async function(event, context) {
  // 1. SECURITY: Only allow POST requests
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    // 2. INPUT: Get the chat log from the website
    const { history, studentName } = JSON.parse(event.body);

    // 3. AI CONFIG: Wake up Gemini 2.5
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // 4. THE PROMPT: "The Director of Studies"
    const prompt = `
      You are a strict Director of Studies at a British English language school.
      Analyze the following placement test history for a student.

      Student Name: ${studentName || "Guest"}
      Test History: ${JSON.stringify(history)}

      TASK:
      Write a concise, 3-sentence summary of this student's ability for their future teacher.
      
      GUIDELINES:
      1. Start specifically with the CEFR Level (e.g. "Assessment: Solid B2").
      2. Identify one specific grammar strength.
      3. Identify one specific area for improvement (fossilised errors).
      4. Use British English spelling (e.g. 'practise', 'programme').
      5. Write as if speaking to a colleague (professional tone).
    `;

    // 5. GENERATE
    const result = await model.generateContent(prompt);
    const reportText = result.response.text();

    // 6. RETURN: Send the clean paragraph back
    return {
      statusCode: 200,
      body: JSON.stringify({ report: reportText })
    };

  } catch (error) {
    console.error("Report Generation Error:", error);
    // Even if it fails, we return a fallback message so the test doesn't crash
    return {
      statusCode: 200, // Return 200 so the frontend keeps working
      body: JSON.stringify({ report: "Automated analysis unavailable. Please review raw answers." })
    };
  }
};