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

        // 1. THE ESOL BRAIN
        const levelRules = {
            starters: `LEVEL: Pre A1 Starters. GRAMMAR ALLOWED: Present simple, Present continuous, Can (ability), Have (got), There is/are. VOCAB THEMES TO USE: Animals, The body, Clothes, Colours, Family, Food, Home, School. NUMBERS: 1-20. FORBIDDEN: NEVER use past tense, future 'will', or comparative adjectives.`,
            movers: `LEVEL: A1 Movers. GRAMMAR ALLOWED: Past simple (regular/irregular), Comparative/Superlative adjectives, Must, Have (got) to, Could. VOCAB THEMES TO USE: Health, Weather, Town/City, Places & Directions, Transport, Sports. NUMBERS: 21-100 and Ordinals 1st-20th. FORBIDDEN: NEVER use Present Perfect or complex 'If' conditionals.`,
            flyers: `LEVEL: A2 Flyers. GRAMMAR ALLOWED: Past continuous, Present perfect, Be going to, Will, Might, May, Should, Tag questions. VOCAB THEMES TO USE: Environment, Space, Work/Jobs, Months, Materials. NUMBERS: 101-1,000 and Ordinals 21st-31st.`
        };

        const currentRules = levelRules[level?.toLowerCase()] || levelRules.starters;
        const chars = characters.map(name => `${name} (${characterTraits[name] || 'a friend'})`).join(' and ');

        // 2. THE NARRATIVE ARC
        let arcInstruction = "";
        let isFinalTurn = false;

        switch (currentTurn) {
            case 1: arcInstruction = `Act 1: Introduction. Introduce characters and ${setting}. Problem ('${problem}') MUST happen.`; break;
            case 2: arcInstruction = `Act 2: Exploration. They try to fix it, but discover a new complication.`; break;
            case 3: arcInstruction = `Act 3: Rising Action. Things get more difficult or silly.`; break;
            case 4: arcInstruction = `Act 4: Climax. The final hurdle to fixing ('${problem}').`; break;
            default: isFinalTurn = true; arcInstruction = `Act 5: Resolution. They successfully solve ('${problem}'). Everyone is happy.`; break;
        }

        const promptText = `
        You are an expert ESOL teacher writing a choose-your-own-adventure story.
        Target Audience: Spanish students learning English (children).
        ${currentRules}
        Language: British English spelling and phrasing only.
        
        Characters: ${chars}
        Setting: A ${setting}. 
        Core Problem: ${problem}.
        Teacher Instructions: ${teacherNotes || 'None'}
        Previous History: ${history || 'Start of the story.'}
        
        Narrative Stage: ${arcInstruction}
        
        You MUST reply in plain text exactly matching this format:
        [STORY]
        (Write 2-3 short sentences advancing the story here.)
        [OPTIONS]
        ${isFinalTurn ? "NONE" : "- (Option 1)\n- (Option 2)\n- (Option 3)"}
        [VOCABULARY]
        ${isFinalTurn ? "(List 8 English vocabulary words used, separated by commas)" : "NONE"}
        `;

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

        let attempts = 0;
        let rawAiText = "";

        // 3. THE RETRY LOOP (Safety Net)
        while (attempts < 3) {
            attempts++;
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ role: "user", parts: [{ text: promptText }] }],
                        safetySettings: [
                            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
                        ],
                        generationConfig: { maxOutputTokens: 1000, temperature: 0.5 }
                    })
                });

                const apiData = await response.json();
                if (!response.ok) throw new Error(apiData.error?.message || "Google blocked it");
                
                rawAiText = apiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
                if (rawAiText) break;

            } catch (error) {
                if (attempts >= 3) throw error;
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        // 4. THE PLAIN TEXT EXTRACTOR
        let finalStory = "They looked around, unsure of what to do next!";
        let finalOptions = ["Look carefully", "Wait a minute", "Try something else"];
        let finalVocab = [];

        const storyMatch = rawAiText.match(/\[STORY\]([\s\S]*?)\[OPTIONS\]/i);
        if (storyMatch) finalStory = storyMatch[1].trim();

        const optionsMatch = rawAiText.match(/\[OPTIONS\]([\s\S]*?)(?:\[VOCABULARY\]|$)/i);
        if (optionsMatch) {
            let rawOpts = optionsMatch[1].trim().split('\n');
            let cleanedOpts = rawOpts.map(o => o.replace(/^[-*1-9.)\s]+/, '').trim()).filter(o => o !== '' && o.toUpperCase() !== 'NONE');
            if (cleanedOpts.length > 0) finalOptions = cleanedOpts.slice(0, 3);
        }

        const vocabMatch = rawAiText.match(/\[VOCABULARY\]([\s\S]*)/i);
        if (vocabMatch) {
            let rawVocab = vocabMatch[1].trim();
            if (rawVocab && !rawVocab.toLowerCase().includes('none')) {
                finalVocab = rawVocab.split(',').map(v => v.trim()).filter(v => v !== '');
            }
        }

        const safeData = {
            story: finalStory,
            options: isFinalTurn ? [] : finalOptions,
            vocabulary: finalVocab
        };

        return { statusCode: 200, headers, body: JSON.stringify(safeData) };

    } catch (error) {
        return { 
            statusCode: 200, 
            headers, 
            body: JSON.stringify({ 
                story: `The connection dropped! Let's try that again. (Error: ${error.message})`, 
                options: ["Try again"], 
                vocabulary: [] 
            }) 
        };
    }
};