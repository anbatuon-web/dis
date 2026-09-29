const { Client, GatewayIntentBits, Events, REST, Routes, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const TOKEN = 'YOUR_BOT_TOKEN';
const CLIENT_ID = 'YOUR_CLIENT_ID';
const GUILD_ID = 'YOUR_GUILD_ID';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Dữ liệu người chơi
const players = new Map();
const START_BALANCE = 100000;

// Vật phẩm bầu cua
const items = [
    { id: 'bau', name: 'Bầu', icon: '🥥' },
    { id: 'cua', name: 'Cua', icon: '🦀' },
    { id: 'tom', name: 'Tôm', icon: '🦐' },
    { id: 'ca', name: 'Cá', icon: '🐟' },
    { id: 'ga', name: 'Gà', icon: '🐔' },
    { id: 'nai', name: 'Nai', icon: '🦌' }
];

function getPlayer(userId, username) {
    if (!players.has(userId)) {
        players.set(userId, {
            id: userId,
            name: username,
            balance: START_BALANCE,
            wins: 0,
            loses: 0,
            totalBet: 0,
            totalWin: 0,
            history: []
        });
    }
    return players.get(userId);
}

function fmt(n) {
    return n.toLocaleString('vi-VN');
}

function rollDice() {
    return [
        items[Math.floor(Math.random() * 6)],
        items[Math.floor(Math.random() * 6)],
        items[Math.floor(Math.random() * 6)]
    ];
}

function calcResult(bets, dice) {
    const counts = {};
    dice.forEach(d => {
        counts[d.id] = (counts[d.id] || 0) + 1;
    });

    let totalBet = 0;
    let totalWin = 0;
    const details = [];

    for (const key in bets) {
        if (bets[key] > 0) {
            totalBet += bets[key];
            const count = counts[key] || 0;
            if (count > 0) {
                const won = bets[key] * (count + 1);
                totalWin += won;
                const item = items.find(x => x.id === key);
                details.push(`${item.icon} ${item.name} x${count} → +${fmt(won)}đ`);
            }
        }
    }

    return { totalBet, totalWin, profit: totalWin - totalBet, details };
}

// Slash commands
const commands = [
    new SlashCommandBuilder()
        .setName('baucua')
        .setDescription('Chơi game Bầu Cua')
        .addStringOption(opt =>
            opt.setName('cuoc')
                .setDescription('Cược theo format: bau:10000,cua:5000')
                .setRequired(false)),
    new SlashCommandBuilder()
        .setName('sodu')
        .setDescription('Xem số dư'),
    new SlashCommandBuilder()
        .setName('bangxephang')
        .setDescription('Bảng xếp hạng'),
    new SlashCommandBuilder()
        .setName('lichsu')
        .setDescription('Lịch sử chơi'),
    new SlashCommandBuilder()
        .setName('reset')
        .setDescription('Reset tiền về 100000')
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
    try {
        await rest.put(
            Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
            { body: commands }
        );
        console.log('Đã đăng ký slash commands');
    } catch (error) {
        console.error(error);
    }
})();

client.once(Events.ClientReady, c => {
    console.log('Bot online: ' + c.user.tag);
    client.user.setActivity('🎲 Bầu Cua', { type: 3 });
});

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const player = getPlayer(interaction.user.id, interaction.user.username);

    if (interaction.commandName === 'sodu') {
        const embed = new EmbedBuilder()
            .setColor(0xffaa00)
            .setTitle('💰 Số dư của ' + interaction.user.username)
            .addFields(
                { name: '💵 Số dư', value: fmt(player.balance) + 'đ', inline: true },
                { name: '🏆 Thắng', value: String(player.wins), inline: true },
                { name: '💀 Thua', value: String(player.loses), inline: true },
                { name: '📊 Tổng cược', value: fmt(player.totalBet) + 'đ', inline: true },
                { name: '💎 Tổng thắng', value: fmt(player.totalWin) + 'đ', inline: true }
            )
            .setThumbnail(interaction.user.displayAvatarURL())
            .setTimestamp();

        return interaction.reply({ embeds: [embed] });
    }

    if (interaction.commandName === 'bangxephang') {
        const sorted = [...players.values()].sort((a, b) => b.balance - a.balance).slice(0, 10);
        if (sorted.length === 0) {
            return interaction.reply('Chưa có ai chơi!');
        }
        let desc = '';
        sorted.forEach((p, i) => {
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;
            desc += `${medal} **${p.name}** - ${fmt(p.balance)}đ (W:${p.wins} L:${p.loses})\n`;
        });
        const embed = new EmbedBuilder()
            .setColor(0xffd700)
            .setTitle('🏆 BẢNG XẾP HẠNG')
            .setDescription(desc)
            .setTimestamp();
        return interaction.reply({ embeds: [embed] });
    }

    if (interaction.commandName === 'lichsu') {
        if (player.history.length === 0) {
            return interaction.reply('Chưa có lịch sử!');
        }
        let desc = '';
        player.history.slice(-10).reverse().forEach(h => {
            const icon = h.profit > 0 ? '🟢' : h.profit < 0 ? '🔴' : '⚪';
            desc += `${icon} ${h.time} | ${h.dice} | ${h.profit > 0 ? '+' : ''}${fmt(h.profit)}đ\n`;
        });
        const embed = new EmbedBuilder()
            .setColor(0xffaa00)
            .setTitle('📜 LỊCH SỬ 10 VÁN GẦN NHẤT')
            .setDescription(desc)
            .setTimestamp();
        return interaction.reply({ embeds: [embed] });
    }

    if (interaction.commandName === 'reset') {
        player.balance = START_BALANCE;
        player.wins = 0;
        player.loses = 0;
        player.totalBet = 0;
        player.totalWin = 0;
        player.history = [];
        return interaction.reply(`✅ Đã reset! Số dư: ${fmt(START_BALANCE)}đ`);
    }

    if (interaction.commandName === 'baucua') {
        const cuocStr = interaction.options.getString('cuoc');

        if (!cuocStr) {
            const embed = new EmbedBuilder()
                .setColor(0xffaa00)
                .setTitle('🎲 GAME BẦU CUA')
                .setDescription(
                    'Cách chơi:\n' +
                    '`/baucua cuoc:bau:10000,cua:5000,tom:20000`\n\n' +
                    'Các cửa:\n' +
                    '🥥 Bầu | 🦀 Cua | 🦐 Tôm | 🐟 Cá | 🐔 Gà | 🦌 Nai\n\n' +
                    'Tỷ lệ thắng: **1 ăn 2** (nếu xúc xắc ra 1 lần)\n' +
                    'Xúc xắc ra 2 lần → **1 ăn 3**\n' +
                    'Xúc xắc ra 3 lần → **1 ăn 4**\n\n' +
                    `💰 Số dư của bạn: ${fmt(player.balance)}đ`
                )
                .setFooter({ text: 'Cược tối thiểu 1000đ' });

            return interaction.reply({ embeds: [embed] });
        }

        // Parse cược
        const bets = { bau: 0, cua: 0, tom: 0, ca: 0, ga: 0, nai: 0 };
        const parts = cuocStr.split(',').map(x => x.trim());

        for (const part of parts) {
            const [name, amountStr] = part.split(':');
            if (!name || !amountStr) {
                return interaction.reply({ content: `❌ Sai format: \`${part}\`. Dùng \`bau:10000,cua:5000\``, ephemeral: true });
            }
            const id = name.toLowerCase().trim();
            const amount = parseInt(amountStr);
            if (!items.find(x => x.id === id)) {
                return interaction.reply({ content: `❌ Cửa không hợp lệ: \`${name}\`. Chọn: bau, cua, tom, ca, ga, nai`, ephemeral: true });
            }
            if (isNaN(amount) || amount < 1000) {
                return interaction.reply({ content: `❌ Tiền cược phải >= 1000đ`, ephemeral: true });
            }
            bets[id] += amount;
        }

        const totalBet = Object.values(bets).reduce((a, b) => a + b, 0);
        if (totalBet > player.balance) {
            return interaction.reply({ content: `❌ Không đủ tiền! Cần ${fmt(totalBet)}đ, bạn có ${fmt(player.balance)}đ`, ephemeral: true });
        }

        // Trừ tiền cược
        player.balance -= totalBet;

        // Lắc xúc xắc
        await interaction.reply({
            embeds: [new EmbedBuilder()
                .setColor(0x00aaff)
                .setTitle('🎲 Đang lắc...')
                .setDescription('🥥 🦀 🦐 🐟 🐔 🦌')
            ]
        });

        await new Promise(r => setTimeout(r, 2000));

        const dice = rollDice();
        const result = calcResult(bets, dice);

        // Cộng tiền thắng
        player.balance += result.totalWin;
        player.totalBet += totalBet;
        player.totalWin += result.totalWin;

        if (result.profit > 0) player.wins++;
        else if (result.profit < 0) player.loses++;

        // Lịch sử
        player.history.push({
            time: new Date().toLocaleTimeString('vi-VN'),
            dice: dice.map(d => d.icon).join(''),
            bet: totalBet,
            win: result.totalWin,
            profit: result.profit
        });
        if (player.history.length > 50) player.history.shift();

        // Hiển thị kết quả
        const diceStr = dice.map(d => `**${d.icon} ${d.name}**`).join(' • ');

        let betStr = '';
        for (const key in bets) {
            if (bets[key] > 0) {
                const item = items.find(x => x.id === key);
                betStr += `${item.icon} ${item.name}: ${fmt(bets[key])}đ\n`;
            }
        }

        const embed = new EmbedBuilder()
            .setColor(result.profit > 0 ? 0x00ff88 : result.profit < 0 ? 0xff3355 : 0xffaa00)
            .setTitle(result.profit > 0 ? '🎉 THẮNG LỚN!' : result.profit < 0 ? '💀 THUA RỒI!' : '⚪ HÒA')
            .addFields(
                { name: '🎲 Kết quả', value: diceStr, inline: false },
                { name: '💰 Đã cược', value: betStr || 'Không có', inline: false },
                { name: '📊 Kết quả', value: result.profit > 0 ? `+${fmt(result.profit)}đ` : `${fmt(result.profit)}đ`, inline: true },
                { name: '💵 Số dư mới', value: fmt(player.balance) + 'đ', inline: true }
            )
            .setFooter({ text: interaction.user.username })
            .setTimestamp();

        if (result.details.length > 0) {
            embed.addFields({ name: '🎯 Chi tiết thắng', value: result.details.join('\n'), inline: false });
        }

        if (result.profit > 0) {
            embed.setImage('https://media.giphy.com/media/g9582DNuQppxC/giphy.gif');
        }

        await interaction.editReply({ embeds: [embed] });
    }
});

client.login(TOKEN);
