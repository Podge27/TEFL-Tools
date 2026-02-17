const { GoogleGenerativeAI } = require("@google/generative-ai");
const { createClient } = require("@supabase/supabase-js");
// const { Resend } = require("resend"); // <--- UNCOMMENT THIS WHEN PAID

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// const resend = new Resend(process.env.RESEND_API_KEY); // <--- UNCOMMENT THIS WHEN PAID

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

exports.handler = async function(event, context) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "ok" };

  try {
    // 1. RECEIVE DATA
    const { studentName, studentEmail, answers } = JSON.parse(event.body);

    // 2. AI CONFIG (Using your available 2.5 Flash model)
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // 3. THE FULL "DIRECTOR" PROMPT
    const prompt = `
      Act as a Director of Studies. Analyse this English placement test.
      Student: ${studentName} (${studentEmail})
      
      STUDENT ANSWERS: ${JSON.stringify(answers)}

      TASK:
      1. Determine the CEFR level (A1, A2, B1, B2, C1).
      2. Generate a strictly formatted HTML report. Do NOT use markdown.
      3. Identify 3 specific mistakes from the answers provided.

      OUTPUT JSON ONLY with this structure:
      {
        "level": "B1",
        "html_report": "HTML string here..."
      }

      STRUCTURE FOR HTML_REPORT:
      1. <h3>Summary</h3>: A 2-sentence overview of their level and key trait.
      2. <details><summary><strong>Click for Full Director's Analysis</strong></summary>
         <div style="margin-top:10px; border-left:3px solid #ccc; padding-left:10px;">
           <h4>Skill Breakdown</h4>
           <p>Comment on their general accuracy and vocabulary usage.</p>
           
           <h4>Error Analysis</h4>
           <ul>
             <li>List 3 specific mistakes found in the answers.</li>
             <li>Explain the error (e.g., "Used present simple instead of continuous").</li>
           </ul>
           
           <h4>Raw Answer Log</h4>
           <p><em>(AI: Please generate a simple HTML table of their wrong answers only)</em></p>
         </div>
         </details>
    `;

    // 4. GENERATE CONTENT
    const result = await model.generateContent(prompt);
    const responseText = result.response.text().replace(/```json|```/g, "").trim();
    const aiData = JSON.parse(responseText);

    // 5. SAVE TO SUPABASE
    const { error: dbError } = await supabase
      .from('results')
      .insert([{
        student_name: studentName,
        student_email: studentEmail,
        cefr_level: aiData.level,
        report_html: aiData.html_report,
        created_at: new Date()
      }]);

    if (dbError) throw new Error("DB Error: " + dbError.message);

    /* --- EMAIL SYSTEM (UNCOMMENT WHEN PAID) ---
    if (process.env.RESEND_API_KEY) {
       // Email to STUDENT
       await resend.emails.send({
           from: 'Academy <tests@yourdomain.com>',
           to: studentEmail,
           subject: `Your English Level: ${aiData.level}`,
           html: aiData.html_report
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

    // 6. RETURN SUCCESS
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        level: aiData.level, 
        report: aiData.html_report 
      })
    };

  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Report generation failed: " + error.message })
    };
  }
};