exports.handler = async (event) => {
    // 1. Only allow "POST" messages
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    const apiKey = process.env.GEMINI_API_KEY;

    // 2. Unpack the message from the website
    // We wrap this in a try/catch in case the JSON is broken
    try {
        const { history, newMessage } = JSON.parse(event.body);

        // 3. Define the Jimmy Rules (System Instruction)
        const systemInstruction = {
            parts: [{
                text: `
                ROLE: You are Jimmy, a 9-year-old stickman.
                TONE: Silly, kind, energetic. Use British spelling. 
                LANGUAGE LEVEL: Cambridge Movers (A1). Very short, simple sentences only. One question at a time.
                
                YOUR LIFE:
                - You live in Scotland.
                - You love bananas, pizza, and zoo animals.
                - Best friend: Katy (curly hair, clever).
                - Siblings: Denny (older), Belinda (younger).
                - Abilities: You can go to space, talk to animals.
                - Stories: You fall doen a lot but only use the "I fell down" joke if telling a story about "yesterday" or the past.

                CRITICAL SAFETY RULES:
                - NEVER ask for a student's name, school, city, or address.
                - If asked about your location, say you live in Scotland.
                - If a student is abusive, ignore it and talk about pizza.

                TEACHING MODE:
                - Stay strictly on the topic the child raises.
                - If the user makes a grammar mistake, echo it back correctly in a natural way.
                - Example: "it yummy" -> "It is yummy!"
                - Activities: Occasionally suggest a "Movers" vocabulary guessing game, ask for the "odd one out," or tell a simple "Knock, knock" joke.
                - Encourage participation: Ask questions like "Can you tell me all the places a person can swim?"
                `
            }]
        };

        // 4. Format the conversation for the API
        // We map your history to the format Gemini expects
        const contents = history.map(msg => ({
            role: msg.role,
            parts: msg.parts
        }));

        // Add the current message
        contents.push({
            role: "user",
            parts: [{ text: newMessage }]
        });

        // 5. THE URL YOU REQUESTED
        // We are using 'gemini-flash-latest' as verified by you
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;

        // 6. Send to Google
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: contents,
                systemInstruction: systemInstruction,
                generationConfig: {
                    maxOutputTokens: 150,
                    temperature: 0.7
                }
            })
        });

        const data = await response.json();

        // 7. Error Handling
        if (!response.ok) {
            console.error("Gemini API Error:", JSON.stringify(data));
            return {
                statusCode: 500,
                body: JSON.stringify({ error: "Jimmy is having a nap (API Error)." })
            };
        }

        // 8. Extract the answer
        // Safety check: sometimes the API returns an empty candidate if safety filters trigger
        if (!data.candidates || data.candidates.length === 0) {
            return {
                statusCode: 200, 
                body: JSON.stringify({ reply: "I don't know what to say to that! Do you like pizza?" }) 
            };
        }

        const replyText = data.candidates[0].content.parts[0].text;

        return {
            statusCode: 200,
            body: JSON.stringify({ reply: replyText })
        };

    } catch (error) {
        console.error("Function Error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Server Error" })
        };
    }
};