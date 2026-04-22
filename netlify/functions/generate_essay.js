const https = require('https');

exports.handler = async function(event, context) {
    // 1. The Polite Doorway
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method Not Allowed' };

    let inputData;
    try {
        inputData = JSON.parse(event.body);
    } catch (e) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON input" }) };
    }
    
    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) return { statusCode: 500, headers, body: JSON.stringify({ error: "API Key missing." }) };

    const LEVEL = inputData.level || "B2";
    const QUALITY = inputData.quality || "distinction";
    const TOPIC = inputData.topic || "Topic";
    const POINTS = inputData.points_data || []; 
    const GRAMMAR = inputData.grammar || [];
    const VOCABULARY = inputData.vocabulary || [];
    const LINKERS = inputData.linkers || [];

    // --- YOUR EXACT ESOL RUBRICS ---
    const paragraphRecipeB2C1 = `
    PARAGRAPH RECIPE (You MUST follow this internal structure):
    - INTRODUCTION: 1. General Topic Sentence. 2. Brief comparison. 3. CRITICAL: End with a Rhetorical Question that restates the prompt.
    - BODY PARAGRAPHS: 1. Idea Topic Sentence. 2. Explanation. 3. Example OR Consequence.
    - CONCLUSION: 1. EVALUATION: Decide on the answer/opinion. 2. Summarize. 3. Clear final statement.
    `;

    const rubricB2 = `MARKING CRITERIA (B2 FIRST): 1. CONTENT: All points covered. 2. COMMUNICATIVE ACHIEVEMENT: Neutral/Academic tone. 3. ORGANIZATION: Use standard linkers. 4. LANGUAGE: Use Oxford 3000 vocabulary. 5. WORD COUNT: STRICTLY 140 - 190 words. STRUCTURAL CONSTRAINT: Write exactly 5 paragraphs.`;
    const rubricC1 = `MARKING CRITERIA (C1 ADVANCED): 1. CONTENT: Select two points to discuss. 2. COMMUNICATIVE ACHIEVEMENT: Professional but human tone. 3. ORGANIZATION: Use sophisticated referencing. 4. LANGUAGE: Wide range of vocabulary and complex forms. 5. EVALUATION: In the conclusion, explain which point is the most important/effective. 6. WORD COUNT: STRICTLY 220 - 260 words. STRUCTURAL CONSTRAINT: Write exactly 4 paragraphs.`;
    const rubricC2 = `MARKING CRITERIA (C2 PROFICIENCY): 1. CONTENT: SYNTHESIZE the provided summaries. 2. COMMUNICATIVE ACHIEVEMENT: Abstract, sophisticated, authoritative tone. 3. ORGANIZATION: seamless flow. 4. LANGUAGE: C2-level vocabulary. 5. WORD COUNT: STRICTLY 280 - 320 words. STRUCTURAL CONSTRAINT: Follow the paragraph structure implied.`;

    // --- PROMPT BUILDING ---
    let fullPrompt = `You are a strict Cambridge English Examiner for the ${LEVEL} exam. Write in British English.\n\n`;
    
    if (LEVEL === 'C2') {
        fullPrompt += rubricC2 + `\n\nTASK: Synthesize the following "Lego Blocks" into a cohesive essay.\nTopic: "${TOPIC}"\n`;
    } else if (LEVEL === 'C1') {
        fullPrompt += rubricC1 + "\n" + paragraphRecipeB2C1 + `\n\nTASK:\nTopic: "${TOPIC}"\nArguments to cover:\n`;
    } else {
        fullPrompt += rubricB2 + "\n" + paragraphRecipeB2C1 + `\n\nTASK:\nTopic: "${TOPIC}"\nArguments to cover:\n`;
    }

    POINTS.forEach(p => fullPrompt += `- ${p.topic}: ${p.argument}\n`);

    if (QUALITY === 'fail') fullPrompt += `\nTARGET SCORE: BAND 1-2 (FAIL). Ignore structure and word count. Use basic vocabulary and frequent Spanish-style errors.`;
    else if (QUALITY === 'pass') fullPrompt += `\nTARGET SCORE: BAND 3 (PASS). Safe, functional answer. Follow word count and structure loosely.`;
    else fullPrompt += `\nTARGET SCORE: BAND 5 (DISTINCTION). High-level human model answer. Follow structure and word count PERFECTLY.`;

    if (QUALITY !== 'fail' && (GRAMMAR.length > 0 || LINKERS.length > 0 || VOCABULARY.length > 0)) {
        fullPrompt += `\nSUGGESTED INGREDIENTS:\n`;
        if (GRAMMAR.length > 0) fullPrompt += `- Grammar: ${GRAMMAR.join(', ')}\n`;
        if (VOCABULARY.length > 0) fullPrompt += `- Vocabulary: ${VOCABULARY.join(', ')}\n`;
        if (LINKERS.length > 0) fullPrompt += `- Linkers: ${LINKERS.join(', ')}\n`;
    }

    // THE JSON SAFETY RULES
    fullPrompt += `
    \nJSON OUTPUT RULES:
    1. Output ONLY valid JSON.
    2. Do NOT use literal newlines (Enter key) inside the essay_text string. You MUST use \\n to represent paragraph breaks.
    Format:
    {
        "essay_text": "Paragraph 1 text here...\\n\\nParagraph 2 text here...",
        "analysis": [
            {"phrase": "text from essay", "type": "grammar", "label": "Label", "explanation": "reason"}
        ]
    }`;

    // --- THE UNBREAKABLE HTTPS CONNECTION ---
    const requestBody = JSON.stringify({
        contents: [{ parts: [{ text: fullPrompt }] }],
        generationConfig: {
            maxOutputTokens: 4000, // Giving it enough breath to finish C2 essays
            temperature: 0.7,
            responseMimeType: "application/json" // Locking the output strictly to JSON
        }
    });

    const options = {
        hostname: 'generativelanguage.googleapis.com',
        path: `/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(requestBody)
        }
    };

    return new Promise((resolve) => {
        const req = https.request(options, (res) => {
            let responseBody = '';
            res.on('data', (chunk) => responseBody += chunk);
            
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        const apiResponse = JSON.parse(responseBody);
                        if (!apiResponse.candidates || apiResponse.candidates.length === 0) {
                            return resolve({ statusCode: 500, headers, body: JSON.stringify({ error: "Gemini replied but gave no text." }) });
                        }
                        
                        let rawText = apiResponse.candidates[0].content.parts[0].text;
                        resolve({ statusCode: 200, headers, body: rawText });

                    } catch (error) {
                        resolve({ statusCode: 500, headers, body: JSON.stringify({ error: "Failed to parse Gemini response" }) });
                    }
                } else {
                    resolve({ statusCode: res.statusCode, headers, body: JSON.stringify({ error: "API Error" }) });
                }
            });
        });

        req.on('error', (e) => {
            resolve({ statusCode: 500, headers, body: JSON.stringify({ error: "Network Error" }) });
        });

        req.write(requestBody);
        req.end();
    });
};