const https = require('https');

exports.handler = async function(event, context) {
    
    // 1. PARSE INPUTS
    // We wrap this in try/catch in case the JSON is malformed
    let data;
    try {
        data = JSON.parse(event.body);
    } catch (e) {
        return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON input" }) };
    }
    
    const LEVEL = data.level || "B2";
    const QUALITY = data.quality || "distinction";
    const TOPIC = data.topic || "Topic";
    const POINTS = data.points_data || [];
    const GRAMMAR = data.grammar || [];
    const LINKERS = data.linkers || [];

    // --- 2. DEFINE THE INSTRUCTIONS ---

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
    `;

    const rubricC1 = `
    MARKING CRITERIA (C1 ADVANCED):
    1. CONTENT: All selected points must be developed with flexibility and depth.
    2. COMMUNICATIVE ACHIEVEMENT: Hold the target reader's attention with ease.
    3. ORGANIZATION: Text must be a coherent whole. Use ORGANIZATIONAL PATTERNS (ellipsis, reference, substitution, mirroring).
    4. LANGUAGE: Use a wide range of vocabulary and complex grammatical forms with control.
    `;

    let roleDescription = `You are a strict Cambridge English Examiner for the ${LEVEL} exam. `;
    
    if (LEVEL === 'B2') {
        roleDescription += rubricB2 + paragraphRecipe;
        roleDescription += `\nSTRUCTURAL CONSTRAINT (B2): Write exactly 5 paragraphs (Intro, Point 1, Point 2, Point 3, Conclusion).`;
    } else {
        roleDescription += rubricC1 + paragraphRecipe;
        roleDescription += `\nSTRUCTURAL CONSTRAINT (C1): Write exactly 4 paragraphs (Intro, Point 1, Point 2, Conclusion).`;
    }

    if (QUALITY === 'fail') {
        roleDescription += `\nTARGET SCORE: BAND 1-2 (FAIL). Ignore structure. Make frequent errors.`;
    } else if (QUALITY === 'pass') {
        roleDescription += `\nTARGET SCORE: BAND 3 (PASS). Safe answer. Follow structure loosely.`;
    } else {
        roleDescription += `\nTARGET SCORE: BAND 5 (DISTINCTION). Perfect model answer. Follow structure PERFECTLY.`;
    }

    let taskDescription = `Topic: "${TOPIC}".\nArguments:\n`;
    POINTS.forEach(p => taskDescription += `- ${p.topic}: ${p.argument}\n`);

    if (QUALITY !== 'fail') {
        taskDescription += `\nSUGGESTED INGREDIENTS (Use naturally if possible):\n`;
        if (GRAMMAR.length > 0) taskDescription += `- Grammar: ${GRAMMAR.join(', ')}\n`;
        if (LINKERS.length > 0) taskDescription += `- Linkers: ${LINKERS.join(', ')}\n`;
    }

    const jsonInstruction = `
    OUTPUT FORMAT: Return ONLY valid JSON.
    {
        "essay_text": "Full essay text...",
        "analysis": [
            {"phrase": "text from essay", "type": "grammar", "label": "Passive", "explanation": "reason"},
            {"phrase": "text from essay", "type": "linker", "label": "However", "explanation": "reason"}
        ]
    }`;

    // --- 3. CALL OPENAI (Using Native HTTPS) ---
    
    const requestBody = JSON.stringify({
        model: "gpt-4o",
        messages: [
            { role: "system", content: roleDescription },
            { role: "user", content: taskDescription + "\n" + jsonInstruction }
        ],
        temperature: 0.7
    });

    const options = {
        hostname: 'api.openai.com',
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Length': Buffer.byteLength(requestBody)
        }
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let responseBody = '';

            res.on('data', (chunk) => {
                responseBody += chunk;
            });

            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        const parsed = JSON.parse(responseBody);
                        let content = parsed.choices[0].message.content;
                        // Clean markdown blocks if AI adds them
                        content = content.replace(/```json/g, '').replace(/```/g, '').trim();
                        
                        resolve({
                            statusCode: 200,
                            body: content
                        });
                    } catch (err) {
                        resolve({
                            statusCode: 500,
                            body: JSON.stringify({ error: "Failed to parse OpenAI response", raw: responseBody })
                        });
                    }
                } else {
                    resolve({
                        statusCode: res.statusCode,
                        body: JSON.stringify({ error: "OpenAI API Error", details: responseBody })
                    });
                }
            });
        });

        req.on('error', (e) => {
            resolve({
                statusCode: 500,
                body: JSON.stringify({ error: "Network Error", details: e.message })
            });
        });

        // Write data to request body
        req.write(requestBody);
        req.end();
    });
};