
import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase';
import { sendWhatsAppMessage, createTextMessage } from '@/lib/whatsapp';
import crypto from 'crypto';
import { geminiModel, tools } from '@/lib/whatsapp/gemini';
import { handleFunctionCall } from '@/lib/whatsapp/function-handlers';
import { conversationManager } from '@/lib/whatsapp/conversation-manager';
import { intentRouter } from '@/lib/whatsapp/intent-router';
import { ragContext } from '@/lib/whatsapp/rag-context';

// Verify request signature from Meta
function verifySignature(req: NextRequest, rawBody: string): boolean {
    const signature = req.headers.get('x-hub-signature-256');
    if (!signature) return false;

    const appSecret = process.env.WHATSAPP_APP_SECRET;
    if (!appSecret) {
        console.warn('WHATSAPP_APP_SECRET not set - skipping signature verification');
        return true;
    }

    const expectedSig = 'sha256=' + crypto
        .createHmac('sha256', appSecret)
        .update(rawBody)
        .digest('hex');

    return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSig)
    );
}

// Verify Webhook (GET)
export async function GET(req: NextRequest) {
    const mode = req.nextUrl.searchParams.get('hub.mode');
    const token = req.nextUrl.searchParams.get('hub.verify_token');
    const challenge = req.nextUrl.searchParams.get('hub.challenge');

    if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
        return new NextResponse(challenge, { status: 200 });
    }
    return new NextResponse('Forbidden', { status: 403 });
}

// Handle Incoming Messages (POST)
export async function POST(req: NextRequest) {
    try {
        const rawBody = await req.text();

        if (!verifySignature(req, rawBody)) {
            console.error('Invalid WhatsApp webhook signature');
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const body = JSON.parse(rawBody);
        const supabase = getAdminClient();

        console.log('📩 WhatsApp Webhook received:', JSON.stringify(body, null, 2));

        const entry = body.entry?.[0];
        const changes = entry?.changes?.[0];
        const value = changes?.value;
        const message = value?.messages?.[0];

        console.log('📨 Extracted message:', message ? JSON.stringify(message, null, 2) : 'NONE');

        if (message) {
            const from = message.from;
            // Prioritize the ID of interactive replies, fallback to the title, then to normal text body
            const text = message.interactive?.button_reply?.id || 
                         message.interactive?.list_reply?.id || 
                         message.interactive?.button_reply?.title || 
                         message.interactive?.list_reply?.title || 
                         message.text?.body || 
                         '';

            if (!text) {
                console.log('⏭️ Skipping non-text message');
                return NextResponse.json({ success: true });
            }

            console.log(`📱 From: ${from} | Msg: ${text}`);

            // 0. Check Environment
            const googleKey = process.env.GOOGLE_AI_API_KEY;
            const waToken = process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_API_TOKEN;
            const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

            if (!googleKey) console.warn('⚠️ GOOGLE_AI_API_KEY is missing');
            if (!waToken) console.warn('⚠️ WHATSAPP_ACCESS_TOKEN/WHATSAPP_API_TOKEN is missing');
            if (!phoneId) console.warn('⚠️ WHATSAPP_PHONE_NUMBER_ID is missing');

            // 1. Check Intent Router
            console.log('🧭 Checking intent router...');
            const intent = intentRouter.detectIntent(text);
            console.log(`🎯 Detected Intent: ${intent}`);
            
            // Note: START_BOOKING returns false so it falls through to the LLM
            const routerHandled = await intentRouter.handleIntent(intent, from);
            if (routerHandled) {
                console.log('✅ Handled by intent router (0 tokens!)');
                return NextResponse.json({ success: true });
            }
            
            const routerHandledIntent = await intentRouter.handleIntent(intent, from);
            if (routerHandledIntent) {
                console.log('✅ Handled by intent router (0 tokens!)');
                return NextResponse.json({ success: true });
            }

            // --- LLM FALLBACK PATH ---
            console.log('🔮 Falling back to Gemini AI...');

            // 3. Get Conversation History
            const history = await conversationManager.getHistory(from);
            
            // 4. Build RAG Context (only inject if necessary, but for simplicity we inject compact context)
            const servicesContext = await ragContext.getCompactServicesContext();
            
            // Inject context directly into the first message or as a system message override if API allows
            // We'll pre-pend it to the user's message to give immediately relevant context
            const enrichedText = `[SYSTEM RAG CONTEXT:\n${servicesContext}\nCURRENT DATE: ${new Date().toLocaleDateString()}]\n\nCustomer: ${text}`;

            const chat = geminiModel.startChat({
                history: history,
                tools: tools as any,
            });

            console.log('✉️ Sending message to Gemini...');
            const result = await chat.sendMessage(enrichedText);
            let response = result.response;
            console.log('🤖 Gemini responded');

            // 5. Handle Function Calls
            let callCount = 0;
            while (response.candidates?.[0]?.content?.parts?.some(p => p.functionCall) && callCount < 5) {
                const parts = response.candidates[0].content.parts;
                const toolResults = [];

                for (const part of parts) {
                    if (part.functionCall) {
                        const { name, args } = part.functionCall;
                        console.log(`🛠️ AI calling function: ${name}`);
                        const functionResult = await handleFunctionCall(name, args, from);
                        toolResults.push({
                            functionResponse: {
                                name,
                                response: {
                                    result: functionResult
                                }
                            }
                        });
                    }
                }

                if (toolResults.length > 0) {
                    const nextResult = await chat.sendMessage(toolResults);
                    response = nextResult.response;
                }
                callCount++;
            }

            const finalAiText = response.text();
            console.log('📝 Final AI Text prepared');

            // 6. Send Response to WhatsApp
            console.log('🚀 Sending WhatsApp reply...');
            const waResult = await sendWhatsAppMessage(from, createTextMessage(finalAiText));
            console.log('📬 WhatsApp Send Result:', waResult ? 'SUCCESS' : 'FAILED');

            // 7. Save History (Save original text, not enriched context text)
            console.log('💾 Saving history...');
            await conversationManager.saveMessage(from, 'user', text);
            await conversationManager.saveMessage(from, 'model', finalAiText);
            console.log('✨ Done!');
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Webhook Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}


