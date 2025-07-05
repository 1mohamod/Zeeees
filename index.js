require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, SlashCommandBuilder, Collection, AttachmentBuilder } = require('discord.js');
const fs = require('fs');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.DirectMessages],
  partials: [Partials.Channel]
});

let appChannel = null;
let blockedUsers = new Set();

client.commands = new Collection();

const commands = [
  new SlashCommandBuilder()
    .setName('setup')
    .setDescription('يرسل زر التقديم')
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('القناة التي تريد إرسال زر التقديم فيها')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('block')
    .setDescription('حظر عضو من التقديم')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('العضو المراد حظره')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('unblock')
    .setDescription('إلغاء حظر عضو من التقديم')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('العضو المراد فك حظره')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('setappy')
    .setDescription('تحديد روم إرسال التقديمات')
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('الروم اللي ترسل فيه التقديمات')
        .setRequired(true)
    )
].map(cmd => cmd.toJSON());

client.once(Events.ClientReady, async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  const guilds = await client.guilds.fetch();
  for (const [guildId] of guilds) {
    const guild = await client.guilds.fetch(guildId);
    await guild.commands.set(commands);
  }
});

client.on(Events.InteractionCreate, async interaction => {
  if (interaction.isChatInputCommand()) {
    const { commandName } = interaction;

    if (commandName === 'setup') {
      if (!interaction.memberPermissions.has('Administrator')) return interaction.reply({ content: '❌ لازم تكون أدمن', ephemeral: true });

      const channel = interaction.options.getChannel('channel');
      const button = new ButtonBuilder()
        .setCustomId('apply_now')
        .setLabel('📩 تقديم إدارة')
        .setStyle(ButtonStyle.Primary);

      const row = new ActionRowBuilder().addComponents(button);
      await channel.send({ content: 'اضغط الزر لتقديم الإدارة:', components: [row] });
      await interaction.reply({ content: '✅ تم الإرسال', ephemeral: true });

    } else if (commandName === 'block') {
      const user = interaction.options.getUser('user');
      blockedUsers.add(user.id);
      interaction.reply({ content: `🚫 تم حظر <@${user.id}> من التقديم`, ephemeral: true });

    } else if (commandName === 'unblock') {
      const user = interaction.options.getUser('user');
      blockedUsers.delete(user.id);
      interaction.reply({ content: `✅ تم فك الحظر عن <@${user.id}>`, ephemeral: true });

    } else if (commandName === 'setappy') {
      const channel = interaction.options.getChannel('channel');
      appChannel = channel.id;
      interaction.reply({ content: `📬 تم تعيين روم التقديمات: <#${channel.id}>`, ephemeral: true });
    }
  }

  if (interaction.isButton()) {
    if (interaction.customId === 'apply_now') {
      if (blockedUsers.has(interaction.user.id)) return interaction.reply({ content: '🚫 أنت محظور من التقديم.', ephemeral: true });

      const modal = new ModalBuilder()
        .setCustomId('admin_apply')
        .setTitle('نموذج التقديم');

      const nameInput = new TextInputBuilder()
        .setCustomId('name')
        .setLabel('اسمك')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const ageInput = new TextInputBuilder()
        .setCustomId('age')
        .setLabel('عمرك')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const expInput = new TextInputBuilder()
        .setCustomId('experience')
        .setLabel('خبراتك')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      const valueInput = new TextInputBuilder()
        .setCustomId('value')
        .setLabel('وش بتفيد السيرفر؟')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      const row1 = new ActionRowBuilder().addComponents(nameInput);
      const row2 = new ActionRowBuilder().addComponents(ageInput);
      const row3 = new ActionRowBuilder().addComponents(expInput);
      const row4 = new ActionRowBuilder().addComponents(valueInput);

      modal.addComponents(row1, row2, row3, row4);
      await interaction.showModal(modal);
    }

    if (interaction.customId.startsWith('accept_') || interaction.customId.startsWith('reject_')) {
      const userId = interaction.customId.split('_')[1];
      const user = await client.users.fetch(userId);
      if (interaction.customId.startsWith('accept_')) {
        user.send('✅ تم قبولك');
        interaction.update({ content: '✅ تم قبول العضو', components: [] });
      } else {
        user.send('❌ تم رفضك');
        interaction.update({ content: '❌ تم رفض العضو', components: [] });
      }
    }
  }

  if (interaction.isModalSubmit()) {
    if (interaction.customId === 'admin_apply') {
      if (!appChannel) return interaction.reply({ content: '❌ لم يتم تعيين روم التقديمات بعد عبر /setappy', ephemeral: true });

      const name = interaction.fields.getTextInputValue('name');
      const age = interaction.fields.getTextInputValue('age');
      const experience = interaction.fields.getTextInputValue('experience');
      const value = interaction.fields.getTextInputValue('value');

      const embed = new EmbedBuilder()
        .setTitle('📝 تقديم جديد')
        .setThumbnail(interaction.user.displayAvatarURL())
        .addFields(
          { name: '👤 الاسم', value: name, inline: true },
          { name: '📅 العمر', value: age, inline: true },
          { name: '📚 الخبرات', value: experience },
          { name: '🎯 الفائدة', value: value }
        )
        .setFooter({ text: `مقدم الطلب: ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
        .setTimestamp();

      const acceptBtn = new ButtonBuilder()
        .setCustomId(`accept_${interaction.user.id}`)
        .setLabel('✅ مقبول')
        .setStyle(ButtonStyle.Success);

      const rejectBtn = new ButtonBuilder()
        .setCustomId(`reject_${interaction.user.id}`)
        .setLabel('❌ مرفوض')
        .setStyle(ButtonStyle.Danger);

      const row = new ActionRowBuilder().addComponents(acceptBtn, rejectBtn);

      const channel = await client.channels.fetch(appChannel);
      channel.send({ content: `<@${interaction.user.id}>`, embeds: [embed], components: [row] });

      interaction.reply({ content: '📬 تم إرسال طلبك بنجاح!', ephemeral: true });
    }
  }
});

client.login(process.env.TOKEN);