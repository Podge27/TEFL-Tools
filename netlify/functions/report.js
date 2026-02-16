const { GoogleGenerativeAI } = require("@google/generative-ai");
// const { Resend } = require("resend");  <-- UNCOMMENT THIS WHEN PAID

exports.handler = async function(event, context) {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  try {
    const { history, studentName, studentEmail } = JSON.parse(event.body);

    // 1. Calculate Scores manually
    const grammar = history.filter(h => !h.id.startsWith('RS') && !h.id.startsWith('LS'));
    const reading = history.filter(h => h.id.startsWith('RS'));
    const listening = history.filter(h => h.id.startsWith('LS'));

    const score = (arr) => `${arr.filter(x=>x.correct).length}/${arr.length}`;
    
    // 2. AI CONFIG
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // 3. THE "DIRECTOR'S CUT" PROMPT
    const prompt = `
      Act as a Director of Studies. Analyse this placement test.
      Student: ${studentName} (${studentEmail})
      
      SCORES:
      Grammar: ${score(grammar)}
      Reading: ${score(reading)}
      Listening: ${score(listening)}

      FULL HISTORY: ${JSON.stringify(history)}

      TASK:
      Generate a strictly formatted HTML report. Do NOT use markdown.
      
      STRUCTURE:
      1. <h3>Summary</h3>: A 2-sentence overview of their level and key trait.
      2. <details><summary><strong>Click for Full Director's Analysis</strong></summary>
         <div style="margin-top:10px; border-left:3px solid #ccc; padding-left:10px;">
           <h4>Skill Breakdown</h4>
           <p>Comment on their Grammar vs Skills (Reading/Listening).</p>
           
           <h4>Error Analysis</h4>
           <ul>
             <li>List 3 specific mistakes (quote the user_answer vs correct_answer).</li>
             <li>Explain the error (e.g., L1 interference).</li>
           </ul>
           
           <h4>Raw Answer Log</h4>
           <p><em>(AI: Please generate a simple HTML table of their wrong answers only)</em></p>
         </div>
      3. </details>
    `;

    const result = await model.generateContent(prompt);
    const reportHtml = result.response.text().replace(/```html|```/g, "").trim();

    /* --- EMAIL SYSTEM (UNCOMMENT WHEN PAID) ---
    if (process.env.RESEND_API_KEY) {
        const resend = new Resend(process.env.RESEND_API_KEY);
        
        // Email to ADMIN
        await resend.emails.send({
            from: 'Acme Academy <onboarding@resend.dev>',
            to: 'YOUR_EMAIL@gmail.com',
            subject: `New Test Result: ${studentName}`,
            html: `<h1>New Placement Test</h1>${reportHtml}`
        });

        // Email to STUDENT
        await resend.emails.send({
            from: 'Acme Academy <onboarding@resend.dev>',
            to: studentEmail,
            subject: 'Assessment Received',
            html: `<p>Dear ${studentName},</p><p>Thank you for completing your assessment. We have received your results.</p><p>We will contact you shortly.</p>`
        });
    }
    ------------------------------------------- */

    return {
      statusCode: 200,
      headers: { "Content-Type": "text/html" },
      body: reportHtml
    };

  } catch (error) {
    console.error(error);
    return { statusCode: 500, body: "Error generating report" };
  }
};