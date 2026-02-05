const https = require('https');

exports.handler = async function(event, context) {
    const API_KEY = process.env.GEMINI_API_KEY;

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    let inputData;
    try {
        inputData = JSON.parse(event.body);
    } catch (e) {
        return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON input" }) };
    }
    
    const LEVEL = inputData.level || "B2";
    const QUALITY = inputData.quality || "distinction";
    const TOPIC = inputData.topic || "Topic";
    const POINTS = inputData.points_data || [];
    const GRAMMAR = inputData.grammar || [];
    const LINKERS = inputData.linkers || [];

    // --- PROMPTS ---

    const paragraphRecipe = `
    PARAGRAPH RECIPE (You MUST follow this internal structure):
    - INTRODUCTION: 
      1. General Topic Sentence.
      2. Brief comparison of the ideas to be discussed.
      3. CRITICAL: End with a Rhetorical Question that restates the essay prompt.
    - BODY PARAGRAPHS:
      1. Idea Topic Sentence.
      2. Explanation (Why is this important?).
      3. Example OR Consequence.
    - CONCLUSION:
      1. Decide on the answer/opinion.
      2. Summarize the main points said.
      3. NO new information.
      4. Clear final statement (No room for misinterpretation).
    `;

    const rubricB2 = `
    MARKING CRITERIA (B2 FIRST):
    1. CONTENT: All points covered. Target reader is fully informed.
    2. COMMUNICATIVE ACHIEVEMENT: Hold the reader’s attention. Tone must be ACADEMIC AND NEUTRAL.
    3. ORGANIZATION: Text must be well-organized and coherent. Use a variety of linking words.
    4. LANGUAGE: Use a range of vocabulary and simple/complex grammatical forms.
    STRUCTURAL CONSTRAINT: Write exactly 5 paragraphs (Intro, Point 1, Point 2, Point 3, Conclusion).
    `;

    const rubricC1 = `
    MARKING CRITERIA (C1 ADVANCED):
    1. CONTENT: All selected points must be developed with flexibility and depth.
    2. COMMUNICATIVE ACHIEVEMENT: Hold the target reader's attention with ease.
    3. ORGANIZATION: Text must be a coherent whole. Use ORGANIZATIONAL PATTERNS (ellipsis, reference, substitution, mirroring).
    4. LANGUAGE: Use a wide range of vocabulary and complex grammatical forms with control.
    STRUCTURAL CONSTRAINT: Write exactly 4 paragraphs (Intro, Point 1, Point 2, Conclusion).
    `;

    let fullPrompt = `You are a strict Cambridge English Examiner for the ${LEVEL} exam.\n\n`;
    
    if (LEVEL === 'B2') {
        fullPrompt += rubricB2 + "\n" + paragraphRecipe;
    } else {
        fullPrompt += rubricC1 + "\n" + paragraphRecipe;
    }

    if (QUALITY === 'fail') {
        fullPrompt += `\nTARGET SCORE: BAND 1-2 (FAIL). Ignore structure. Make frequent errors.`;
    } else if (QUALITY === 'pass') {
        fullPrompt += `\nTARGET SCORE: BAND 3 (PASS). Safe answer. Follow structure loosely.`;
    } else {
        fullPrompt += `\nTARGET SCORE: BAND 5 (DISTINCTION). Perfect model answer. Follow structure PERFECTLY.`;
    }

    fullPrompt += `\n\nTASK:\nTopic: "${TOPIC}"\nArguments:\n`;
    POINTS.forEach(p => fullPrompt += `- ${p.topic}: ${p.argument}\n`);

    if (QUALITY !== 'fail' && (GRAMMAR.length > 0 || LINKERS.length > 0)) {
        fullPrompt += `\nSUGGESTED INGREDIENTS (Use naturally):\n`;
        if (GRAMMAR.length > 0) fullPrompt += `- Grammar: ${GRAMMAR.join(', ')}\n`;
        if (LINKERS.length > 0) fullPrompt += `- Linkers: ${LINKERS.join(', ')}\n`;
    }

    fullPrompt += `
    \nJSON OUTPUT RULES:
    Output ONLY valid JSON. No Markdown.
    Format:
    {
        "essay_text": "Full essay text...",
        "analysis": [
            {"phrase": "text from essay", "type": "grammar", "label": "Passive", "explanation": "reason"},
            {"phrase": "text from essay", "type": "linker", "label": "However", "explanation": "reason"}
        ]
    }`;

    // --- CALL GEMINI (gemini-flash-latest) ---
    const requestBody = JSON.stringify({
        contents: [{ parts: [{ text: fullPrompt }] }]
    });

    const options = {
        hostname: 'generativelanguage.googleapis.com',
        // REVERTED TO YOUR SPECIFIC MODEL STRING
        path: `/v1beta/models/gemini-flash-latest:generateContent?key=${API_KEY}`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(requestBody)
        }
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let responseBody = '';
            res.on('data', (chunk) => responseBody += chunk);

            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        const apiResponse = JSON.parse(responseBody);

                        if (!apiResponse.candidates || apiResponse.candidates.length === 0) {
                            return resolve({ statusCode: 500, body: JSON.stringify({ error: "Gemini replied but gave no text." }) });
                        }

                        let rawText = apiResponse.candidates[0].content.parts[0].text;
                        rawText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();

                        resolve({
                            statusCode: 200,
                            body: rawText
                        });

                    } catch (error) {
                        resolve({ statusCode: 500, body: JSON.stringify({ error: "Server Error", details: error.message }) });
                    }
                } else {
                    resolve({ statusCode: res.statusCode, body: JSON.stringify({ error: "API Error", details: responseBody }) });
                }
            });
        });

        req.on('error', (e) => {
            resolve({ statusCode: 500, body: JSON.stringify({ error: "Network Error", details: e.message }) });
        });

        req.write(requestBody);
        req.end();
    });
};