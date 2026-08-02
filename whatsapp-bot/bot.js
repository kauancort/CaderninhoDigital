const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
require('dotenv').config();

const { processarMensagem } = require('./flow');

const client = new Client({
    authStrategy: new LocalAuth({
        clientId: 'caderninho-teste'
    }),
    puppeteer: {
        headless: false,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage'
        ]
    }
});

client.on('qr', (qr) => {
    console.log('📱 Escaneie o QR Code:');
    qrcode.generate(qr, { small: true });
});

client.on('authenticated', () => {
    console.log('🔐 WhatsApp autenticado!');
});

client.on('ready', () => {
    console.log('✅ WhatsApp conectado e pronto!');
});

client.on('auth_failure', (msg) => {
    console.error('❌ Falha na autenticação:', msg);
});

client.on('disconnected', (reason) => {
    console.log('⚠️ WhatsApp desconectado:', reason);
});

client.on('message', async (message) => {
    console.log('📩 Mensagem recebida:', message.body || '(áudio)');

    try {
        const chatId = message.from;

        // Nota de voz / áudio
        const ehAudio = message.hasMedia && (message.type === 'ptt' || message.type === 'audio');
        if (ehAudio) {
            await message.reply('🎧 Ouvindo...');
            const media = await message.downloadMedia();
            if (!media) {
                await message.reply('Não consegui baixar o áudio, pode tentar mandar de novo?');
                return;
            }
            const resposta = await processarMensagem(chatId, {
                audioBase64: media.data,
                mime: media.mimetype,
            });
            await message.reply(resposta);
            console.log('📤 Resposta enviada!');
            return;
        }

        // Mensagem de texto
        if (message.body && message.body.trim()) {
            const resposta = await processarMensagem(chatId, { texto: message.body.trim() });
            await message.reply(resposta);
            console.log('📤 Resposta enviada!');
            return;
        }
    } catch (error) {
        console.error('❌ Erro ao processar mensagem:', error);
        try {
            await message.reply('Desculpa, meu bem, tive um probleminha aqui. Pode tentar de novo?');
        } catch (_) {
            // ignora erro ao tentar responder
        }
    }
});

client.initialize();