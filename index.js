const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, VoiceConnectionStatus, entersState } = require('@discordjs/voice');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ]
});

// === ISI DENGAN ID SERVER DAN VOICE CHANNEL KAMU ===
const GUILD_ID = '946243184609091625';
const CHANNEL_ID = '1387441088930910350';

const TOKEN = process.env.DISCORD_TOKEN;

function connectToVoice() {
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) {
    console.log('Error: Server (Guild) tidak ditemukan!');
    return;
  }

  const connection = joinVoiceChannel({
    channelId: CHANNEL_ID,
    guildId: GUILD_ID,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: true
  });

  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
        entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
      ]);
    } catch (error) {
      console.log('Koneksi terputus, mencoba masuk kembali...');
      connection.destroy();
      setTimeout(connectToVoice, 5000);
    }
  });
}

client.once('ready', () => {
  console.log(`Bot berhasil aktif sebagai: ${client.user.tag}`);
  connectToVoice();
});

client.login(TOKEN);
