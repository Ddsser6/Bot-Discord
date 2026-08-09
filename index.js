// Polyfill untuk kompatibilitas buffer & fetch pada Node.js
const { File } = require('buffer');
if (!globalThis.File) globalThis.File = File;

const { 
  Client, GatewayIntentBits, Partials, EmbedBuilder, 
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits 
} = require('discord.js');
const { joinVoiceChannel, VoiceConnectionStatus, entersState } = require('@discordjs/voice');

// 1. Inisialisasi Bot Discord
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

const PREFIX = '!';

// Database Memori Lokal
const db = {
  economy: {},
  levels: {},
  tickets: 0
};

// AutoMod: Filter Kata Terlarang
const BAD_WORDS = ['anjing', 'babi', 'kontol', 'memek', 'goblok'];

client.once('ready', () => {
  console.log(`Bot Super Lengkap Aktif sebagai: ${client.user.tag}`);
});

// Penanganan Uncaught Error
process.on('unhandledRejection', error => console.error('Unhandled Promise Rejection:', error));
process.on('uncaughtException', error => console.error('Uncaught Exception:', error));

// --- EVENT HANDLER PESAN ---
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;

  const userId = message.author.id;

  // FITUR 1: AUTOMOD
  const containsBadWord = BAD_WORDS.some(word => message.content.toLowerCase().includes(word));
  if (containsBadWord) {
    await message.delete();
    return message.channel.send(`<@${userId}>, tolong jaga katamu! (Pesan dihapus)`).then(m => setTimeout(() => m.delete(), 4000));
  }

  // FITUR 2: LEVELING
  if (!db.levels[userId]) db.levels[userId] = { xp: 0, level: 1 };
  db.levels[userId].xp += Math.floor(Math.random() * 10) + 5;
  const nextLevelXp = db.levels[userId].level * 100;
  if (db.levels[userId].xp >= nextLevelXp) {
    db.levels[userId].level += 1;
    message.channel.send(`🎉 Selamat <@${userId}>, kamu naik ke **Level ${db.levels[userId].level}**!`);
  }

  if (!db.economy[userId]) db.economy[userId] = 100;

  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // FITUR VOICE 24/7 (JOIN & LEAVE)
  if (command === 'join' || command === 'j') {
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) return message.reply('❌ Kamu harus bergabung ke Voice Channel terlebih dahulu!');

    try {
      joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: message.guild.id,
        adapterCreator: message.guild.voiceAdapterCreator,
        selfDeaf: true,  // Bot otomatis deafen agar hemat bandwidth
        selfMute: false
      });
      message.reply(`✅ Bot berhasil bergabung ke **${voiceChannel.name}** dan akan tetap di sana 24/7!`);
    } catch (err) {
      console.error(err);
      message.reply(`❌ Gagal masuk voice channel: \`${err.message}\``);
    }
  }

  else if (command === 'leave' || command === 'l') {
    const { getVoiceConnection } = require('@discordjs/voice');
    const connection = getVoiceConnection(message.guild.id);
    if (!connection) return message.reply('❌ Bot tidak sedang berada di Voice Channel!');

    connection.destroy();
    message.reply('👋 Bot telah keluar dari Voice Channel.');
  }

  // FITUR 3: AI CHAT (Gemini 2.5 Flash)
  else if (command === 'plaza') {
    const prompt = args.join(' ');
    if (!prompt) return message.reply('Masukkan pertanyaan! Contoh: `!PLAZA siapa presiden indonesia sekarang`');

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return message.reply('❌ Error: `GEMINI_API_KEY` tidak ditemukan di Railway Variables!');

    await message.channel.sendTyping();

    try {
      const contents = [];
      const parts = [{ text: prompt }];

      if (message.attachments.size > 0) {
        const image = message.attachments.first();
        const imageBuffer = await fetch(image.url).then(res => res.arrayBuffer());
        parts.push({
          inlineData: {
            mimeType: image.contentType,
            data: Buffer.from(imageBuffer).toString('base64')
          }
        });
      }

      contents.push({ parts });

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          systemInstruction: {
            parts: [{ text: "Gunakan informasi real-time dan berita terbaru jika diperlukan. Berikan jawaban yang akurat berdasarkan fakta terkini." }]
          },
          tools: [
            { googleSearch: {} }
          ]
        })
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error.message || JSON.stringify(data.error));
      }

      const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Tidak ada respons dari AI.';
      message.reply(responseText.length > 2000 ? responseText.slice(0, 1990) + '...' : responseText);
    } catch (err) {
      console.error("AI Error:", err);
      message.reply(`❌ AI Error: \`${err.message || err}\``);
    }
  }

  // FITUR 4: EKONOMI
  else if (command === 'daily') {
    db.economy[userId] += 250;
    message.reply('🪙 Kamu menerima hadiah harian **250 Koin**!');
  }
  else if (command === 'bal' || command === 'saldo') {
    message.reply(`💳 Saldo kamu saat ini: **${db.economy[userId]} Koin**.`);
  }
  else if (command === 'coinflip') {
    const taruhan = parseInt(args[0]);
    const tebakan = args[1]?.toLowerCase();
    if (isNaN(taruhan) || taruhan > db.economy[userId] || taruhan <= 0) return message.reply('Masukkan jumlah taruhan yang valid!');
    if (!['kepala', 'ekor'].includes(tebakan)) return message.reply('Pilih: `kepala` atau `ekor`. Contoh: `!coinflip 50 kepala`');

    const hasil = Math.random() < 0.5 ? 'kepala' : 'ekor';
    if (tebakan === hasil) {
      db.economy[userId] += taruhan;
      message.reply(`🎰 Hasilnya **${hasil.toUpperCase()}**! Kamu MENANG **${taruhan} Koin**!`);
    } else {
      db.economy[userId] -= taruhan;
      message.reply(`🎰 Hasilnya **${hasil.toUpperCase()}**! Kamu KALAH **${taruhan} Koin**.`);
    }
  }

  // FITUR 5: LEVEL & STATISTIK
  else if (command === 'rank') {
    const lvlData = db.levels[userId];
    message.reply(`📊 **Profil Status:**\n• Level: **${lvlData.level}**\n• XP: **${lvlData.xp} / ${lvlData.level * 100}**`);
  }

  // FITUR 6: UTILITY
  else if (command === 'serverinfo') {
    const embed = new EmbedBuilder()
      .setTitle(`🏰 Info Server: ${message.guild.name}`)
      .setColor('#5865F2')
      .addFields(
        { name: '👥 Total Member', value: `${message.guild.memberCount}`, inline: true },
        { name: '👑 Pembuat', value: `<@${message.guild.ownerId}>`, inline: true }
      );
    message.channel.send({ embeds: [embed] });
  }

  // FITUR 7: MODERASI
  else if (command === 'clear') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return message.reply('Kamu tidak punya izin!');
    const amount = parseInt(args[0]);
    if (isNaN(amount) || amount < 1 || amount > 99) return message.reply('Masukkan jumlah 1-99 pesan.');
    await message.channel.bulkDelete(amount + 1, true);
    message.channel.send(`🧹 Berhasil menghapus ${amount} pesan!`).then(m => setTimeout(() => m.delete(), 3000));
  }

  // FITUR 8: TIKET SUPPORT
  else if (command === 'setupticket') {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
    const embed = new EmbedBuilder()
      .setTitle('🎫 Pusat Bantuan & Support')
      .setDescription('Klik tombol di bawah untuk membuat tiket bantuan privat dengan Staff.')
      .setColor('#57F287');

    const button = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('create_ticket').setLabel('Buat Tiket').setStyle(ButtonStyle.Primary).setEmoji('🎫')
    );

    message.channel.send({ embeds: [embed], components: [button] });
  }
});

// INTERAKSI TIKET
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.customId === 'create_ticket') {
    db.tickets += 1;
    const ticketChannel = await interaction.guild.channels.create({
      name: `ticket-${db.tickets}`,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
      ]
    });

    ticketChannel.send(`Selamat datang <@${interaction.user.id}>, silakan sampaikan keluhan atau pertanyaanmu di sini. Staff akan segera membantu.`);
    interaction.reply({ content: `Tiket kamu dibuat di ${ticketChannel}!`, ephemeral: true });
  }
});

client.login(process.env.DISCORD_TOKEN);
