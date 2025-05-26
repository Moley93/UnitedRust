// Moderation System for UnitedRust Discord Bot
const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    PermissionFlagsBits 
} = require("discord.js");

class ModerationSystem {
    constructor(client, config) {
        this.client = client;
        this.config = config;
    }

    // Handle purge command
    async handlePurgeCommand(interaction) {
        try {
            const { member, channel } = interaction;
            const amount = interaction.options.getInteger("amount");

            // Check permissions
            const hasAdminRole = member.roles.cache.has(this.config.adminRoleId);
            const hasModRole = member.roles.cache.has(this.config.modRoleId);
            const hasAdminPerms = member.permissions.has(PermissionFlagsBits.Administrator);
            const hasManageMessages = member.permissions.has(PermissionFlagsBits.ManageMessages);

            if (!hasAdminRole && !hasModRole && !hasAdminPerms && !hasManageMessages) {
                return interaction.reply({
                    content: "❌ You don't have permission to use this command. Required: Admin role, Mod role, or Manage Messages permission.",
                    ephemeral: true,
                });
            }

            // Validate amount
            if (amount < 1 || amount > 100) {
                return interaction.reply({
                    content: "❌ Please specify a number between 1 and 100 messages to delete.",
                    ephemeral: true,
                });
            }

            // Check bot permissions
            const botMember = interaction.guild.members.me;
            if (!channel.permissionsFor(botMember).has(PermissionFlagsBits.ManageMessages)) {
                return interaction.reply({
                    content: "❌ I don't have permission to delete messages in this channel.",
                    ephemeral: true,
                });
            }

            // Confirm purge
            const confirmEmbed = new EmbedBuilder()
                .setTitle("🗑️ Confirm Message Purge")
                .setDescription(
                    `Are you sure you want to delete **${amount}** messages from ${channel}?\n\n` +
                    `**⚠️ This action cannot be undone!**`
                )
                .setColor(0xff9500)
                .addFields(
                    { name: "📊 Messages to delete", value: `${amount}`, inline: true },
                    { name: "📍 Channel", value: `${channel}`, inline: true },
                    { name: "👤 Requested by", value: `${member}`, inline: true }
                )
                .setTimestamp();

            const confirmButtons = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`purge_confirm_${amount}`)
                    .setLabel("✅ Confirm Purge")
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId("purge_cancel")
                    .setLabel("❌ Cancel")
                    .setStyle(ButtonStyle.Secondary)
            );

            await interaction.reply({
                embeds: [confirmEmbed],
                components: [confirmButtons],
                ephemeral: true,
            });

        } catch (error) {
            console.error("❌ Error in purge command:", error);
            await interaction.reply({
                content: "❌ An error occurred while processing the purge command.",
                ephemeral: true,
            });
        }
    }

    // Execute purge
    async executePurge(interaction, amount) {
        try {
            const { channel } = interaction;

            await interaction.update({
                content: "🔄 Purging messages...",
                embeds: [],
                components: [],
            });

            // Fetch and delete messages
            const messages = await channel.messages.fetch({ limit: amount });
            const deletedMessages = await channel.bulkDelete(messages, true);

            // Create success embed
            const successEmbed = new EmbedBuilder()
                .setTitle("✅ Messages Purged Successfully")
                .setDescription(
                    `Successfully deleted **${deletedMessages.size}** messages from ${channel}.`
                )
                .setColor(0x00ff00)
                .addFields(
                    { name: "🗑️ Messages Deleted", value: `${deletedMessages.size}`, inline: true },
                    { name: "📍 Channel", value: `${channel}`, inline: true },
                    { name: "👤 Purged by", value: `${interaction.user}`, inline: true }
                )
                .setTimestamp()
                .setFooter({ text: "UnitedRust Moderation System" });

            await interaction.editReply({
                embeds: [successEmbed],
            });

            // Log the action
            console.log(
                `🗑️ Purged ${deletedMessages.size} messages from ${channel.name} by ${interaction.user.tag}`
            );

            // Optional: Send a notification to the channel
            setTimeout(async () => {
                try {
                    const notificationMessage = await channel.send({
                        content: `🧹 **${deletedMessages.size}** messages were purged by ${interaction.user} for moderation purposes.`,
                    });

                    // Auto-delete the notification after 5 seconds
                    setTimeout(() => {
                        notificationMessage.delete().catch(() => {});
                    }, 5000);
                } catch (error) {
                    console.error("❌ Error sending purge notification:", error);
                }
            }, 1000);

        } catch (error) {
            console.error("❌ Error executing purge:", error);

            let errorMessage = "❌ An error occurred while purging messages.";
            if (error.code === 50034) {
                errorMessage = "❌ Cannot delete messages older than 14 days. Please try with fewer or more recent messages.";
            } else if (error.code === 50013) {
                errorMessage = "❌ I don't have permission to delete messages in this channel.";
            }

            await interaction.editReply({
                content: errorMessage,
                embeds: [],
                components: [],
            });
        }
    }

    // Handle purge button interactions
    async handlePurgeButtons(interaction) {
        const { customId } = interaction;

        if (customId.startsWith("purge_confirm_")) {
            const amount = parseInt(customId.split("_")[2]);
            await this.executePurge(interaction, amount);
        } else if (customId === "purge_cancel") {
            await interaction.update({
                content: "❌ Purge cancelled.",
                components: [],
            });
        }
    }

    // Timeout/mute a user
    async timeoutUser(guild, userId, duration, reason, moderator) {
        try {
            const member = await guild.members.fetch(userId);
            const timeoutEnd = new Date(Date.now() + duration);
            
            await member.timeout(duration, reason);

            const embed = new EmbedBuilder()
                .setTitle("⏰ User Timed Out")
                .setColor(0xff9500)
                .addFields(
                    { name: "👤 User", value: `${member.user.tag} (${member.user.id})`, inline: true },
                    { name: "👮 Moderator", value: `${moderator.tag}`, inline: true },
                    { name: "⏱️ Duration", value: `${Math.floor(duration / 1000 / 60)} minutes`, inline: true },
                    { name: "📝 Reason", value: reason || "No reason provided", inline: false },
                    { name: "⏰ Ends", value: `<t:${Math.floor(timeoutEnd.getTime() / 1000)}:f>`, inline: false }
                )
                .setTimestamp()
                .setFooter({ text: "UnitedRust Moderation System" });

            console.log(`⏰ ${member.user.tag} timed out by ${moderator.tag} for ${Math.floor(duration / 1000 / 60)} minutes`);
            return embed;
        } catch (error) {
            console.error("❌ Error timing out user:", error);
            throw error;
        }
    }

    // Remove timeout from user
    async removeTimeout(guild, userId, moderator) {
        try {
            const member = await guild.members.fetch(userId);
            await member.timeout(null);

            const embed = new EmbedBuilder()
                .setTitle("✅ Timeout Removed")
                .setColor(0x00ff00)
                .addFields(
                    { name: "👤 User", value: `${member.user.tag} (${member.user.id})`, inline: true },
                    { name: "👮 Moderator", value: `${moderator.tag}`, inline: true }
                )
                .setTimestamp()
                .setFooter({ text: "UnitedRust Moderation System" });

            console.log(`✅ Timeout removed from ${member.user.tag} by ${moderator.tag}`);
            return embed;
        } catch (error) {
            console.error("❌ Error removing timeout:", error);
            throw error;
        }
    }

    // Kick a user
    async kickUser(guild, userId, reason, moderator) {
        try {
            const member = await guild.members.fetch(userId);
            const userTag = member.user.tag;
            
            await member.kick(reason);

            const embed = new EmbedBuilder()
                .setTitle("👢 User Kicked")
                .setColor(0xff4500)
                .addFields(
                    { name: "👤 User", value: `${userTag} (${userId})`, inline: true },
                    { name: "👮 Moderator", value: `${moderator.tag}`, inline: true },
                    { name: "📝 Reason", value: reason || "No reason provided", inline: false }
                )
                .setTimestamp()
                .setFooter({ text: "UnitedRust Moderation System" });

            console.log(`👢 ${userTag} kicked by ${moderator.tag}`);
            return embed;
        } catch (error) {
            console.error("❌ Error kicking user:", error);
            throw error;
        }
    }

    // Ban a user
    async banUser(guild, userId, reason, moderator, deleteMessageDays = 0) {
        try {
            const user = await this.client.users.fetch(userId);
            const userTag = user.tag;
            
            await guild.bans.create(userId, {
                reason: reason,
                deleteMessageDays: deleteMessageDays
            });

            const embed = new EmbedBuilder()
                .setTitle("🔨 User Banned")
                .setColor(0xff0000)
                .addFields(
                    { name: "👤 User", value: `${userTag} (${userId})`, inline: true },
                    { name: "👮 Moderator", value: `${moderator.tag}`, inline: true },
                    { name: "📝 Reason", value: reason || "No reason provided", inline: false }
                )
                .setTimestamp()
                .setFooter({ text: "UnitedRust Moderation System" });

            console.log(`🔨 ${userTag} banned by ${moderator.tag}`);
            return embed;
        } catch (error) {
            console.error("❌ Error banning user:", error);
            throw error;
        }
    }

    // Unban a user
    async unbanUser(guild, userId, moderator) {
        try {
            await guild.bans.remove(userId);
            const user = await this.client.users.fetch(userId);

            const embed = new EmbedBuilder()
                .setTitle("✅ User Unbanned")
                .setColor(0x00ff00)
                .addFields(
                    { name: "👤 User", value: `${user.tag} (${userId})`, inline: true },
                    { name: "👮 Moderator", value: `${moderator.tag}`, inline: true }
                )
                .setTimestamp()
                .setFooter({ text: "UnitedRust Moderation System" });

            console.log(`✅ ${user.tag} unbanned by ${moderator.tag}`);
            return embed;
        } catch (error) {
            console.error("❌ Error unbanning user:", error);
            throw error;
        }
    }

    // Issue a warning
    async warnUser(guild, userId, reason, moderator) {
        try {
            const member = await guild.members.fetch(userId);

            const embed = new EmbedBuilder()
                .setTitle("⚠️ User Warned")
                .setColor(0xffff00)
                .addFields(
                    { name: "👤 User", value: `${member.user.tag} (${member.user.id})`, inline: true },
                    { name: "👮 Moderator", value: `${moderator.tag}`, inline: true },
                    { name: "📝 Reason", value: reason || "No reason provided", inline: false }
                )
                .setTimestamp()
                .setFooter({ text: "UnitedRust Moderation System" });

            // Try to DM the user
            try {
                const dmEmbed = new EmbedBuilder()
                    .setTitle("⚠️ Warning from UnitedRust")
                    .setDescription(`You have received a warning in ${guild.name}.`)
                    .addFields(
                        { name: "📝 Reason", value: reason || "No reason provided", inline: false },
                        { name: "👮 Issued by", value: moderator.tag, inline: true }
                    )
                    .setColor(0xffff00)
                    .setTimestamp();

                await member.send({ embeds: [dmEmbed] });
                console.log(`📧 Warning DM sent to ${member.user.tag}`);
            } catch (dmError) {
                console.log(`❌ Could not DM ${member.user.tag}: ${dmError.message}`);
            }

            console.log(`⚠️ ${member.user.tag} warned by ${moderator.tag}`);
            return embed;
        } catch (error) {
            console.error("❌ Error warning user:", error);
            throw error;
        }
    }

    // Check if user has moderation permissions
    hasModPermissions(member) {
        const hasAdminRole = member.roles.cache.has(this.config.adminRoleId);
        const hasModRole = member.roles.cache.has(this.config.modRoleId);
        const hasAdminPerms = member.permissions.has(PermissionFlagsBits.Administrator);
        const hasModeratePerms = member.permissions.has(PermissionFlagsBits.ModerateMembers);

        return hasAdminRole || hasModRole || hasAdminPerms || hasModeratePerms;
    }

    // Check if user has admin permissions
    hasAdminPermissions(member) {
        const hasAdminRole = member.roles.cache.has(this.config.adminRoleId);
        const hasAdminPerms = member.permissions.has(PermissionFlagsBits.Administrator);

        return hasAdminRole || hasAdminPerms;
    }

    // Log moderation action
    async logModerationAction(guild, action, embed) {
        try {
            // Try to find a moderation log channel
            const logChannel = guild.channels.cache.find(channel => 
                channel.name.includes('mod-log') || 
                channel.name.includes('audit-log') ||
                channel.name.includes('moderation')
            );

            if (logChannel) {
                await logChannel.send({ embeds: [embed] });
                console.log(`📝 Logged ${action} to ${logChannel.name}`);
            }
        } catch (error) {
            console.error("❌ Error logging moderation action:", error);
        }
    }

    // Get user information for moderation
    async getUserInfo(guild, userId) {
        try {
            const member = await guild.members.fetch(userId);
            const user = member.user;

            const embed = new EmbedBuilder()
                .setTitle(`👤 User Information: ${user.tag}`)
                .setColor(0x3498db)
                .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
                .addFields(
                    { name: "🆔 User ID", value: user.id, inline: true },
                    { name: "📅 Account Created", value: `<t:${Math.floor(user.createdTimestamp / 1000)}:f>`, inline: true },
                    { name: "📅 Joined Server", value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:f>`, inline: true },
                    { name: "🎭 Roles", value: member.roles.cache.size > 1 ? member.roles.cache.filter(role => role.name !== '@everyone').map(role => role.toString()).join(', ') : 'None', inline: false }
                )
                .setTimestamp();

            // Add timeout information if user is timed out
            if (member.isCommunicationDisabled()) {
                embed.addFields({
                    name: "⏰ Timeout Status",
                    value: `Timed out until <t:${Math.floor(member.communicationDisabledUntil.getTime() / 1000)}:f>`,
                    inline: false
                });
            }

            return embed;
        } catch (error) {
            console.error("❌ Error getting user info:", error);
            throw error;
        }
    }
}

module.exports = ModerationSystem;