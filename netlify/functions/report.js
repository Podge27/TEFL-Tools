const { GoogleGenerativeAI } = require("@google/generative-ai");
// const { Resend } = require("resend"); // <--- UNCOMMENT WHEN PAID

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

exports.handler = async function(event, context) {
  // 1. FAST HANDSHAKE: Handle the pre-flight check instantly
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "ok" };

  try {
    const { studentName, studentEmail, answers } = JSON.parse(event.body);

    // 2. CRASH PREVENTION: Only wake up the AI inside the function
    if (!process.env.GEMINI_API_KEY) {
        throw new Error("API Key is missing from Netlify Environment Variables");
    }
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    // const resend = new Resend(process.env.RESEND_API_KEY); // <--- UNCOMMENT WHEN PAID
    
    // 3. PROFESSIONAL CONFIG: Using the stable Flash model
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // 4. THE "DIRECTOR" PROMPT (Optimized for Depth + Speed)
    // We do NOT ask for a raw table here, because your HTML file now builds that instantly.
    // We focus the AI entirely on the "Professional Analysis" to make it worth the money.
    const prompt = `
      Act as a Director of Studies. Analyse this English placement test for a native Spanish speaker.
      Student: ${studentName}
      Answers: ${JSON.stringify(answers)}
      
      TASK: 
      1. Determine their exact CEFR level (A1, A2, B1, B2, C1).
      2. Write a professional, diagnostic HTML report.
      3. Focus specifically on L1 Interference (Spanish-to-English errors).
      
      OUTPUT STRICTLY JSON: 
      {
        "level": "B1", 
        "report": "HTML string..."
      }

      HTML REPORT STRUCTURE (Use <h3> and <h4> tags):
      <h3>Diagnostic Analysis</h3>
      <p>A professional summary (approx 60 words) assessing their grammar control and vocabulary range.</p>
      
      <h4>Key Areas for Improvement</h4>
      <ul>
        <li><strong>[Theme 1]:</strong> Identify a specific recurring error (e.g. 'Subject-Verb Agreement' or 'False Friends'). Quote an example from their test and explain the correction.</li>
        <li><strong>[Theme 2]:</strong> Identify a second key error pattern, specifically noting if it relates to Spanish L1 interference.</li>
      </ul>
      <p><em>Note: Full error logs are attached below.</em></p>
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text().replace(/```json|```/g, "").trim();
    const aiData = JSON.parse(responseText);

    /* --- EMAIL SYSTEM (Saved for Phase 2) ---
    if (process.env.RESEND_API_KEY) {
       // Email to STUDENT
       await resend.emails.send({
           from: 'Academy <tests@yourdomain.com>',
           to: studentEmail,
           subject: `Your English Level: ${aiData.level}`,
           html: aiData.report
       });

       // Email to ADMIN
       await resend.emails.send({
           from: 'Academy <tests@yourdomain.com>',
           to: 'YOUR_EMAIL@gmail.com',
           subject: `New Lead: ${studentName} (${aiData.level})`,
           html: `<p>Check the portal for full details.</p>`
       });
    }
    ------------------------------------------- */

    // 5. SUCCESS: Return the professional analysis to the website
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        level: aiData.level, 
        report: aiData.report 
      })
    };

  } catch (error) {
    console.error("Function Error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Report generation failed: " + error.message })
    };
  }
};