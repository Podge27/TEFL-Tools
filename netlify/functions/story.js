const { GoogleGenerativeAI } = require('@google/generative-ai');

// 1. YOUR Specific Character Personality Dictionary (The Soul of the app)
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
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const data = JSON.parse(event.body);
    // We need 'isFinalTurn' to know when to stop the story
    const { level, characters, setting, problem, teacherNotes, history, isFinalTurn } = data;

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // 2. Match the chosen names to YOUR specific personalities
    const charactersWithTraits = characters.map(name => 
        `${name} (who is ${characterTraits[name] || 'a helpful friend'})`
    ).join(' and ');

    // 3. Define the Task based on whether it is the Middle or the End of the story
    let taskInstruction;

    if (isFinalTurn) {
        // --- ENDING MODE ---
        taskInstruction = `
        Task: Write the final concluding paragraph of the story (max 4 simple sentences). 
        - Resolution: The characters must solve the problem happily.
        - Options: Set the "options" array to be empty []. DO NOT provide any choices.
        - Vocabulary: Review the WHOLE story and extract 8-10 key English words used. Put them in the "vocabulary" array.
        `;
    } else {
        // --- ADVENTURE MODE ---
        taskInstruction = `
        Task: Write the next short paragraph of the story (max 3 simple sentences).
        - Options: Provide exactly 3 options for what the characters should do next.
        - CRITICAL RULE FOR OPTIONS: The choices must be ACTIVE DECISIONS taken by the characters (e.g., "Open the box", "Run to the door"). Do NOT offer passive events (e.g., "It starts raining").
        - Vocabulary: Set the "vocabulary" array to be empty [].
        `;
    }

    // 4. The Master Prompt
    const prompt = `
        You are an expert ESOL teacher writing a choose-your-own-adventure story.
        Target Audience: Spanish students learning English (children).
        CEFR Level: Cambridge ${level}. You MUST restrict your vocabulary and grammar strictly to this level.
        Language: British English spelling and phrasing only.
        
        Story Elements:
        - Characters: ${charactersWithTraits}. Show these specific personalities in the action!
        - Setting: A ${setting}. Describe the environment simply.
        - Core Problem: ${problem}.
        - Teacher Instructions: ${teacherNotes || 'None'}
        
        Previous Story History: 
        ${history || 'This is the very first paragraph of the story.'}
        
        ${taskInstruction}
        
        Respond ONLY in the following JSON format without any markdown formatting:
        {
            "story": "The story text goes here...",
            "options": ["A) First active option", "B) Second active option", "C) Third active option"],
            "vocabulary": ["word1", "word2"]
        }
    `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        // Clean the response just in case the AI wraps it in markdown code blocks
        const cleanText = response.text().replace(/```json/g, '').replace(/```/g, '').trim();

        return {
            statusCode: 200,
            body: cleanText
        };
    } catch (error) {
        console.error("Error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to generate story' })
        };
    }
};