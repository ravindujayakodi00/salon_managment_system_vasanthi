import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || "");

export const geminiModel = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || "gemini-2.0-flash-exp",
    systemInstruction: `Salon assistant. Be concise, use emojis. Support EN/SIN/TAM. 
NEVER invent services, prices, or slots. ONLY use the provided SERVICES LIST context if present. If you don't know, ask them to call.

BOOKING RULES:
1. To book an appointment, you MUST eventually collect: service_id, date, time, and customer_name.
2. Ask for these conversationally. Do not ask for everything at once.
3. If the user tells you some of this info, immediately call the "book_appointment" tool with what you know. 
4. The tool will save the progress and return a message telling you what is still missing.
5. If the tool returns "INCOMPLETE", politely ask the user for the missing fields.
6. Once the tool returns "SUCCESS", the booking is complete! Share the confirmation details with the user.`,
});

export const tools = [
    {
        functionDeclarations: [
            {
                name: "get_services",
                description: "Get a list of salon services, categories, and prices.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        category: {
                            type: "STRING",
                            description: "Optional category to filter services (e.g., Hair, Facial, Spa).",
                        },
                    },
                },
            },
            {
                name: "get_available_slots",
                description: "Get available time slots for a specific date and service.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        date: {
                            type: "STRING",
                            description: "The date in YYYY-MM-DD format.",
                        },
                        service_id: {
                            type: "STRING",
                            description: "The ID of the service.",
                        },
                    },
                    required: ["date", "service_id"],
                },
            },
            {
                name: "book_appointment",
                description: "Book a new appointment.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        customer_name: { type: "STRING" },
                        service_id: { type: "STRING" },
                        date: { type: "STRING", description: "YYYY-MM-DD" },
                        time: { type: "STRING", description: "HH:MM" },
                        stylist_id: { type: "STRING", description: "Optional stylist ID." },
                        email: { type: "STRING", description: "Optional customer email." },
                    },
                    required: ["customer_name", "service_id", "date", "time"],
                },
            },
            {
                name: "get_customer_appointments",
                description: "Get upcoming appointments for the current customer.",
                parameters: {
                    type: "OBJECT",
                    properties: {},
                },
            },
            {
                name: "cancel_appointment",
                description: "Cancel an existing appointment.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        appointment_id: { type: "STRING" },
                    },
                    required: ["appointment_id"],
                },
            },
            {
                name: "get_loyalty_info",
                description: "Get customer loyalty points, rewards, and card status.",
                parameters: {
                    type: "OBJECT",
                    properties: {},
                },
            },
            {
                name: "check_promo_code",
                description: "Validate a promo code and get discount details.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        code: { type: "STRING" },
                    },
                    required: ["code"],
                },
            },
        ],
    },
];
