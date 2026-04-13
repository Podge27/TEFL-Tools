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
    // 1. SETUP HEADERS (The Bouncer)
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method Not Allowed' };

    try {
        const apiKey = process.env.GEMINI_API_KEY;
        const data = JSON.parse(event.body);
        const { level, characters, setting, problem, teacherNotes, history, currentTurn } = data;

        // 2. THE HEAVY-DUTY CAMBRIDGE RULES (Now with Vocab Themes)
        const levelRules = {
            starters: `
                LEVEL: Pre A1 Starters. 
                GRAMMAR ALLOWED: Present simple, Present continuous, Can (ability), Have (got), There is/are. 
                VOCAB THEMES TO USE: Animals, The body, Clothes, Colours, Family, Food, Home, School. 
                NUMBERS: 1-20. 
                FORBIDDEN: NEVER use past tense, future 'will', or comparative adjectives.`,
            movers: `
                LEVEL: A1 Movers. 
                GRAMMAR ALLOWED: Past simple (regular/irregular), Comparative/Superlative adjectives, Must, Have (got) to, Could. 
                VOCAB THEMES TO USE: Health, Weather, Town/City, Places & Directions, Transport, Sports. 
                NUMBERS: 21-100 and Ordinals 1st-20th. 
                FORBIDDEN: NEVER use Present Perfect or complex 'If' conditionals.`,
            flyers: `
                LEVEL: A2 Flyers. 
                GRAMMAR ALLOWED: Past continuous, Present perfect, Be going to, Will, Might, May, Should, Tag questions. 
                VOCAB THEMES TO USE: Environment, Space, Work/Jobs, Months, Materials. 
                NUMBERS: 101-1,000 and Ordinals 21st-31st.`
        };

        const currentRules = levelRules[level?.toLowerCase()] || levelRules.starters;

        const charactersWithTraits = characters.map(name => 
            `${name} (who is ${characterTraits[name] || 'a helpful friend'})`
        ).join(' and ');

        // 3. THE 5-ACT NARRATIVE ARC
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
        - Actively weave words from the allowed VOCAB THEMES into the story and the options.
        Leave the "vocabulary" array empty [].`;

        if (isFinalTurn) {
            taskInstruction = `
            Task: Write the final concluding paragraph (max 4 simple sentences).
            Narrative Stage: ${arcInstruction}
            
            CRITICAL RULES FOR ENDING:
            - Set the "options" array to be completely empty []. Do NOT give choices.
            - Review the entire story and extract 8 to 10 key English vocabulary words used (focusing on the VOCAB THEMES). Put them in the "vocabulary" array.`;
        }

        const promptText = `
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

        // 4. CALL GOOGLE (Direct Fetch to avoid crashes)
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: promptText }] }],
                generationConfig: {
                    maxOutputTokens: 500, 
                    temperature: 0.4 // Slightly higher than 0.3 to allow for more creative vocabulary use
                }
            })
        });

        const apiData = await response.json();

        if (!response.ok) {
            throw new Error(apiData.error?.message || "Google API rejected the request.");
        }

        const responseText = apiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
        
        // 5. THE SCISSORS (JSON Extractor)
        let cleanJson = responseText;
        const firstBrace = cleanJson.indexOf('{');
        const lastBrace = cleanJson.lastIndexOf('}');
        
        if (firstBrace !== -1 && lastBrace !== -1) {
            cleanJson = cleanJson.substring(firstBrace, lastBrace + 1);
        } else {
            throw new Error("No JSON formatting detected from the AI.");
        }

        return { statusCode: 200, headers, body: cleanJson };

    } catch (error) {
        console.error("Story Error:", error.message);
        const fallback = {
            story: `Oh no! The story book closed. (Error: ${error.message})`,
            options: [],
            vocabulary: []
        };
        return { statusCode: 200, headers, body: JSON.stringify(fallback) };
    }
};