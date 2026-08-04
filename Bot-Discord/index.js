const http = require('http');
const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, VoiceConnectionStatus, entersState } = require('@discordjs/voice');

// 1. Web Server Mini untuk Menjaga Render Tetap Bangun
http.createServer((req, res) => {
  res.write("Bot Discord 24/7 Online!");
  res.end();
}).listen(process.env.PORT || 3000);

// 2. Kode Bot Discord Kamu
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates]
});

const GUILD_ID = '946243184609091625';
const CHANNEL_ID = '1387441088930910350';
const TOKEN = process.env.MTUzNDExNTQ4MDc5MTY4MzEyMg.GD8iTC.Q9bQrHXhKJVEqiXZWX0PJLVrlZ-uGMlfC0VViY;

function connectToVoice() {
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) return;

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
      connection.destroy();
      setTimeout(connectToVoice, 5000);
    }
  });
}

client.once('ready', () => {
  console.log(`Bot online: ${client.user.tag}`);
  connectToVoice();
});

client.login(TOKEN);
