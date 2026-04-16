require('dotenv').config(); 
const { Client, GatewayIntentBits, REST, Routes, EmbedBuilder } = require('discord.js');
const Groq = require("groq-sdk");

// 1. IMPORT LORE FROM EXTERNAL FILE
const { MAYOR_LORE } = require('./lore.js'); 

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent 
    ] 
});

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Secrets from .env
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const commands = [
    { name: 'soul', description: 'Listen to the official anthem of the North Side.' },
    { name: 'ordinance', description: 'View a random city ordinance from the Mayor.' }
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

// --- STARTUP ---
client.once('clientReady', async () => {
    console.log(`✅ ${client.user.tag} is officially in office.`);
    try {
        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
        console.log('✅ Slash commands live.');
    } catch (error) {
        console.error('Registration error:', error);
    }
});

// --- SLASH COMMANDS ---
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;

    if (interaction.commandName === 'soul') {
        const soulEmbed = new EmbedBuilder()
            .setColor(0x000000)
            .setTitle('🏛️ MARSHWOOD SOUL: OFFICIAL ADDRESS')
            .setURL('https://bit.ly/jxrdnonly-marshwood')
            .setDescription("Sit down and listen. This is the heart of the North Side.")
            .addFields(
                { name: 'Artist', value: 'JxrdnOnly', inline: false },
                { name: 'Label', value: 'Marshwood Productions', inline: false },
                { name: 'Status', value: 'Dino-Dignity Approved', inline: false }
            )
            .setThumbnail('https://i.imgur.com/K9j4Lba.jpeg')
            .setImage('https://i.imgur.com/4SZDQ32.jpeg')
            .setFooter({ text: 'A city without a sound is just a ghost town.' })
            .setTimestamp();
            
        await interaction.reply({ content: "🔗 **Listen here:** https://bit.ly/jxrdnonly-marshwood", embeds: [soulEmbed] });
    }

    if (interaction.commandName === 'ordinance') {
        const ordinances = ["No running.", "Listen to Marshwood Soul.", "Maintain Dino-Dignity."];
        const random = ordinances[Math.floor(Math.random() * ordinances.length)];
        await interaction.reply({ content: `📜 **City Ordinance:** ${random}` });
    }
});

// --- AI CHAT ---
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    const content = message.content.toLowerCase();

    if (content.includes('hello mayor')) {
        return message.reply("Make it brief, resident. These marble floors don't polish themselves.");
    }

    if (message.mentions.has(client.user) || content.includes('mayor')) {
        try {
            await message.channel.sendTyping();

            const chatCompletion = await groq.chat.completions.create({
                messages: [
                    { role: "system", content: MAYOR_LORE }, // This now correctly pulls from lore.js
                    { role: "user", content: message.content }
                ],
                model: "llama-3.3-70b-versatile", 
                max_tokens: 300,
                temperature: 0.85
            });

            const reply = chatCompletion.choices[0]?.message?.content;
            message.reply(reply || "I don't have time for this.");

        } catch (err) {
            console.error("Groq Error:", err);
            message.reply("My office is currently flooded with paperwork.");
        }
    }
});

client.login(TOKEN);
