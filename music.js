const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, NoSubscriberBehavior, VoiceConnectionStatus, entersState } = require('@discordjs/voice');
const { MessageFlags } = require('discord.js');
const play = require('play-dl');

const queue = new Map(); // Global storage for server queues

// 1. Working SoundCloud Permit Logic
play.getFreeClientID().then((clientID) => {
    play.setToken({ soundcloud : { client_id : clientID } });
    console.log("✅ SoundCloud permit secured.");
});

async function handleMusic(interaction) {
    const url = interaction.options.getString('link');
    const voiceChannel = interaction.member.voice.channel;
    const serverQueue = queue.get(interaction.guild.id);

    if (!voiceChannel) {
        // Updated to use the non-deprecated flags
        return interaction.reply({ 
            content: "I don't perform for empty rooms. Join a voice channel first.", 
            flags: [MessageFlags.Ephemeral] 
        });
    }

    if (!serverQueue) {
        const queueConstruct = {
            textChannel: interaction.channel,
            voiceChannel: voiceChannel,
            connection: null,
            songs: [],
            player: createAudioPlayer({
                behaviors: { noSubscriber: NoSubscriberBehavior.Play }
            }),
            loop: false,
        };

        queue.set(interaction.guild.id, queueConstruct);
        queueConstruct.songs.push(url);

        await interaction.deferReply();

        try {
            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: interaction.guild.id,
                adapterCreator: interaction.guild.voiceAdapterCreator,
                selfDeaf: false,
            });

            await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
            queueConstruct.connection = connection;
            connection.subscribe(queueConstruct.player);

            playSong(interaction.guild.id, queueConstruct.songs[0]);
            await interaction.editReply(`🎶 **Added to queue:** ${url}\n*The North Side is now in session.*`);
        } catch (err) {
            console.error(err);
            queue.delete(interaction.guild.id);
            return interaction.editReply("The Mayor's audio line was cut. Check the connection.");
        }
    } else {
        serverQueue.songs.push(url);
        return interaction.reply(`🎶 **Added to queue:** ${url}`);
    }
}

async function playSong(guildId, songUrl) {
    const serverQueue = queue.get(guildId);
    
    if (!songUrl) {
        // SAFETY CHECK: Only destroy if the connection exists and isn't already destroyed
        if (serverQueue.connection && serverQueue.connection.state.status !== VoiceConnectionStatus.Destroyed) {
            serverQueue.connection.destroy();
        }
        queue.delete(guildId);
        return;
    }

    try {
        const stream = await play.stream(songUrl);
        const resource = createAudioResource(stream.stream, { inputType: stream.type });
        
        serverQueue.player.play(resource);

        serverQueue.player.once(AudioPlayerStatus.Idle, () => {
            if (!serverQueue.loop) {
                serverQueue.songs.shift(); 
            }
            playSong(guildId, serverQueue.songs[0]);
        });

    } catch (error) {
        console.error("Playback Error:", error);
        serverQueue.textChannel.send("The record skipped. Moving to next track.");
        serverQueue.songs.shift();
        playSong(guildId, serverQueue.songs[0]);
    }
}

async function handleSkip(interaction) {
    const serverQueue = queue.get(interaction.guild.id);
    if (!serverQueue) return interaction.reply("Nothing to skip, resident.");
    serverQueue.player.stop(); 
    return interaction.reply("⏭️ Skipping... the Mayor has heard enough.");
}

async function handleLoop(interaction) {
    const serverQueue = queue.get(interaction.guild.id);
    if (!serverQueue) return interaction.reply("Nothing to loop.");
    serverQueue.loop = !serverQueue.loop;
    return interaction.reply(serverQueue.loop ? "🔁 **Loop Enabled.**" : "➡️ **Loop Disabled.**");
}

module.exports = { handleMusic, handleSkip, handleLoop };