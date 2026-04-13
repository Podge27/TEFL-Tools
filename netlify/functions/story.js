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
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

    try {
        const data = JSON.parse(event.body);
        const { level, characters, setting, problem, teacherNotes, history, currentTurn } = data;

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        // MODEL KEPT AT 2.5 FLASH
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash",
            generationConfig: { temperature: 0.3, maxOutputTokens: 500 } // FIXED: Token limit raised
        });

        // THE ORIGINAL, DETAILED FENCES
        const levelRules = {
            starters: `LEVEL: Pre A1 Starters. Use Present Simple/Continuous, 'Can', 'Have got'. NUMBERS: 1-20. THEMES: Animals, Food, Body, Home.`,
            movers: `LEVEL: A1 Movers. Use Past Simple, Comparatives (bigger than), 'Must', 'Have to'. NUMBERS: 21-100. THEMES: Health, Weather, Town.`,
            flyers: `LEVEL: A2 Flyers. Use Present Perfect, Future 'will', 'Might', 'Should'. NUMBERS: 101-1000. THEMES: Space, Work, Environment.`
        };

        const currentRules = levelRules[level.toLowerCase()] || levelRules.starters;

        const charactersWithTraits = characters.map(name => 
            `${name} (who is ${characterTraits[name] || 'a helpful friend'})`
        ).join(' and ');

        // THE ORIGINAL 5-ACT ARC
        let arcInstruction = "";
        let isFinalTurn = false;

        switch (currentTurn) {
            case 1: arcInstruction = `Act 1: Intro. Start with 'First,'. Introduce characters and ${setting}. Problem: ${problem}.`; break;
            case 2: arcInstruction = `Act 2: Obstacle. Start with 'Then,'. They try to fix it but a new problem appears.`; break;
            case 3: arcInstruction = `Act 3: Action. Start with 'After that,'. They must work together.`; break;
            case 4: arcInstruction = `Act 4: Climax. Start with 'Later,'. This is the final big hurdle.`; break;
            default:
                isFinalTurn = true;
                arcInstruction = `Act 5: Ending. Start with 'Finally,'. They solve the problem ('${problem}'). Happy ending!`;
                break;
        }

        let taskInstruction = `
            Task: Write a short paragraph (max 3 simple sentences). 
            Narrative Stage: ${arcInstruction}
            CRITICAL: Model the use of the starting sequence linker provided above.
            Provide exactly 3 options for the next action. 
            Leave the "vocabulary" array empty [].`;

        if (isFinalTurn) {
            taskInstruction = `
                Task: Write the final concluding paragraph (max 4 simple sentences).
                Narrative Stage: ${arcInstruction}
                CRITICAL: Start with 'Finally,'. Clear the "options" array [].
                Extract 8-10 key vocabulary words from the whole story for the "vocabulary" array.`;
        }

        const prompt = `
            You are an expert ESOL teacher. 
            CEFR Level: ${currentRules}. Strictly follow these grammar and vocabulary limits.
            Spelling: British English only.
            
            Story Elements:
            - Characters: ${charactersWithTraits}.
            - Setting: ${setting}. 
            - Problem: ${problem}.
            - Teacher Notes: ${teacherNotes || 'None'}
            
            History: ${history || 'Start of story.'}
            
            ${taskInstruction}
            
            Respond ONLY in this JSON format without markdown tags:
            {
                "story": "...",
                "options": ["A) ...", "B) ...", "C) ..."],
                "vocabulary": []
            }
        `;

        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            safetySettings: [
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_LOW_AND_ABOVE" },
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" }
            ]
        });

        // ROBUST EXTRACTION
        const responseText = result.response.text();
        const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        
        return { statusCode: 200, body: cleanJson };

    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ story: 'The story got stuck! Let\'s try again.', options: [], vocabulary: [] }) };
    }
};