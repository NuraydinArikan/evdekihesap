const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret }       = require("firebase-functions/params");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");

// ─────────────────────────────────────────────
// JSON ayrıştırıcı — LLM yanıtlarını güvenle parse eder
// ─────────────────────────────────────────────
function _jsonParse(metin) {
    if (!metin) throw new Error("Boş yanıt");

    let temiz = metin
        .replace(/```json\s*/gi, "")
        .replace(/```\s*/g, "")
        .trim();

    const bas = temiz.indexOf("{");
    if (bas === -1) throw new Error("JSON bulunamadı");
    temiz = temiz.substring(bas);

    const son = temiz.lastIndexOf("}");
    const tam = son !== -1 ? temiz.substring(0, son + 1) : temiz;

    if (son !== -1) {
        try { return JSON.parse(tam); } catch (e1) {}
    }

    if (son !== -1) {
        try {
            const duz = tam.replace(
                /"((?:[^"\\]|\\.)*)"/g,
                (_, v) => '"' + v.replace(/\n/g, "\\n").replace(/\r/g, "\\r") + '"'
            );
            return JSON.parse(duz);
        } catch (e2) {}
    }

    try {
        let p = temiz.replace(/[\x00-\x1F\x7F]/g, " ").replace(/,\s*$/, "");
        if ((p.match(/"/g) || []).length % 2 !== 0) p += '"';
        const ac = (p.match(/{/g) || []).length;
        const ka = (p.match(/}/g) || []).length;
        for (let i = 0; i < ac - ka; i++) p += "}";
        return JSON.parse(p);
    } catch (e3) {
        throw new Error("JSON Parse error: " + e3.message);
    }
}

// ─────────────────────────────────────────────
// askGemini — Metin tabanlı AI yanıtı
// ─────────────────────────────────────────────
exports.askGemini = onCall(
    { region: "europe-west1", secrets: [GEMINI_API_KEY] },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError("unauthenticated", "Giriş yapmalısınız.");
        }

        const apiKey = GEMINI_API_KEY.value();
        if (!apiKey) {
            throw new HttpsError("failed-precondition", "Gemini API anahtarı yapılandırılmamış.");
        }

        const prompt = request.data?.prompt;
        if (!prompt || typeof prompt !== "string") {
            throw new HttpsError("invalid-argument", "Geçersiz veya eksik 'prompt' parametresi.");
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent(prompt);
        return { text: result.response.text() };
    }
);

// ─────────────────────────────────────────────
// askGeminiVision — Görüntü + metin AI yanıtı
// ─────────────────────────────────────────────
exports.askGeminiVision = onCall(
    { region: "europe-west1", secrets: [GEMINI_API_KEY] },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError("unauthenticated", "Giriş yapmalısınız.");
        }

        const apiKey = GEMINI_API_KEY.value();
        if (!apiKey) {
            throw new HttpsError("failed-precondition", "Gemini API anahtarı yapılandırılmamış.");
        }

        const prompt = request.data?.prompt;
        if (!prompt || typeof prompt !== "string") {
            throw new HttpsError("invalid-argument", "Geçersiz veya eksik 'prompt' parametresi.");
        }

        const image = request.data?.image;
        if (!image || typeof image !== "string") {
            throw new HttpsError("invalid-argument", "Geçersiz veya eksik 'image' parametresi.");
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            generationConfig: { temperature: 0.1 },
        });

        const imagePart = {
            inlineData: {
                data:     image,
                mimeType: request.data.mimeType || "image/jpeg",
            },
        };

        const result = await model.generateContent([prompt, imagePart]);
        return _jsonParse(result.response.text());
    }
);
