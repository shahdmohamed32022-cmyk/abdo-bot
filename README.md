const TelegramBot = require('node-telegram-bot-api');

// استلام التوكين من السيرفر
const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, {polling: true});

// رسالة الترحيب
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, "هلا يا عبودي ❤️ نورت يا صاحبي! البوت شغال أونلاين دلوقتي وزي الفل. تحب نبدأ بإيه؟");
});

// رد بسيط للتجربة
bot.on('message', (msg) => {
    if (msg.text.toString().toLowerCase().includes("ازيك")) {
        bot.sendMessage(msg.chat.id, "بخير يا صاحبي طول ما إنت بخير!");
    }
});

console.log("البوت شغال يا شهد ومستني أوامر...");
