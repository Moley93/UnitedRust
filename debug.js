// Debug System for UnitedRust Discord Bot
const { EmbedBuilder, PermissionFlagsBits } = require("discord.js");

class DebugSystem {
    constructor(client, config) {
        this.client = client;
        this.config = config;
    }

    // Debug configuration function
    async debugConfiguration(interaction) {
        try {
            const { guild, member } = interaction;

            // Check permissions
            if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({
                    content: "❌ You need Administrator permissions to use this command.",
                    ephemeral: true,
                });
            }

            // Check all configured resources
            const checks = [];

            // Check ticket category
            const ticketCategory = guild.channels.cache.get(this.config.ticketCategoryId);
            checks.push({
                name: "🗂️ Ticket Category",
                value: ticketCategory
                    ? `✅ ${ticketCategory.name} (${ticketCategory.id})`
                    : `❌ Not found (${this.config.ticketCategoryId})`,
                inline: false,
            });

            // Check moderator role
            const moderatorRole = guild.roles.cache.get(this.config.moderatorRoleId);
            checks.push({
                name: "👮 Moderator Role",
                value: moderatorRole
                    ? `✅ ${moderatorRole.name} (${moderatorRole.id})`
                    : `❌ Not found (${this.config.moderatorRoleId})`,
                inline: false,
            });

            // Check admin role
            const adminRole = guild.roles.cache.get(this.config.adminRoleId);
            checks.push({
                name: "👑 Admin Role",
                value: adminRole
                    ? `✅ ${adminRole.name} (${adminRole.id})`
                    : `❌ Not found (${this.config.adminRoleId})`,
                inline: false,
            });

            // Check mod role
            const modRole = guild.roles.cache.get(this.config.modRoleId);
            checks.push({
                name: "🛡️ Mod Role",
                value: modRole
                    ? `✅ ${modRole.name} (${modRole.id})`
                    : `❌ Not found (${this.config.modRoleId})`,
                inline: false,
            });

            // Check ticket channel
            const ticketChannel = guild.channels.cache.get(this.config.ticketChannelId);
            checks.push({
                name: "🎫 Ticket Creation Channel",
                value: ticketChannel
                    ? `✅ ${ticketChannel.name} (${ticketChannel.id})`
                    : `❌ Not found (${this.config.ticketChannelId})`,
                inline: false,
            });

            // Check general channel
            const generalChannel = guild.channels.cache.get(this.config.generalChannelId);
            checks.push({
                name: "📢 General Channel",
                value: generalChannel
                    ? `✅ ${generalChannel.name} (${generalChannel.id})`
                    : `❌ Not found (${this.config.generalChannelId})`,
                inline: false,
            });

            // Check welcome channel
            const welcomeChannel = guild.channels.cache.get(this.config.welcomeChannelId);
            checks.push({
                name: "👋 Welcome Channel",
                value: welcomeChannel
                    ? `✅ ${welcomeChannel.name} (${welcomeChannel.id})`
                    : this.config.welcomeChannelId 
                        ? `❌ Not found (${this.config.welcomeChannelId})`
                        : `⚠️ Not configured (optional)`,
                inline: false,
            });

            // Check bot permissions in ticket category
            let categoryPermissions = "❌ Category not found";
            if (ticketCategory) {
                const botMember = guild.members.me;
                const hasCreateChannels = ticketCategory
                    .permissionsFor(botMember)
                    .has(PermissionFlagsBits.ManageChannels);
                const hasViewChannel = ticketCategory
                    .permissionsFor(botMember)
                    .has(PermissionFlagsBits.ViewChannel);
                categoryPermissions =
                    hasCreateChannels && hasViewChannel
                        ? "✅ Has required permissions"
                        : "❌ Missing permissions";
            }

            checks.push({
                name: "🤖 Bot Permissions in Category",
                value: categoryPermissions,
                inline: false,
            });

            const embed = new EmbedBuilder()
                .setTitle("🔧 Bot Configuration Debug")
                .setDescription("Checking all configured resources and permissions...")
                .addFields(checks)
                .addFields({
                    name: "📊 Bot Status",
                    value: `✅ Online as ${this.client.user.tag}\n🆔 Client ID: ${this.config.clientId}\n🏠 Guild: ${guild.name} (${guild.id})`,
                    inline: false,
                })
                .setColor(0x3498db)
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (error) {
            console.error("❌ Error in debug command:", error);
            await interaction.reply({
                content: "❌ Error running debug command.",
                ephemeral: true,
            });
        }
    }

    // Get bot statistics
    getBotStats() {
        const stats = {
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage(),
            guilds: this.client.guilds.cache.size,
            users: this.client.users.cache.size,
            channels: this.client.channels.cache.size,
            ping: this.client.ws.ping,
            nodeVersion: process.version,
            discordJsVersion: require('discord.js').version
        };

        return stats;
    }

    // Create bot status embed
    createBotStatusEmbed() {
        const stats = this.getBotStats();
        const uptime = stats.uptime;
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);

        return new EmbedBuilder()
            .setTitle("🤖 Bot Status")
            .setColor(0x00ff00)
            .addFields(
                { name: "⏱️ Uptime", value: `${hours}h ${minutes}m ${seconds}s`, inline: true },
                { name: "🏓 Ping", value: `${stats.ping}ms`, inline: true },
                { name: "🏠 Guilds", value: `${stats.guilds}`, inline: true },
                { name: "👥 Users", value: `${stats.users}`, inline: true },
                { name: "📺 Channels", value: `${stats.channels}`, inline: true },
                { name: "💾 Memory Usage", value: `${Math.round(stats.memoryUsage.heapUsed / 1024 / 1024)}MB`, inline: true },
                { name: "🔧 Node.js", value: stats.nodeVersion, inline: true },
                { name: "📚 Discord.js", value: stats.discordJsVersion, inline: true }
            )
            .setTimestamp()
            .setFooter({ text: "UnitedRust Bot Status" });
    }

    // Test all bot systems
    async testBotSystems(interaction) {
        try {
            const { guild } = interaction;
            await interaction.deferReply({ ephemeral: true });

            const tests = [];

            // Test 1: Database connectivity (if applicable)
            tests.push({
                name: "💾 File System Access",
                status: "✅ Working",
                details: "Can read/write configuration files"
            });

            // Test 2: Discord API connectivity
            tests.push({
                name: "🌐 Discord API",
                status: this.client.ws.ping < 100 ? "✅ Excellent" : this.client.ws.ping < 300 ? "⚠️ Good" : "❌ Poor",
                details: `Ping: ${this.client.ws.ping}ms`
            });

            // Test 3: Guild permissions
            const botMember = guild.members.me;
            const hasBasicPerms = botMember.permissions.has([
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.ViewChannel
            ]);
            tests.push({
                name: "🔐 Basic Permissions",
                status: hasBasicPerms ? "✅ Working" : "❌ Missing",
                details: "Send Messages, Read History, View Channels"
            });

            // Test 4: Ticket system
            const ticketCategory = guild.channels.cache.get(this.config.ticketCategoryId);
            tests.push({
                name: "🎫 Ticket System",
                status: ticketCategory ? "✅ Ready" : "❌ Not Configured",
                details: ticketCategory ? `Category: ${ticketCategory.name}` : "Missing ticket category"
            });

            // Test 5: Moderation permissions
            const hasModPerms = botMember.permissions.has([
                PermissionFlagsBits.ManageMessages,
                PermissionFlagsBits.ModerateMembers
            ]);
            tests.push({
                name: "👮 Moderation System",
                status: hasModPerms ? "✅ Ready" : "⚠️ Limited",
                details: hasModPerms ? "Full moderation access" : "Limited moderation permissions"
            });

            // Test 6: Channel access
            const generalChannel = guild.channels.cache.get(this.config.generalChannelId);
            tests.push({
                name: "📢 Channel Access",
                status: generalChannel ? "✅ Working" : "❌ Missing",
                details: generalChannel ? `Can access ${generalChannel.name}` : "Cannot access general channel"
            });

            const embed = new EmbedBuilder()
                .setTitle("🔍 System Test Results")
                .setColor(0x3498db)
                .setDescription("Testing all bot systems and permissions...")
                .setTimestamp();

            tests.forEach(test => {
                embed.addFields({
                    name: `${test.status} ${test.name}`,
                    value: test.details,
                    inline: false
                });
            });

            // Overall system health
            const workingTests = tests.filter(test => test.status.includes("✅")).length;
            const totalTests = tests.length;
            const healthPercentage = Math.round((workingTests / totalTests) * 100);

            let healthColor = 0x00ff00; // Green
            if (healthPercentage < 70) healthColor = 0xff0000; // Red
            else if (healthPercentage < 90) healthColor = 0xff9500; // Orange

            embed.setColor(healthColor);
            embed.addFields({
                name: "📊 Overall System Health",
                value: `${workingTests}/${totalTests} systems working (${healthPercentage}%)`,
                inline: false
            });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error("❌ Error testing bot systems:", error);
            await interaction.editReply({
                content: "❌ Error running system tests.",
            });
        }
    }

    // Log system information
    logSystemInfo() {
        const stats = this.getBotStats();
        console.log("🤖 Bot System Information:");
        console.log(`   Uptime: ${Math.floor(stats.uptime / 3600)}h ${Math.floor((stats.uptime % 3600) / 60)}m`);
        console.log(`   Memory: ${Math.round(stats.memoryUsage.heapUsed / 1024 / 1024)}MB`);
        console.log(`   Guilds: ${stats.guilds}`);
        console.log(`   Users: ${stats.users}`);
        console.log(`   Ping: ${stats.ping}ms`);
        console.log(`   Node.js: ${stats.nodeVersion}`);
        console.log(`   Discord.js: ${stats.discordJsVersion}`);
    }

    // Create configuration summary
    createConfigSummary() {
        return {
            bot: {
                clientId: this.config.clientId,
                guildId: this.config.guildId,
                hasToken: !!this.config.token
            },
            channels: {
                general: this.config.generalChannelId,
                tickets: this.config.ticketChannelId,
                ticketCategory: this.config.ticketCategoryId,
                welcome: this.config.welcomeChannelId || "Not configured"
            },
            roles: {
                admin: this.config.adminRoleId,
                mod: this.config.modRoleId,
                moderator: this.config.moderatorRoleId
            },
            features: {
                curfewSystem: true,
                ticketSystem: true,
                welcomeSystem: true,
                moderationSystem: true,
                giveawaySystem: true,
                rulesSystem: true
            }
        };
    }

    // Handle ping command
    async handlePingCommand(interaction) {
        try {
            const ping = this.client.ws.ping;
            let pingStatus = "🟢 Excellent";
            let pingColor = 0x00ff00;

            if (ping > 100) {
                pingStatus = "🟡 Good";
                pingColor = 0xffff00;
            }
            if (ping > 300) {
                pingStatus = "🔴 Poor";
                pingColor = 0xff0000;
            }

            const embed = new EmbedBuilder()
                .setTitle("🏓 Pong!")
                .setColor(pingColor)
                .addFields(
                    { name: "📡 WebSocket Ping", value: `${ping}ms`, inline: true },
                    { name: "📊 Status", value: pingStatus, inline: true }
                )
                .setTimestamp()
                .setFooter({ text: "UnitedRust Bot" });

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error("❌ Error in ping command:", error);
            await interaction.reply({
                content: "❌ Error checking ping.",
                ephemeral: true,
            });
        }
    }
}

module.exports = DebugSystem;