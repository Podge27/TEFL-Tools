const { GoogleGenerativeAI } = require('@google/generative-ai');

const characterTraits = {
    'Jimmy': 'brave but silly and a little bit clumsy',
    'Katy': 'very smart and loves animals, Jimmys best friend',
    'Belinda': 'always hungry and tells funny jokes, is the younger sister of Jimmy and Denny',
    'Denny': 'always angry, is the older brother of Jimmy and Belinda',
    'Bob': 'loud and loves building things, is a baby',
    'Susan': 'always carries a map and a magnifying glass, wants to be a pirate',
    'Julia': 'loves solving mysteries and reading books, is kind and polite'
};

exports.handler = async function(event, context) {
    // 1. SETUP HEADERS (The Bouncer for the browser)
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method Not Allowed' };

    try {
        const data = JSON.parse(event.body);
        const { level, characters, setting, problem, teacherNotes, history, currentTurn } = data;

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        
        // 2. CONFIGURE AI (Keep it focused and give it enough room to speak)
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash",
            generationConfig: { temperature: 0.3, maxOutputTokens: 500 }
        });

        // 3. STRICT GRAMMAR FENCES
        const levelRules = {
            starters: `LEVEL: Pre A1 Starters. GRAMMAR ALLOWED: Present simple, Present continuous, Can (ability), Have (got). FORBIDDEN: NEVER use past tense, future 'will', or comparatives.`,
            movers: `LEVEL: A1 Movers. GRAMMAR ALLOWED: Past simple (regular/irregular), Comparative/Superlative adjectives, Must, Have (got) to. FORBIDDEN: NEVER use Present Perfect.`,
            flyers: `LEVEL: A2 Flyers. GRAMMAR ALLOWED: Past continuous, Present perfect, Will, Might, Should. Use them naturally alongside simple tenses.`
        };

        const currentRules = levelRules[level?.toLowerCase()] || levelRules.starters;

        const charactersWithTraits = characters.map(name => 
            `${name} (who is ${characterTraits[name] || 'a helpful friend'})`
        ).join(' and ');

        // 4. THE 5-ACT NARRATIVE ARC (With Sequence Linkers)
        let arcInstruction = "";
        let isFinalTurn = false;

        switch (currentTurn) {
            case 1:
                arcInstruction = `Act 1: Introduction. START WITH 'First,'. Introduce the characters and the ${setting}. By the end of this paragraph, the core problem ('${problem}') MUST happen. Choices: How they initially react.`;
                break;
            case 2:
                arcInstruction = `Act 2: Exploration. START WITH 'Then,'. The characters try to fix the problem, but discover a new complication or obstacle. Choices: How they handle this new obstacle.`;
                break;
            case 3:
                arcInstruction = `Act 3: Rising Action. START WITH 'After that,'. Things get a bit more difficult or silly. They must work together. Choices: Their next big idea.`;
                break;
            case 4:
                arcInstruction = `Act 4: The Climax. START WITH 'Later,'. This is the final hurdle. They are very close to fixing the problem ('${problem}'). Choices: The final action they take.`;
                break;
            default:
                isFinalTurn = true;
                arcInstruction = `Act 5: Resolution. START WITH 'Finally,'. The characters successfully solve the problem ('${problem}') using the choice they just made. Everyone is happy.`;
                break;
        }

        let taskInstruction = `
        Task: Write the next short paragraph (max 3 simple sentences). 
        Narrative Stage: ${arcInstruction}
        
        CRITICAL RULES FOR OPTIONS: 
        - Provide exactly 3 options.
        - They must be IMMEDIATE, PHYSICAL ACTIONS taken by the characters.
        - No passive events.
        Leave the "vocabulary" array empty [].`;

        if (isFinalTurn) {
            taskInstruction = `
            Task: Write the final concluding paragraph (max 4 simple sentences).
            Narrative Stage: ${arcInstruction}
            
            CRITICAL RULES FOR ENDING:
            - Set the "options" array to be completely empty []. Do NOT give choices.
            - Review the entire story and extract 8 to 10 key English vocabulary words used. Put them in the "vocabulary" array.`;
        }

        const prompt = `
        You are an expert ESOL teacher writing a choose-your-own-adventure story.
        Target Audience: Spanish students learning English (children).
        ${currentRules}
        Language: British English spelling and phrasing only.
        
        Story Elements:
        - Characters: ${charactersWithTraits}. Show their traits!
        - Setting: A ${setting}. 
        - Core Problem: ${problem}.
        - Teacher Instructions: ${teacherNotes || 'None'}
        
        Previous Story History: 
        ${history || 'This is the start of the story.'}
        
        ${taskInstruction}
        
        Respond ONLY in the following JSON format without formatting tags:
        {
            "story": "The story text goes here...",
            "options": ["A) Action one", "B) Action two", "C) Action three"],
            "vocabulary": ["word1", "word2"]
        }`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        
        // 5. THE SCISSORS (JSON Extractor Laser)
        let cleanJson = responseText;
        const firstBrace = cleanJson.indexOf('{');
        const lastBrace = cleanJson.lastIndexOf('}');
        
        if (firstBrace !== -1 && lastBrace !== -1) {
            cleanJson = cleanJson.substring(firstBrace, lastBrace + 1);
        } else {
            throw new Error("No JSON formatting detected.");
        }

        return { statusCode: 200, headers, body: cleanJson };

    } catch (error) {
        // 6. SAFE FALLBACK (Prevents UI crash)
        console.error("Story Error:", error.message);
        const fallback = {
            story: "Oh no! The story book closed. Let's try again!",
            options: [],
            vocabulary: []
        };
        return { statusCode: 200, headers, body: JSON.stringify(fallback) };
    }
};