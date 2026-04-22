const { GoogleGenerativeAI } = require('@google/generative-ai');

exports.handler = async function(event, context) {
    // 1. The Polite Doorway (CORS)
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };

    // 2. The Empty Envelope Safety Net
    let bodyData;
    try {
        bodyData = JSON.parse(event.body);
    } catch (e) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'No data sent from the website.' }) };
    }

    // Give them default values just in case they are missing!
    const level = bodyData.level || "B2";
    const history = bodyData.history || "No story provided.";

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    // 3. The Strict JSON Rule
    const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash",
        generationConfig: { responseMimeType: "application/json" } 
    });

    const prompt = `
        You are an ESOL teacher evaluating Spanish students.
        Read the following story and generate exactly 3 simple reading comprehension questions.
        Target Level: Cambridge ${level} vocabulary and grammar.
        Language: British English spelling and phrasing only.
        
        Story: 
        ${history}
        
        Respond ONLY in the following JSON format without formatting tags. Wrap the questions in basic HTML paragraph tags:
        {
            "questionsHtml": "<p><strong>1.</strong> Question one?</p><p><strong>2.</strong> Question two?</p><p><strong>3.</strong> Question three?</p>"
        }
    `;

    try {
        const result = await model.generateContent(prompt);
        // The cleaner regex
        const cleanText = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        return { statusCode: 200, headers, body: cleanText };
    } catch (error) {
        console.error("Quiz Generator Error:", error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to generate questions' }) };
    }
};