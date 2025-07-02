import pkg, { DisconnectReason } from '@whiskeysockets/baileys';
const { makeWASocket, useMultiFileAuthState } = pkg;
import { GoogleGenerativeAI } from "@google/generative-ai";
import qrcode from 'qrcode-terminal';
import dotenv from 'dotenv';
dotenv.config();

function startBot() {
  (async () => {
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info_baileys');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const systemPrompt = process.env.SYSTEMPROMPT;

    const sock = makeWASocket({
      auth: state,
      browser: ['Ubuntu', 'Chrome', '22.04.4'],
    });
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      if (qr) qrcode.generate(qr, { small: true });
      if (connection === 'open') {
        console.log("✅ Connected");
        console.log(systemPrompt);
        // try {
        //   const groups = await sock.groupFetchAllParticipating();
        //   const personal_chats = await sock.chats.all();
        //   Object.values(groups).forEach(group => {
        //     console.log(`Group Name: ${group.subject}, JID: ${group.id}`);
        //   });
        //   Object.values(perosnal).filter(
        //     chat => !chat.id.endsWith('@g.us') && !chat.id.endsWith('@broadcast')
        //   );
        // } catch (err) {
        //   console.error('Error fetching groups:', err);
        // }
      }
      if (connection === 'close') {
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        console.log("Connection closed. Reconnecting:", shouldReconnect);
        if (shouldReconnect) startBot();
      }
    });

    const allowedContacts = [
      // '@s.whatsapp.net', // 
      
    ];

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;
      const msg = messages[0];
      console.log('Received message:', JSON.stringify(msg, null, 2));
      if (!msg.message?.conversation) return;

      const text = msg.message.conversation;
      const number = msg.key.remoteJid;

      if (!allowedContacts.includes(number)) {
        console.log('Message from unauthorized contact:', number);
        return;
      }

      try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const result = await model.generateContent([systemPrompt, text]);
        const response = result.response.text();
        console.log('AI response:', response);
        const sendResult = await sock.sendMessage(number, { text: response });
        console.log('Message sent result:', sendResult);
      } catch (err) {
        console.error('Error in message handler:', err);
      }
    });
  })();
}

startBot();
