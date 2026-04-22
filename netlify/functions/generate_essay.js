const { GoogleGenerativeAI } = require("@google/generative-ai");

exports.handler = async function(event, context) {
    const API_KEY = process.env.GEMINI_API_KEY;

    // SAFETY NET 1: The "Polite Doorway" (CORS Headers)
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    // If the browser is just knocking to check permissions, let it in safely.
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: 'Method Not Allowed' };
    }

    let inputData;
    try {
        inputData = JSON.parse(event.body);
    } catch (e) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON input" }) };
    }
    
    // 2. Extract Data (Unchanged)
    const LEVEL = inputData.level || "B2";
    const QUALITY = inputData.quality || "distinction";
    const TOPIC = inputData.topic || "Topic";
    const POINTS = inputData.points_data || []; 
    const GRAMMAR = inputData.grammar || [];
    const VOCABULARY = inputData.vocabulary || [];
    const LINKERS = inputData.linkers || [];

    // 3. Define The Rules (Unchanged)
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

    // 4. Construct the Prompt (Unchanged)
    let fullPrompt = `You are a strict Cambridge English Examiner for the ${LEVEL} exam. Write in British English.\n\n`;
    
    if (LEVEL === 'C2') {
        fullPrompt += rubricC2;
        fullPrompt += `\n\nTASK: Synthesize the following "Lego Blocks" (Summaries and Evaluations) into a cohesive essay.\nTopic: "${TOPIC}"\n`;
    } else if (LEVEL === 'C1') {
        fullPrompt += rubricC1 + "\n" + paragraphRecipeB2C1;
        fullPrompt += `\n\nTASK:\nTopic: "${TOPIC}"\nArguments to cover:\n`;
    } else {
        fullPrompt += rubricB2 + "\n" + paragraphRecipeB2C1;
        fullPrompt += `\n\nTASK:\nTopic: "${TOPIC}"\nArguments to cover:\n`;
    }

    POINTS.forEach(p => fullPrompt += `- ${p.topic}: ${p.argument}\n`);

    if (QUALITY === 'fail') {
        fullPrompt += `\nTARGET SCORE: BAND 1-2 (FAIL). Ignore structure and word count. Use basic vocabulary and frequent Spanish-style errors (e.g., "people is", "I am agree").`;
    } else if (QUALITY === 'pass') {
        fullPrompt += `\nTARGET SCORE: BAND 3 (PASS). Safe, functional answer. Correct but simple vocabulary. Follow word count and structure loosely.`;
    } else {
        fullPrompt += `\nTARGET SCORE: BAND 5 (DISTINCTION). High-level human model answer. Follow structure and word count PERFECTLY.`;
    }

    if (QUALITY !== 'fail' && (GRAMMAR.length > 0 || LINKERS.length > 0 || VOCABULARY.length > 0)) {
        fullPrompt += `\nSUGGESTED INGREDIENTS (Integrate naturally):\n`;
        if (GRAMMAR.length > 0) fullPrompt += `- Grammar: ${GRAMMAR.join(', ')}\n`;
        if (VOCABULARY.length > 0) fullPrompt += `- Vocabulary: ${VOCABULARY.join(', ')}\n`;
        if (LINKERS.length > 0) fullPrompt += `- Linkers: ${LINKERS.join(', ')}\n`;
    }

    fullPrompt += `
    \nJSON OUTPUT RULES:
    Output ONLY valid JSON.
    Format:
    {
        "essay_text": "Full essay text...",
        "analysis": [
            {"phrase": "text from essay", "type": "grammar", "label": "Label", "explanation": "reason"}
        ]
    }`;

    // 5. Send to Google using the Official SDK
    try {
        const genAI = new GoogleGenerativeAI(API_KEY);
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash",
            generationConfig: {
                maxOutputTokens: 1000,
                temperature: 0.7,
                responseMimeType: "application/json" // SAFETY NET 2: Forces Google to ONLY return JSON
            }
        });

        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        const text = response.text();

        return {
            statusCode: 200,
            headers: {
                ...headers,
                'Content-Type': 'application/json'
            },
            body: text
        };

    } catch (error) {
        console.error("Gemini SDK Error:", error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: "The AI was unable to generate the essay. Please try again." })
        };
    }
};