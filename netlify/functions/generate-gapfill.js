const { GoogleGenerativeAI } = require("@google/generative-ai");

exports.handler = async function(event, context) {
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    try {
        const { level, category, topic, target } = JSON.parse(event.body);

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = `
        You are an expert English teacher creating an exercise for Spanish students.
        Level: ${level}
        Category: ${category}
        Topic: ${topic}
        Target Language: ${target}
        
        Create exactly 6 separate practice sentences.
        Each sentence must have ONE missing word, replaced with [1], [2], [3], [4], [5], [6].
        
        CRITICAL RULES BASED ON CATEGORY:
        If Category is "grammar": 
        - You MUST place the base form of the missing verb in brackets immediately after the gap. Example: "I have never [1] (be) to London."
        - Leave the "word_bank" array completely empty [].
        
        If Category is "vocabulary":
        - Do NOT put any hints or brackets in the sentences.
        - You MUST provide all 6 answers inside the "word_bank" array in a randomised, shuffled order.

        Return ONLY a raw JSON object matching this exact format, with no markdown code blocks:
        {
          "title": "A short, engaging title",
          "level": "${level}",
          "type": "gapfill_sentences",
          "word_bank": ["shuffled", "words", "go", "here"],
          "items": [
            { "number": 1, "text": "Sentence text with [1] here.", "answer": "answer1" },
            { "number": 2, "text": "Second sentence with [2] here.", "answer": "answer2" }
          ]
        }
        `;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text().trim();

        return {
            statusCode: 200,
            body: responseText
        };

    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "The AI factory had a problem." })
        };
    }
};