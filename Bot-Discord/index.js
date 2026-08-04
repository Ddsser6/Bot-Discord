const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, VoiceConnectionStatus, entersState } = require('@discordjs/voice');

// Inisialisasi Bot Client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ]
});

// Masukkan ID Server dan ID Voice Channel kamu di sini
const GUILD_ID = '946243184609091625';
const CHANNEL_ID = '1387441088930910350';

// Ambil Token Bot dari Environment Variable (Koyeb)
const TOKEN = process.env.DISCORD_TOKEN;

function connectToVoice() {
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) {
    console.log('Error: Server (Guild) tidak ditemukan!');
    return;
  }

  // Bergabung ke Voice Channel
  const connection = joinVoiceChannel({
    channelId: CHANNEL_ID,
    guildId: GUILD_ID,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: true // Meredam suara bot agar hemat bandwidth dan stabil 24/7
  });

  // Penanganan otomatis jika koneksi terputus (Auto-Reconnect)
  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
        entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
      ]);
    } catch (error) {
      console.log('Koneksi terputus! Mencoba masuk kembali dalam 5 detik...');
      connection.destroy();
      setTimeout(connectToVoice, 5000); // Mencoba hubungkan ulang
    }
  });
}

client.once('ready', () => {
  console.log(`Bot berhasil aktif sebagai ${client.user.tag}`);
  connectToVoice();
});

client.login(TOKEN);