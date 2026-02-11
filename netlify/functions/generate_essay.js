const https = require('https');

exports.handler = async function(event, context) {
    const API_KEY = process.env.GEMINI_API_KEY;

    // 1. Basic Setup
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    let inputData;
    try {
        inputData = JSON.parse(event.body);
    } catch (e) {
        return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON input" }) };
    }
    
    // 2. Extract Data
    const LEVEL = inputData.level || "B2";
    const QUALITY = inputData.quality || "distinction";
    const TOPIC = inputData.topic || "Topic";
    const POINTS = inputData.points_data || []; 
    const GRAMMAR = inputData.grammar || [];
    const VOCABULARY = inputData.vocabulary || [];
    const LINKERS = inputData.linkers || [];

    // 3. Define The Rules (The Nuance)

    const paragraphRecipeB2C1 = `
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
      1. EVALUATION: Decide on the answer/opinion.
      2. Summarize the main points said.
      3. Clear final statement.
    `;

    const rubricB2 = `
    MARKING CRITERIA (B2 FIRST):
    1. CONTENT: All points covered.
    2. COMMUNICATIVE ACHIEVEMENT: Neutral/Academic tone. Write like a strong student.
    3. ORGANIZATION: Use standard linkers.
    4. LANGUAGE: Use Oxford 3000 vocabulary. Clear, functional, and correct.
    5. WORD COUNT: STRICTLY 140 - 190 words.
    STRUCTURAL CONSTRAINT: Write exactly 5 paragraphs.
    `;

    const rubricC1 = `
    MARKING CRITERIA (C1 ADVANCED):
    1. CONTENT: Select two points to discuss. 
    2. COMMUNICATIVE ACHIEVEMENT: Professional but human tone. Avoid "AI-style" flowery collocations.
    3. ORGANIZATION: Use sophisticated referencing (e.g., "This trend," "The former").
    4. LANGUAGE: Wide range of vocabulary and complex forms (Inversions, Participles).
    5. EVALUATION: In the conclusion, explain which point is the most important/effective.
    6. WORD COUNT: STRICTLY 220 - 260 words.
    STRUCTURAL CONSTRAINT: Write exactly 4 paragraphs.
    `;

    const rubricC2 = `
    MARKING CRITERIA (C2 PROFICIENCY):
    1. CONTENT: You must SYNTHESIZE the provided summaries and evaluations into a coherent argument. Do not just list them.
    2. COMMUNICATIVE ACHIEVEMENT: The tone must be abstract, sophisticated, and authoritative. Use nominalisation (e.g., "The proliferation of..." instead of "People use...").
    3. ORGANIZATION: seamless flow. Do NOT use mechanical linkers like "Firstly/Secondly". Use inversion and cohesive devices.
    4. LANGUAGE: Use C2-level vocabulary and idiom naturally.
    5. WORD COUNT: STRICTLY 280 - 320 words.
    STRUCTURAL CONSTRAINT: Follow the paragraph structure implied by the user's input order.
    `;

    // 4. Construct the Prompt based on Level
    let fullPrompt = `You are a strict Cambridge English Examiner for the ${LEVEL} exam.\n\n`;
    
    if (LEVEL === 'C2') {
        // C2 Path
        fullPrompt += rubricC2;
        fullPrompt += `\n\nTASK: Synthesize the following "Lego Blocks" (Summaries and Evaluations) into a cohesive essay.\nTopic: "${TOPIC}"\n`;
    } else if (LEVEL === 'C1') {
        // C1 Path
        fullPrompt += rubricC1 + "\n" + paragraphRecipeB2C1;
        fullPrompt += `\n\nTASK:\nTopic: "${TOPIC}"\nArguments to cover:\n`;
    } else {
        // B2 Path
        fullPrompt += rubricB2 + "\n" + paragraphRecipeB2C1;
        fullPrompt += `\n\nTASK:\nTopic: "${TOPIC}"\nArguments to cover:\n`;
    }

    // Add the User's Content (The "Points")
    POINTS.forEach(p => fullPrompt += `- ${p.topic}: ${p.argument}\n`);

    // Add Quality Filter
    if (QUALITY === 'fail') {
        fullPrompt += `\nTARGET SCORE: BAND 1-2 (FAIL). Ignore structure and word count. Use basic vocabulary and frequent Spanish-style errors (e.g., "people is", "I am agree").`;
    } else if (QUALITY === 'pass') {
        fullPrompt += `\nTARGET SCORE: BAND 3 (PASS). Safe, functional answer. Correct but simple vocabulary. Follow word count and structure loosely.`;
    } else {
        fullPrompt += `\nTARGET SCORE: BAND 5 (DISTINCTION). High-level human model answer. Follow structure and word count PERFECTLY.`;
    }

    // Add Ingredients
    if (QUALITY !== 'fail' && (GRAMMAR.length > 0 || LINKERS.length > 0 || VOCABULARY.length > 0)) {
        fullPrompt += `\nSUGGESTED INGREDIENTS (Integrate naturally):\n`;
        if (GRAMMAR.length > 0) fullPrompt += `- Grammar: ${GRAMMAR.join(', ')}\n`;
        if (VOCABULARY.length > 0) fullPrompt += `- Vocabulary: ${VOCABULARY.join(', ')}\n`;
        if (LINKERS.length > 0) fullPrompt += `- Linkers: ${LINKERS.join(', ')}\n`;
    }

    fullPrompt += `
    \nJSON OUTPUT RULES:
    Output ONLY valid JSON. No Markdown.
    Format:
    {
        "essay_text": "Full essay text...",
        "analysis": [
            {"phrase": "text from essay", "type": "grammar", "label": "Label", "explanation": "reason"},
            {"phrase": "text from essay", "type": "linker", "label": "Label", "explanation": "reason"},
            {"phrase": "text from essay", "type": "vocabulary", "label": "Label", "explanation": "reason"}
        ]
    }`;

    // 5. Send to Google (Using the Stable 2.5 Flash Model)
    const requestBody = JSON.stringify({
        contents: [{ parts: [{ text: fullPrompt }] }]
    });

    const options = {
        hostname: 'generativelanguage.googleapis.com',
        // CHANGED: Using 2.5-flash as verified by your API list
        path: `/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`,
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
                        // Check if Google sent a "blocked" response or empty candidate
                        if (!apiResponse.candidates || apiResponse.candidates.length === 0) {
                             console.error("Gemini Error:", JSON.stringify(apiResponse));
                             return resolve({ statusCode: 500, body: JSON.stringify({ error: "Gemini refused to generate text." }) });
                        }
                        let rawText = apiResponse.candidates[0].content.parts[0].text;
                        // Clean up markdown
                        rawText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
                        resolve({ statusCode: 200, body: rawText });
                    } catch (error) {
                        console.error("Parse Error:", error);
                        resolve({ statusCode: 500, body: JSON.stringify({ error: "Server Error: Could not parse AI response." }) });
                    }
                } else {
                    console.error("API Error Code:", res.statusCode, responseBody);
                    resolve({ statusCode: res.statusCode, body: JSON.stringify({ error: "API Error from Google." }) });
                }
            });
        });
        
        req.on('error', (e) => {
            console.error("Network Error:", e);
            resolve({ statusCode: 500, body: JSON.stringify({ error: "Network Connection Error" }) });
        });
        
        req.write(requestBody);
        req.end();
    });
};