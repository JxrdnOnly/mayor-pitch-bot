require('dotenv').config(); 
const { Client, GatewayIntentBits, REST, Routes, EmbedBuilder, MessageFlags } = require('discord.js');
const Groq = require("groq-sdk");
const { handleMusic, handleSkip, handleLoop } = require('./music.js');
const { getVoiceConnection } = require('@discordjs/voice'); // Required for self-awareness

const { MAYOR_LORE } = require('./lore.js'); 

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates 
    ] 
});

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const commands = [
    { name: 'soul', description: 'Listen to the official anthem of the North Side.' },
    { name: 'ordinance', description: 'View a random city ordinance from the Mayor.' },
    { 
        name: 'play', 
        description: 'Play music from SoundCloud.',
        options: [{ name: 'link', type: 3, description: 'The SoundCloud URL', required: true }]
    },
    { name: 'skip', description: 'Skip the current track.' },
    { name: 'loop', description: 'Toggle loop mode for the current track.' },
    { name: 'join', description: 'Request the Mayor’s presence in your voice channel.' },
    { name: 'dismiss', description: 'Respectfully ask the Mayor to return to his office.' }
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

    if (interaction.commandName === 'skip') await handleSkip(interaction);
    if (interaction.commandName === 'loop') await handleLoop(interaction);
    if (interaction.commandName === 'play') await handleMusic(interaction);

    if (interaction.commandName === 'join') {
        const { joinVoiceChannel, VoiceConnectionStatus, entersState } = require('@discordjs/voice');
        const voiceChannel = interaction.member.voice.channel;

        if (!voiceChannel) {
            return interaction.reply({ content: "I don't wander the halls aimlessly. Join a channel first.", flags: [MessageFlags.Ephemeral] });
        }

        try {
            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: interaction.guild.id,
                adapterCreator: interaction.guild.voiceAdapterCreator,
                selfDeaf: false,
            });
            await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
            return interaction.reply("🏛️ *'Very well. I shall oversee this session personally.'*");
        } catch (error) {
            console.error(error);
            return interaction.reply("My schedule is too packed to join right now.");
        }
    }

    if (interaction.commandName === 'dismiss') {
        const connection = getVoiceConnection(interaction.guild.id);
        if (connection) {
            connection.destroy();
            return interaction.reply("🏛️ *'I have pressing city matters to attend to. Maintain the peace, residents.'*");
        } else {
            return interaction.reply({ content: "I'm not even in a channel. Are you seeing ghosts, resident?", flags: [MessageFlags.Ephemeral] });
        }
    }

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

// --- SELF-AWARENESS: AUTO-LEAVE WHEN EMPTY ---
client.on('voiceStateUpdate', (oldState, newState) => {
    const connection = getVoiceConnection(newState.guild.id);

    if (connection) {
        const channel = newState.guild.channels.cache.get(connection.joinConfig.channelId);
        
        // If there's only 1 person left, and that person is the Bot
        if (channel && channel.members.size === 1 && channel.members.has(client.user.id)) {
            console.log("🚶 The North Side is empty. Mayor Pitch is heading back to the office.");
            connection.destroy();
        }
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
                    { role: "system", content: MAYOR_LORE },
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
