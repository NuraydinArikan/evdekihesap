const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const geminiKey = defineSecret("GEMINI_KEY");

exports.askGemini = onCall(
    { region: "europe-west1", secrets: [geminiKey] },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError("unauthenticated", "Giriş yapmanız gerekiyor.");
        }
        try {
            const genAI = new GoogleGenerativeAI(geminiKey.value());
            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
            const result = await model.generateContent(request.data.prompt);
            return { text: result.response.text() };
        } catch (error) {
            console.error("Gemini hatası:", error);
            throw new HttpsError("internal", "AI şu an yanıt veremiyor.");
        }
    }
);