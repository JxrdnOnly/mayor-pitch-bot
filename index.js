require('dotenv').config(); 
const { Client, GatewayIntentBits, REST, Routes, EmbedBuilder } = require('discord.js');
const Groq = require("groq-sdk");

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent 
    ] 
});

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ==========================================
// 🏛️ THE MAYOR'S LORE HUB
// ==========================================
const MAYOR_LORE = `
You are Mayor Blake Pitch, the arrogant, sophisticated leader of the North Side in the Marshwood Franchise.
PERSONALITY:
- Witty, slightly condescending, and protective of your city.
- You value "Dino-Dignity" above all else.
- You are a virtuoso of villainy and a master of sophistication.
- You consider JxrdnOnly's music the soul of Marshwood.
RULES:
- Keep replies short and sharp.
- Refer to residents as "Resident" or "Interruption."
`;

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const commands = [
    { name: 'soul', description: 'Listen to the official anthem of the North Side.' },
    { name: 'ordinance', description: 'View a random city ordinance from the Mayor.' }
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

// --- STARTUP & COMMAND SYNC ---
client.once('clientReady', async () => {
    console.log(`✅ ${client.user.tag} is officially in office.`);
    
    try {
        console.log('🏛️ Syncing North Side ordinances...');
        await rest.put(
            Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), 
            { body: commands }
        );
        console.log('✅ Commands synced successfully.');
    } catch (error) {
        console.error('Command registration error:', error);
    }
});

// --- SLASH COMMANDS ---
client.on('interactionCreate', async (interaction) => {
    // FIXED: Using isCommand() for better compatibility
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
        const ordinances = [
            "No running in the North Side corridors.",
            "All residents must appreciate Marshwood Soul at least once daily.",
            "Dino-Dignity is not a suggestion; it is the law.",
            "Sophistication is mandatory. Amateurism is forbidden."
        ];
        const random = ordinances[Math.floor(Math.random() * ordinances.length)];
        await interaction.reply({ content: `📜 **City Ordinance:** ${random}` });
    }
});

// --- MESSAGE COMMANDS & AI CHAT ---
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
                    { role: "system", content: MAYOR_LORE },
                    { role: "user", content: message.content }
                ],
                model: "llama-3.3-70b-versatile", 
                max_tokens: 150,
                temperature: 0.7
            });

            const reply = chatCompletion.choices[0]?.message?.content;
            message.reply(reply || "I'm busy. Go bother a councilman.");

        } catch (err) {
            console.error("The Mayor is unavailable:", err);
            message.reply("My office is currently flooded with paperwork. Speak to my assistant.");
        }
    }
});

client.login(TOKEN);