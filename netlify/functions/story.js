// File: netlify/functions/story.js
const { GoogleGenerativeAI } = require('@google/generative-ai');

// 1. The Character Personality Dictionary
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
    const { level, characters, setting, problem, teacherNotes, history } = data;

    // 2. Wake up Gemini 2.5 Flash
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // 3. Match the chosen names to their personalities
    const charactersWithTraits = characters.map(name => 
        `${name} (who is ${characterTraits[name] || 'a helpful friend'})`
    ).join(' and ');

    // 4. The Super-Strict Teacher Prompt
    const prompt = `
        You are an expert ESOL teacher writing a choose-your-own-adventure story.
        Target Audience: Spanish students learning English (children).
        CEFR Level: Cambridge ${level}. You MUST restrict your vocabulary and grammar strictly to this level.
        Language: British English spelling and phrasing only.
        
        Story Elements:
        - Characters: ${charactersWithTraits}. Show their personalities in the action.
        - Setting: A ${setting}. Make sure to describe the environment simply.
        - Core Problem: ${problem}. Introduce this naturally if this is the start of the story.
        - Teacher Instructions: ${teacherNotes || 'None'}
        
        Previous Story History: 
        ${history || 'This is the very first paragraph of the story.'}
        
        Task: Write the next short paragraph of the story (maximum 3 simple sentences). Then, provide exactly 3 simple options for what the characters should do next.
        
        Respond ONLY in the following JSON format without any markdown formatting:
        {
            "story": "The story text goes here...",
            "options": ["A) First option", "B) Second option", "C) Third option"]
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
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to generate story' })
        };
    }
};