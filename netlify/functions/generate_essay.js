// REMOVED: const fetch = require('node-fetch'); 
// We are using the native Node.js 18 fetch now.

exports.handler = async function(event, context) {
    
    // 1. PARSE INPUTS
    const data = JSON.parse(event.body);
    
    const LEVEL = data.level;          // "B2" or "C1"
    const QUALITY = data.quality;      // "fail", "pass", "distinction"
    const TOPIC = data.topic;
    const POINTS = data.points_data;   // Array of {topic, argument}
    const GRAMMAR = data.grammar;      // Array of strings
    const LINKERS = data.linkers;      // Array of strings

    // --- 2. DEFINE THE "SECRET SAUCE" (Marking Schemes & Recipes) ---

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
    2. COMMUNICATIVE ACHIEVEMENT: Hold the reader’s attention. Tone must be ACADEMIC AND NEUTRAL (Standard English, avoiding slang or overly archaic words).
    3. ORGANIZATION: Text must be well-organized and coherent. Use a variety of linking words and cohesive devices.
    4. LANGUAGE: Use a range of vocabulary and simple/complex grammatical forms with a good degree of control.
    `;

    const rubricC1 = `
    MARKING CRITERIA (C1 ADVANCED):
    1. CONTENT: All selected points must be developed with flexibility and depth.
    2. COMMUNICATIVE ACHIEVEMENT: Hold the target reader's attention with ease, fulfilling all communicative purposes.
    3. ORGANIZATION: Text must be a coherent whole. Use ORGANIZATIONAL PATTERNS (ellipsis, reference, substitution, mirroring, parallelism) and cohesive devices with flexibility.
    4. LANGUAGE: Use a wide range of vocabulary (including less common lexis) and complex grammatical forms with control and flexibility.
    `;

    // --- 3. BUILD THE SYSTEM PROMPT ---
    
    let roleDescription = `You are a strict Cambridge English Examiner for the ${LEVEL} exam. `;
    
    if (LEVEL === 'B2') {
        roleDescription += rubricB2;
        roleDescription += paragraphRecipe;
        roleDescription += `
        STRUCTURAL CONSTRAINT (B2): 
        You MUST write exactly 5 paragraphs:
        1. Introduction
        2. Body Paragraph on Point 1
        3. Body Paragraph on Point 2
        4. Body Paragraph on Point 3 (Student's Own Idea)
        5. Conclusion
        `;
    } else {
        // C1 Logic
        roleDescription += rubricC1;
        roleDescription += paragraphRecipe;
        roleDescription += `
        STRUCTURAL CONSTRAINT (C1): 
        You MUST write exactly 4 paragraphs:
        1. Introduction (State the issue and the two points chosen)
        2. Body Paragraph on First Selected Point
        3. Body Paragraph on Second Selected Point
        4. Conclusion (Weigh up the arguments and state which is more important)
        `;
    }

    if (QUALITY === 'fail') {
        roleDescription += `\nTARGET SCORE: BAND 1-2 (FAIL). Ignore the paragraph recipe. Make frequent errors typical of Spanish speakers. Use repetitive vocabulary. Fail to answer the question.`;
    } else if (QUALITY === 'pass') {
        roleDescription += `\nTARGET SCORE: BAND 3 (PASS). A solid, safe answer. Follow the recipe loosely. Meets all requirements but lacks ambition.`;
    } else {
        roleDescription += `\nTARGET SCORE: BAND 5 (DISTINCTION). A perfect model answer. Follow the recipe PERFECTLY. Demonstrates full control and sophistication.`;
    }

    // --- 4. BUILD THE TASK PROMPT ---
    
    let taskDescription = `Topic: "${TOPIC}".\n`;
    taskDescription += `Arguments to discuss:\n`;
    POINTS.forEach((p, i) => {
        taskDescription += `- ${p.topic}: ${p.argument}\n`;
    });

    if (QUALITY !== 'fail') {
        taskDescription += `\nSUGGESTED INGREDIENTS:\n`;
        taskDescription += `Try to incorporate the following structures naturally to demonstrate range. \n`;
        taskDescription += `CRITICAL RULE: Do not force them if they damage the flow or tone. Prioritize natural English over checking every box.\n`;
        
        if (GRAMMAR.length > 0) taskDescription += `- Target Grammar: ${GRAMMAR.join(', ')}\n`;
        if (LINKERS.length > 0) taskDescription += `- Target Linkers: ${LINKERS.join(', ')}\n`;
    }

    // --- 5. JSON OUTPUT INSTRUCTION ---
    const jsonInstruction = `
    OUTPUT FORMAT:
    Return ONLY valid JSON. Do not include markdown formatting like \`\`\`json.
    {
        "essay_text": "The full text of the essay...",
        "analysis": [
            {
                "phrase": "exact text from essay",
                "type": "grammar", 
                "label": "Passive Voice",
                "explanation": "Brief reason for use"
            },
            {
                "phrase": "exact text from essay",
                "type": "linker",
                "label": "However",
                "explanation": "Brief reason for use"
            }
        ]
    }`;

    // --- 6. CALL THE AI ---
    try {
        // Using global 'fetch' (Node 18+)
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-4o", 
                messages: [
                    { role: "system", content: roleDescription },
                    { role: "user", content: taskDescription + "\n" + jsonInstruction }
                ],
                temperature: 0.7 
            })
        });

        const apiData = await response.json();
        
        let rawContent = apiData.choices[0].message.content;
        rawContent = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();
        
        return {
            statusCode: 200,
            body: rawContent
        };

    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Failed to generate essay", details: error.message })
        };
    }
};