const { Telegraf, Markup } = require('telegraf');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

// Initialize the Telegram bot
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Initialize the Google Generative AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Use gemini-2.5-flash with extremely casual/friendly persona
const model = genAI.getGenerativeModel({ 
    model: "gemini-2.5-flash",
    systemInstruction: "أنت صديق مقرب جداً لـ 'عبودي ❤️' (الانتيم بتاعه). أنت تساعده ليتعلم الإنجليزي (مستوى A1). أسلوبك كاجوال وعامي جداً، كأنكم بتدردشوا على الواتساب. الردود يجب أن تكون قصيرة جداً جداً (سطر أو سطرين بالكثير) وبدون أي مقدمات روبوتية نهائياً. لا تقل 'طبعاً' ولا 'بصفتي ذكاء اصطناعي'. ادخل في الموضوع فوراً. كافئه وشجعه، ولو أخطأ صلح له بهزار وبساطة."
});

// In-memory stores
const userChats = new Map();
const userActivity = new Map();
const userPoints = new Map();

function updateActivity(chatId) {
    userActivity.set(chatId, Date.now());
}

function addPoints(chatId, points) {
    const current = userPoints.get(chatId) || 0;
    userPoints.set(chatId, current + points);
    return current + points;
}

bot.use((ctx, next) => {
    if (ctx.chat) {
        updateActivity(ctx.chat.id);
    }
    return next();
});

function getChatSession(chatId) {
    if (!userChats.has(chatId)) {
        userChats.set(chatId, model.startChat({ history: [] }));
    }
    return userChats.get(chatId);
}

// Grouped Main Menu
function getMainMenu() {
    return Markup.inlineKeyboard([
        [Markup.button.callback('📖 قصة عالسريع', 'menu_stories'), Markup.button.callback('💡 كلمة في السريع', 'menu_vocab')],
        [Markup.button.callback('📑 قاعدة في كبسولة', 'menu_grammar'), Markup.button.callback('🔤 نطق الحروف', 'menu_phonetics')],
        [Markup.button.callback('🎤 اسمع نطقي (فويس)', 'menu_pronunciation'), Markup.button.callback('🧠 تحدي سريع', 'menu_quiz')],
        [Markup.button.callback('🗣 ندردش انجلش', 'menu_chat')],
        [Markup.button.callback('🎯 خطتي والنقاط', 'menu_plan')]
    ]);
}

bot.start((ctx) => {
    return ctx.reply('هلا يا عبودي ❤️ نورت يا صاحبي! جاهز نظبط الانجلش بتاعك النهارده؟ اختار اللي تحبه من هنا:', getMainMenu());
});

bot.on('callback_query', async (ctx) => {
    const data = ctx.callbackQuery.data;
    let prompt = "";
    
    // Reward interaction
    addPoints(ctx.chat.id, 1);

    if (data === 'main_menu') {
        await ctx.answerCbQuery();
        try { await ctx.editMessageReplyMarkup(undefined); } catch (e) {}
        return ctx.reply('ها يا صاحبي تحب نكمل إيه؟', getMainMenu());
    }
    
    if (data === 'menu_stories') {
        prompt = "احكيلي قصة بالانجلش (مستوى A1) تكون طويلة نسبيا (حوالي 12 إلى 15 سطر) وتفاصيلها ممتعة ومفيدة، وبعدها اكتب ترجمتها بالكامل. بدون مقدمات.";
    } else if (data === 'menu_vocab') {
        prompt = "اديني 3 كلمات انجلش بنستخدمهم كل يوم، معناهم ومثال بسيط عليهم. بدون رغي.";
    } else if (data === 'menu_grammar') {
        prompt = "اشرحلي قاعدة انجلش للمبتدئين في سطرين بس وبدون كلكعة، مع مثالين.";
    } else if (data === 'menu_phonetics') {
        prompt = "اشرحلي نطق حرفين مركبين (زي ch أو sh) في سطرين بس وبطريقة مضحكة أو سهلة تخليني منسهاش.";
    } else if (data === 'menu_chat') {
        prompt = "عايزين ندردش كأننا صحاب على الواتساب. ابدأ انت واسألني سؤال بسيط جداً بالانجلش (مستوى A1) عشان أرد عليك.";
    } else if (data === 'menu_plan') {
        const pts = userPoints.get(ctx.chat.id) || 0;
        prompt = `قولي خطة الأسبوع ده في سطرين. وباركلي إن معايا ${pts} نقطة لحد دلوقتي، وحمسني أجمع أكتر.`;
    } else if (data === 'menu_quiz') {
        await ctx.answerCbQuery();
        try { await ctx.editMessageReplyMarkup(undefined); } catch (e) {}
        return sendQuiz(ctx);
    } else if (data === 'menu_pronunciation') {
        await ctx.answerCbQuery();
        try { await ctx.editMessageReplyMarkup(undefined); } catch (e) {}
        return ctx.reply('ابعتلي فويس 🎤 وأنت بتقرأ أي حاجة بالانجلش، وهسمعك وأقولك رأيي يا صاحبي!', Markup.inlineKeyboard([
            [Markup.button.callback('🔙 نرجع للقائمة', 'main_menu')]
        ]));
    }
    
    await ctx.answerCbQuery();
    
    if (prompt) {
        try { await ctx.editMessageReplyMarkup(undefined); } catch (e) {}
        await ctx.reply(`*ثواني يا صاحبي بظبطلك الدنيا...* ⏳`, { parse_mode: 'Markdown' });
        await processMessage(ctx, prompt, true);
    }
});

bot.on('text', async (ctx) => {
    addPoints(ctx.chat.id, 1);
    const prompt = ctx.message.text;
    await processMessage(ctx, prompt, false);
});

bot.on('voice', async (ctx) => {
    try {
        addPoints(ctx.chat.id, 2);
        await ctx.reply("⏳ بسمعك يا صاحبي...");
        ctx.sendChatAction('typing');
        
        const fileLink = await ctx.telegram.getFileLink(ctx.message.voice.file_id);
        const response = await fetch(fileLink.href);
        const arrayBuffer = await response.arrayBuffer();
        const base64Audio = Buffer.from(arrayBuffer).toString('base64');
        
        const chatSession = getChatSession(ctx.chat.id);
        const result = await chatSession.sendMessage([
            {
                inlineData: {
                    data: base64Audio,
                    mimeType: ctx.message.voice.mime_type || 'audio/ogg'
                }
            },
            "هذا فويس مني بقرأ انجلش. اسمعني وقولي رأيك كصاحبي. لو في كلمة غلط صلحها لي بهزار وبشكل قصير جدا. وفي آخر رسالتك حط الكلمة الصح أو اللي محتاجة تدريب بين أقواس مربعة [word] عشان النظام ينطقها لي."
        ]);
        
        const aiResponse = await result.response;
        const text = aiResponse.text();
        
        await ctx.reply(text);
        
        const match = text.match(/\[(.*?)\]/);
        if (match && match[1]) {
            const englishPhrase = match[1].trim();
            const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(englishPhrase)}&tl=en&client=tw-ob`;
            await ctx.replyWithVoice({ url: ttsUrl }, { caption: `اسمع النطق الصح هنا 🎧: ${englishPhrase}` });
        }
        
        await ctx.reply("تحب نعمل إيه تاني؟", Markup.inlineKeyboard([
            [Markup.button.callback('🔙 نرجع للقائمة', 'main_menu')]
        ]));
        
    } catch (error) {
        console.error('Error processing voice:', error);
        handleError(ctx, error);
    }
});

async function sendQuiz(ctx) {
    try {
        ctx.sendChatAction('typing');
        const chatSession = getChatSession(ctx.chat.id);
        const result = await chatSession.sendMessage("اعمل لي سؤال اختيارات (كويز) واحد فقط بالانجليزي لمستوى A1. الرد يجب أن يكون بصيغة JSON فقط بدون أي كلام إضافي أو مقدمات، بهذا الشكل بالضبط:\n{\"question\": \"السؤال هنا؟\", \"options\": [\"اختيار1\", \"اختيار2\", \"اختيار3\", \"اختيار4\"], \"correct_index\": 0}");
        const text = result.response.text();
        
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const quizData = JSON.parse(jsonMatch[0]);
            await ctx.replyWithQuiz(quizData.question, quizData.options, { 
                correct_option_id: quizData.correct_index,
                is_anonymous: false
            });
            
            await ctx.reply("عاش يا وحش! تحب نكمل؟", Markup.inlineKeyboard([
                [Markup.button.callback('🔙 القائمة الرئيسية', 'main_menu')]
            ]));
        } else {
            throw new Error("No JSON found");
        }
    } catch (e) {
        console.error("Quiz error:", e);
        ctx.reply("معلش الكويز علق، جرب تاني يا صاحبي 😂", Markup.inlineKeyboard([
            [Markup.button.callback('🔙 نرجع للقائمة', 'main_menu')]
        ]));
    }
}

async function processMessage(ctx, prompt, fromMenu) {
    try {
        ctx.sendChatAction('typing');
        
        const chatSession = getChatSession(ctx.chat.id);
        const result = await chatSession.sendMessage(prompt);
        const response = await result.response;
        const text = response.text();
        
        if (fromMenu) {
            await ctx.reply(text, Markup.inlineKeyboard([
                [Markup.button.callback('🔙 القائمة الرئيسية', 'main_menu')]
            ]));
        } else {
            await ctx.reply(text);
        }
    } catch (error) {
        console.error('Error generating content:', error);
        handleError(ctx, error);
    }
}

function handleError(ctx, error) {
    let errorMsg = 'معلش يا صاحبي، في حاجة علقت. جرب تاني.';
    const errStr = String(error) + (error.message || '') + (error.status || '');
    if (errStr.includes('429') || errStr.includes('quota') || errStr.includes('Too Many Requests')) {
        errorMsg = 'يا صاحبي السيرفر عليه ضغط أو الباقة خلصت ⏳. استنى دقيقة وجرب تاني.';
    }
    
    ctx.reply(errorMsg, Markup.inlineKeyboard([
        [Markup.button.callback('🔙 القائمة الرئيسية', 'main_menu')]
    ]));
}

// Inactivity Reminder
setInterval(() => {
    const now = Date.now();
    for (const [chatId, lastActive] of userActivity.entries()) {
        if (now - lastActive > 86400000 && now - lastActive < 172800000) { 
            bot.telegram.sendMessage(chatId, "يا صاحبي مختفي بقالك يوم! 😅 تعالى ناخد كلمة عالسريع أو ندردش شوية.", getMainMenu())
                .catch(err => console.error("Could not send reminder:", err));
            updateActivity(chatId); 
        }
    }
}, 3600000); 

bot.launch();
console.log('Telegram bot is running...');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
