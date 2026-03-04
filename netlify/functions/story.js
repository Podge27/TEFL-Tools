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

    const data = JSON.parse(event.body);
    // We now receive the exact turn number from the frontend
    const { level, characters, setting, problem, teacherNotes, history, currentTurn } = data;

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const charactersWithTraits = characters.map(name => 
        `${name} (who is ${characterTraits[name] || 'a helpful friend'})`
    ).join(' and ');

    // --- THE 5-ACT NARRATIVE ARC ---
    let arcInstruction = "";
    let isFinalTurn = false;

    switch (currentTurn) {
        case 1:
            arcInstruction = `Act 1: Introduction. Introduce the characters and the ${setting}. By the end of this paragraph, the core problem ('${problem}') MUST happen. The 3 choices must be how they initially react to the problem.`;
            break;
        case 2:
            arcInstruction = `Act 2: Exploration. The characters try to fix the problem, but discover a new complication or obstacle. The 3 choices must be how they handle this new obstacle.`;
            break;
        case 3:
            arcInstruction = `Act 3: Rising Action. Things get a bit more difficult or silly based on their last choice. They must work together. The 3 choices must be their next big idea to solve it.`;
            break;
        case 4:
            arcInstruction = `Act 4: The Climax. This is the final hurdle. They are very close to fixing the problem ('${problem}'). The 3 choices must be the final action they take to try and win/fix it.`;
            break;
        default:
            // Turn 5 (or if it somehow goes over) is always the end.
            isFinalTurn = true;
            arcInstruction = `Act 5: Resolution. The characters successfully solve the problem ('${problem}') using the choice they just made. Everyone is happy.`;
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
        CEFR Level: Cambridge ${level}. Restrict vocabulary and grammar strictly to this level.
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
        }
    `;

    try {
        const result = await model.generateContent(prompt);
        const cleanText = (await result.response).text().replace(/```json/g, '').replace(/```/g, '').trim();
        return { statusCode: 200, body: cleanText };
    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: 'Failed to generate story' }) };
    }
};