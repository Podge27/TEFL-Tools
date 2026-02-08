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
      1. EVALUATION: Decide on the answer/opinion by specifically addressing the superlative requested (e.g., "most beneficial", "most effective").
      2. Summarize the main points said.
      3. NO new information.
      4. Clear final statement.
    `;

    const rubricB2 = `
    MARKING CRITERIA (B2 FIRST):
    1. CONTENT: All points covered (usually 2 provided + your own idea).
    2. COMMUNICATIVE ACHIEVEMENT: Neutral/Academic tone. Write like a strong student.
    3. ORGANIZATION: Use standard linkers.
    4. LANGUAGE: Use Oxford 3000 vocabulary. Clear, functional, and correct.
    5. WORD COUNT: STRICTLY 140 - 190 words.
    STRUCTURAL CONSTRAINT: Write exactly 5 paragraphs.
    `;

    const rubricC1 = `
    MARKING CRITERIA (C1 ADVANCED):
    1. CONTENT: From the 3 notes provided, SELECT ONLY TWO to discuss. 
    2. COMMUNICATIVE ACHIEVEMENT: Professional but human tone. Avoid "AI-style" flowery collocations.
    3. ORGANIZATION: Use sophisticated referencing (e.g., "This trend," "The former").
    4. LANGUAGE: Wide range of vocabulary and complex forms (Inversions, Participles).
    5. EVALUATION: In the conclusion, you MUST explain which of the two points is the most [superlative from prompt], giving reasons.
    6. WORD COUNT: STRICTLY 220 - 260 words.
    STRUCTURAL CONSTRAINT: Write exactly 4 paragraphs.
    `;

    let fullPrompt = `You are a strict Cambridge English Examiner for the ${LEVEL} exam.\n\n`;
    
    if (LEVEL === 'B2') {
        fullPrompt += rubricB2 + "\n" + paragraphRecipe;
    } else {
        fullPrompt += rubricC1 + "\n" + paragraphRecipe;
    }

    if (QUALITY === 'fail') {
        fullPrompt += `\nTARGET SCORE: BAND 1-2 (FAIL). Ignore structure and word count. Use basic vocabulary and frequent Spanish-style errors (e.g., "people is", "I am agree").`;
    } else if (QUALITY === 'pass') {
        fullPrompt += `\nTARGET SCORE: BAND 3 (PASS). Safe, functional answer. Correct but simple vocabulary. Follow word count and structure loosely.`;
    } else {
        fullPrompt += `\nTARGET SCORE: BAND 5 (DISTINCTION). High-level human model answer. Follow structure and word count PERFECTLY.`;
    }

    fullPrompt += `\n\nTASK:\nTopic: "${TOPIC}"\nArguments provided in the prompt notes:\n`;
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

    const requestBody = JSON.stringify({
        contents: [{ parts: [{ text: fullPrompt }] }]
    });

    const options = {
        hostname: 'generativelanguage.googleapis.com',
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
                            return resolve({ statusCode: 500, body: JSON.stringify({ error: "Gemini error." }) });
                        }
                        let rawText = apiResponse.candidates[0].content.parts[0].text;
                        rawText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
                        resolve({ statusCode: 200, body: rawText });
                    } catch (error) {
                        resolve({ statusCode: 500, body: JSON.stringify({ error: "Server Error" }) });
                    }
                } else {
                    resolve({ statusCode: res.statusCode, body: JSON.stringify({ error: "API Error" }) });
                }
            });
        });
        req.on('error', (e) => resolve({ statusCode: 500, body: JSON.stringify({ error: "Network Error" }) }));
        req.write(requestBody);
        req.end();
    });
};