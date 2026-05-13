import OpenAI from "openai";
const openAi = new OpenAI();

export const askChatGPT = async (message, messages) => {
    try {
        const history = messages.map((msg) => ({
            role: msg.sender_id == process.env.CHAT_BOT_ID ? 'assistant' : 'user',
            content: msg.message,
        }));

        const chatCompletion = await openAi.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                ...history, { role: 'user', content: message }
            ],
        });

        return chatCompletion.choices[0].message.content;
    } catch (e) {
        console.log(`AI ERROR: ${e}`);
        return 'Something went wrong...';
    }
}

