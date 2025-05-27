// Playtime Giveaway System for UnitedRust Discord Bot
const { EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const cron = require("node-cron");

class GiveawaySystem {
    constructor(client, config) {
        this.client = client;
        this.config = config;
    }

    // Function to send playtime giveaway reminder
    async sendPlaytimeGiveawayMessage() {
        try {
            const channel = await this.client.channels.fetch(this.config.generalChannelId);

            const embed = new EmbedBuilder()
                .setColor("#FFD700") // Gold color
                .setTitle("🎁 UnitedRust - Playtime Giveaway!")
                .setDescription(
                    "**Think you've got the grind in you?**\n\nWe're rewarding the **Top 3 players** with the most **Active Playtime** (AFK excluded!) with some juicy rewards!"
                )
                .addFields(
                    {
                        name: "🥇 1st Place",
                        value: "**High Quality Bag**",
                        inline: true,
                    },
                    {
                        name: "🥈 2nd Place",
                        value: "**Weapon Barrel**",
                        inline: true,
                    },
                    {
                        name: "🥉 3rd Place",
                        value: "**High Quality Crate**",
                        inline: true,
                    },
                    {
                        name: "⏰ When?",
                        value: "The winners will be revealed at the **end of the current wipe** — make sure your grind time counts and don't AFK your way out of glory!",
                        inline: false,
                    },
                    {
                        name: "🚀 Get Started",
                        value: "**Start playing. Stay active. Secure your spot on the leaderboard.**",
                        inline: false,
                    }
                )
                .setThumbnail("https://via.placeholder.com/128x128/FFD700/000000?text=🎁")
                .setTimestamp()
                .setFooter({ text: "UnitedRust - Active Playtime Counts!" });

            await channel.send({ embeds: [embed] });
            console.log("✅ Playtime giveaway message sent successfully");
        } catch (error) {
            console.error("❌ Error sending playtime giveaway message:", error);
        }
    }

    // Handle manual giveaway command
    async handleSendGiveawayCommand(interaction) {
        try {
            const { member } = interaction;

            if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({
                    content: "❌ You need Administrator permissions to use this command.",
                    ephemeral: true,
                });
            }

            await this.sendPlaytimeGiveawayMessage();
            await interaction.reply({
                content: "✅ Playtime giveaway message has been sent!",
                ephemeral: true,
            });
        } catch (error) {
            console.error("❌ Error handling send giveaway command:", error);
            await interaction.reply({
                content: "❌ Error sending giveaway message.",
                ephemeral: true,
            });
        }
    }

    // Create a custom giveaway message
    async sendCustomGiveawayMessage(channel, prizes = null, description = null) {
        try {
            const defaultPrizes = [
                { place: "🥇 1st Place", prize: "**High Quality Bag**" },
                { place: "🥈 2nd Place", prize: "**Weapon Barrel**" },
                { place: "🥉 3rd Place", prize: "**High Quality Crate**" }
            ];

            const giveawayPrizes = prizes || defaultPrizes;
            const giveawayDescription = description || 
                "**Think you've got the grind in you?**\n\nWe're rewarding the **Top 3 players** with the most **Active Playtime** (AFK excluded!) with some juicy rewards!";

            const embed = new EmbedBuilder()
                .setColor("#FFD700")
                .setTitle("🎁 UnitedRust - Playtime Giveaway!")
                .setDescription(giveawayDescription);

            // Add prize fields
            giveawayPrizes.forEach(prize => {
                embed.addFields({
                    name: prize.place,
                    value: prize.prize,
                    inline: true,
                });
            });

            embed.addFields(
                {
                    name: "🎰 Mystery Loot",
                    value: "These mystery loot prizes are completely random – They could be worth hundreds, or they could be £2 skins... **That's the thrill of it** — you've got to be in it to win it!",
                    inline: false,
                },
                {
                    name: "⏰ When?",
                    value: "The winners will be revealed at the **end of the current wipe** — make sure your grind time counts and don't AFK your way out of glory!",
                    inline: false,
                },
                {
                    name: "🚀 Get Started",
                    value: "**Start playing. Stay active. Secure your spot on the leaderboard.**",
                    inline: false,
                }
            )
            .setThumbnail("https://via.placeholder.com/128x128/FFD700/000000?text=🎁")
            .setTimestamp()
            .setFooter({ text: "UnitedRust - Active Playtime Counts!" });

            await channel.send({ embeds: [embed] });
            console.log("✅ Custom playtime giveaway message sent successfully");
        } catch (error) {
            console.error("❌ Error sending custom giveaway message:", error);
        }
    }

    // Schedule playtime giveaway messages
    scheduleGiveawayReminders() {
        // Schedule playtime giveaway message every 4 hours
        cron.schedule(
            "0 */4 * * *",
            () => {
                console.log("🎁 Triggering playtime giveaway message...");
                this.sendPlaytimeGiveawayMessage();
            },
            { timezone: "UTC" }
        );

        console.log("🎁 Playtime giveaway reminders scheduled successfully!");
        console.log("- Playtime giveaway message: Every 4 hours (00:00, 04:00, 08:00, 12:00, 16:00, 20:00 UTC)");
    }

    // Send giveaway winner announcement
    async announceGiveawayWinners(winners) {
        try {
            const channel = await this.client.channels.fetch(this.config.generalChannelId);

            const embed = new EmbedBuilder()
                .setColor("#00FF00")
                .setTitle("🏆 Playtime Giveaway Winners!")
                .setDescription("**Congratulations to our playtime champions!**\n\nThank you to everyone who participated. The grind was real!")
                .setThumbnail("https://via.placeholder.com/128x128/00FF00/FFFFFF?text=🏆")
                .setTimestamp()
                .setFooter({ text: "UnitedRust - Congratulations to our winners!" });

            if (winners && winners.length > 0) {
                winners.forEach((winner, index) => {
                    const places = ["🥇 1st Place", "🥈 2nd Place", "🥉 3rd Place"];
                    const prizes = ["High Quality Bag", "Weapon Barrel", "High Quality Crate"];
                    
                    if (index < 3) {
                        embed.addFields({
                            name: places[index],
                            value: `${winner.mention || winner.name}\n**Playtime:** ${winner.playtime || 'N/A'}\n**Prize:** ${winner.prize || prizes[index]}`,
                            inline: true,
                        });
                    }
                });
            } else {
                embed.addFields({
                    name: "📊 Results",
                    value: "Winners will be announced soon! Check back later.",
                    inline: false,
                });
            }

            await channel.send({ embeds: [embed] });
            console.log("✅ Giveaway winners announcement sent successfully");
        } catch (error) {
            console.error("❌ Error sending giveaway winners announcement:", error);
        }
    }
}

module.exports = GiveawaySystem;