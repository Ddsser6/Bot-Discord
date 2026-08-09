const { 
  Client, GatewayIntentBits, Partials, EmbedBuilder, 
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits 
} = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Inisialisasi Bot Discord
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

// Inisialisasi AI Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// === KONFIGURASI ID ===
const GUILD_ID = '946243184609091625';
const VOICE_CHANNEL_ID = '1387441088930910350';
const PREFIX = '!';

// Database Memori Lokal
const db = {
  economy: {},
  levels: {},
  tickets: 0
};

// Kata-kata Terlarang (AutoMod)
const BAD_WORDS = ['anjing', 'babi', 'kontol', 'memek', 'goblok'];

// --- FUNGSI VOICE 24/7 ---
function connectToVoice() {
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) return;

  joinVoiceChannel({
    channelId: VOICE_CHANNEL_ID,
    guildId: GUILD_ID,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: true
  });
}

client.once('ready', () => {
  console.log(`Bot Super Lengkap Aktif sebagai: ${client.user.tag}`);
  connectToVoice();
});

// --- EVENT HANDLER PESAN ---
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;

  const userId = message.author.id;

  // 1. AUTOMOD (Filter Kata Kotor)
  const containsBadWord = BAD_WORDS.some(word => message.content.toLowerCase().includes(word));
  if (containsBadWord) {
    await message.delete();
    return message.channel.send(`<@${userId}>, tolong jaga katamu! (Pesan dihapus)`).then(m => setTimeout(() => m.delete(), 4000));
  }

  // 2. LEVELING (XP Otomatis)
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

  // 3. AI CHAT & VISION (Gemini)
  if (command === 'tanya') {
    const prompt = args.join(' ');
    if (!prompt) return message.reply('Masukkan pertanyaan! Contoh: `!tanya siapa penemu listrik`');

    await message.channel.sendTyping();
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      let result;

      if (message.attachments.size > 0) {
        const image = message.attachments.first();
        const imageBuffer = await fetch(image.url).then(res => res.arrayBuffer());
        const imagePart = {
          inlineData: {
            data: Buffer.from(imageBuffer).toString('base64'),
            mimeType: image.contentType
          }
        };
        result = await model.generateContent([prompt, imagePart]);
      } else {
        result = await model.generateContent(prompt);
      }

      const responseText = result.response.text() || 'Tidak ada respons.';
      message.reply(responseText.length > 2000 ? responseText.slice(0, 1990) + '...' : responseText);
    } catch (err) {
      console.error("AI Error Detail:", err);
      message.reply(`Gagal memproses AI. Detail Error: \`${err.message || err}\``);
    }
  }

  // 4. FITUR EKONOMI
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

  // 5. FITUR LEVEL & PROFIL
  else if (command === 'rank') {
    const lvlData = db.levels[userId];
    message.reply(`📊 **Profil Status:**\n• Level: **${lvlData.level}**\n• XP: **${lvlData.xp} / ${lvlData.level * 100}**`);
  }

  // 6. FITUR UTILITY
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

  // 7. FITUR MODERASI
  else if (command === 'clear') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return message.reply('Kamu tidak punya izin!');
    const amount = parseInt(args[0]);
    if (isNaN(amount) || amount < 1 || amount > 99) return message.reply('Masukkan jumlah 1-99 pesan.');
    await message.channel.bulkDelete(amount + 1, true);
    message.channel.send(`🧹 Berhasil menghapus ${amount} pesan!`).then(m => setTimeout(() => m.delete(), 3000));
  }

  // 8. SETUP TIKET BANTUAN
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

// INTERAKSI TIKET PRIVAT
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
