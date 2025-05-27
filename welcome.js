// Welcome System for UnitedRust Discord Bot
const { EmbedBuilder } = require("discord.js");

class WelcomeSystem {
    constructor(client, config) {
        this.client = client;
        this.config = config;
    }

    // Function to send welcome message
    async sendWelcomeMessage(member) {
        try {
            // If no welcome channel is configured, use the general channel
            const welcomeChannelId = this.config.welcomeChannelId || this.config.generalChannelId;
            const channel = member.guild.channels.cache.get(welcomeChannelId);

            if (!channel) {
                console.error(`❌ Welcome channel not found: ${welcomeChannelId}`);
                return;
            }

            const welcomeEmbed = new EmbedBuilder()
                .setTitle("🎮 Welcome to UnitedRust!")
                .setDescription(
                    `Hey ${member}! Welcome to our awesome Rust gaming community! 🦀\n\n` +
                    `**🌟 What we offer:**\n` +
                    `• Fair play environment with active moderation\n` +
                    `• Balanced gameplay with raid time restrictions\n` +
                    `• Friendly community of Rust enthusiasts\n` +
                    `• Regular events and giveaways\n\n` +
                    `**📋 Getting Started:**\n` +
                    `• Make sure you read the server rules!\n` +
                    `• Join voice chat and meet the community\n` +
                    `• Have questions? Open a ticket in our support channel!\n\n` +
                    `**🎯 Ready to dominate the battlefield? Let's go!**`
                )
                .setColor(0x2ecc71)
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
                .addFields(
                    {
                        name: "👤 New Member",
                        value: `${member.user.tag}`,
                        inline: true,
                    },
                    {
                        name: "📅 Joined",
                        value: `<t:${Math.floor(Date.now() / 1000)}:R>`,
                        inline: true,
                    },
                    {
                        name: "👥 Member Count",
                        value: `${member.guild.memberCount}`,
                        inline: true,
                    }
                )
                .setFooter({ 
                    text: "UnitedRust - Where legends are made!", 
                    iconURL: member.guild.iconURL()
                })
                .setTimestamp();

            await channel.send({ 
                content: `🎉 Everyone welcome ${member} to the **UnitedRust** family!`,
                embeds: [welcomeEmbed] 
            });

            console.log(`👋 Welcome message sent for ${member.user.tag} (${member.id})`);
        } catch (error) {
            console.error("❌ Error sending welcome message:", error);
        }
    }

    // Handle member join event
    async handleMemberJoin(member) {
        console.log(`👋 New member joined: ${member.user.tag} (${member.id})`);
        await this.sendWelcomeMessage(member);
    }

    // Send a custom welcome message (for testing or manual use)
    async sendCustomWelcomeMessage(channel, member, customMessage = null) {
        try {
            const welcomeEmbed = new EmbedBuilder()
                .setTitle("🎮 Welcome to UnitedRust!")
                .setDescription(
                    customMessage || 
                    `Hey ${member}! Welcome to our awesome Rust gaming community! 🦀\n\n` +
                    `**🌟 What we offer:**\n` +
                    `• Fair play environment with active moderation\n` +
                    `• Balanced gameplay with raid time restrictions\n` +
                    `• Friendly community of Rust enthusiasts\n` +
                    `• Regular events and giveaways\n\n` +
                    `**📋 Getting Started:**\n` +
                    `• Check out our server rules with \`/serverrules\`\n` +
                    `• Read Discord rules with \`/discordrules\`\n` +
                    `• Join voice chat and meet the community\n` +
                    `• Have questions? Open a ticket in our support channel!\n\n` +
                    `**🎯 Ready to dominate the battlefield? Let's go!**`
                )
                .setColor(0x2ecc71)
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
                .addFields(
                    {
                        name: "👤 New Member",
                        value: `${member.user.tag}`,
                        inline: true,
                    },
                    {
                        name: "📅 Joined",
                        value: `<t:${Math.floor(Date.now() / 1000)}:R>`,
                        inline: true,
                    },
                    {
                        name: "👥 Member Count",
                        value: `${member.guild.memberCount}`,
                        inline: true,
                    }
                )
                .setFooter({ 
                    text: "UnitedRust - Where legends are made!", 
                    iconURL: member.guild.iconURL()
                })
                .setTimestamp();

            await channel.send({ 
                content: `🎉 Everyone welcome ${member} to the **UnitedRust** family!`,
                embeds: [welcomeEmbed] 
            });

            console.log(`👋 Custom welcome message sent for ${member.user.tag} (${member.id})`);
        } catch (error) {
            console.error("❌ Error sending custom welcome message:", error);
        }
    }
}

module.exports = WelcomeSystem;