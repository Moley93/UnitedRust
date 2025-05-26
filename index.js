// UnitedRust Combined Discord Bot - Main File
const { Client, GatewayIntentBits, PermissionFlagsBits } = require("discord.js");
const express = require("express");

// Import configuration and modules
const { config, validateConfig } = require("./config");
const CurfewSystem = require("./curfew");
const TicketSystem = require("./tickets");
const WelcomeSystem = require("./welcome");
const GiveawaySystem = require("./giveaway");
const ModerationSystem = require("./moderation");
const RulesSystem = require("./rules");
const DebugSystem = require("./debug");
const CommandManager = require("./commands");

// Initialize Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers, // Required for welcome messages
    ],
});

// Initialize all systems
let curfewSystem;
let ticketSystem;
let welcomeSystem;
let giveawaySystem;
let moderationSystem;
let rulesSystem;
let debugSystem;
let commandManager;

// Bot ready event
client.once("ready", async () => {
    console.log(`✅ ${client.user.tag} is online and ready!`);
    console.log(`🎫 UnitedRust Combined Bot initialized`);

    // Auto-detect CLIENT_ID if not set
    if (!config.clientId) {
        config.clientId = client.application.id;
        console.log(`🔍 Auto-detected CLIENT_ID: ${config.clientId}`);
    }

    // Initialize all systems
    curfewSystem = new CurfewSystem(client, config);
    ticketSystem = new TicketSystem(client, config);
    welcomeSystem = new WelcomeSystem(client, config);
    giveawaySystem = new GiveawaySystem(client, config);
    moderationSystem = new ModerationSystem(client, config);
    rulesSystem = new RulesSystem();
    debugSystem = new DebugSystem(client, config);
    commandManager = new CommandManager(config);

    console.log(`🔧 Next ticket number: ${ticketSystem.ticketCounter}`);
    console.log(`📋 Active tickets: ${Array.from(ticketSystem.tickets.values()).filter(t => !t.closed).length}`);

    // Register slash commands
    await commandManager.registerCommands();

    // Schedule cron jobs
    curfewSystem.scheduleCurfewReminders();
    giveawaySystem.scheduleGiveawayReminders();

    console.log("🕒 All systems initialized successfully!");
    console.log("- Curfew System: ✅ Active");
    console.log("- Ticket System: ✅ Active");
    console.log("- Welcome System: ✅ Active");
    console.log("- Giveaway System: ✅ Active");
    console.log("- Moderation System: ✅ Active");
    console.log("- Rules System: ✅ Active");
    console.log("- Debug System: ✅ Active");

    // Log system info
    debugSystem.logSystemInfo();
});

// Member join event for welcome messages
client.on("guildMemberAdd", async (member) => {
    await welcomeSystem.handleMemberJoin(member);
});

// Handle interactions
client.on("interactionCreate", async (interaction) => {
    if (interaction.isButton()) {
        await handleButtonInteraction(interaction);
    } else if (interaction.isChatInputCommand()) {
        await handleSlashCommand(interaction);
    }
});

// Handle button interactions
async function handleButtonInteraction(interaction) {
    const { customId } = interaction;

    try {
        if (customId === "report_player") {
            await ticketSystem.createTicket(interaction, "player");
        } else if (customId === "report_staff") {
            await ticketSystem.createTicket(interaction, "staff");
        } else if (customId === "close_ticket") {
            await ticketSystem.closeTicket(interaction);
        } else if (customId === "confirm_close") {
            await ticketSystem.confirmCloseTicket(interaction);
        } else if (customId === "cancel_close") {
            await interaction.update({
                content: "❌ Ticket closure cancelled.",
                components: [],
            });
        } else if (customId.startsWith("purge_confirm_") || customId === "purge_cancel") {
            await moderationSystem.handlePurgeButtons(interaction);
        }
    } catch (error) {
        console.error("❌ Error handling button interaction:", error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: "❌ An error occurred while processing your request.",
                ephemeral: true,
            });
        }
    }
}

// Handle slash commands
async function handleSlashCommand(interaction) {
    const { commandName, member } = interaction;

    try {
        switch (commandName) {
            // Curfew Commands
            case "curfew":
                await curfewSystem.handleCurfewCommand(interaction);
                break;

            // Giveaway Commands
            case "send-giveaway":
                await giveawaySystem.handleSendGiveawayCommand(interaction);
                break;

            // Moderation Commands
            case "purge":
                await moderationSystem.handlePurgeCommand(interaction);
                break;

            case "timeout":
                if (!moderationSystem.hasModPermissions(member)) {
                    return interaction.reply({
                        content: "❌ You don't have permission to use this command.",
                        ephemeral: true,
                    });
                }
                const timeoutUser = interaction.options.getUser("user");
                const timeoutDuration = interaction.options.getInteger("duration") * 60 * 1000; // Convert to ms
                const timeoutReason = interaction.options.getString("reason");
                
                try {
                    const embed = await moderationSystem.timeoutUser(
                        interaction.guild, 
                        timeoutUser.id, 
                        timeoutDuration, 
                        timeoutReason, 
                        interaction.user
                    );
                    await interaction.reply({ embeds: [embed] });
                    await moderationSystem.logModerationAction(interaction.guild, "timeout", embed);
                } catch (error) {
                    await interaction.reply({
                        content: `❌ Failed to timeout ${timeoutUser}: ${error.message}`,
                        ephemeral: true,
                    });
                }
                break;

            case "remove-timeout":
                if (!moderationSystem.hasModPermissions(member)) {
                    return interaction.reply({
                        content: "❌ You don't have permission to use this command.",
                        ephemeral: true,
                    });
                }
                const removeTimeoutUser = interaction.options.getUser("user");
                
                try {
                    const embed = await moderationSystem.removeTimeout(
                        interaction.guild, 
                        removeTimeoutUser.id, 
                        interaction.user
                    );
                    await interaction.reply({ embeds: [embed] });
                    await moderationSystem.logModerationAction(interaction.guild, "remove-timeout", embed);
                } catch (error) {
                    await interaction.reply({
                        content: `❌ Failed to remove timeout from ${removeTimeoutUser}: ${error.message}`,
                        ephemeral: true,
                    });
                }
                break;

            case "kick":
                if (!moderationSystem.hasModPermissions(member)) {
                    return interaction.reply({
                        content: "❌ You don't have permission to use this command.",
                        ephemeral: true,
                    });
                }
                const kickUser = interaction.options.getUser("user");
                const kickReason = interaction.options.getString("reason");
                
                try {
                    const embed = await moderationSystem.kickUser(
                        interaction.guild, 
                        kickUser.id, 
                        kickReason, 
                        interaction.user
                    );
                    await interaction.reply({ embeds: [embed] });
                    await moderationSystem.logModerationAction(interaction.guild, "kick", embed);
                } catch (error) {
                    await interaction.reply({
                        content: `❌ Failed to kick ${kickUser}: ${error.message}`,
                        ephemeral: true,
                    });
                }
                break;

            case "ban":
                if (!moderationSystem.hasAdminPermissions(member)) {
                    return interaction.reply({
                        content: "❌ You need administrator permissions to use this command.",
                        ephemeral: true,
                    });
                }
                const banUser = interaction.options.getUser("user");
                const banReason = interaction.options.getString("reason");
                const deleteMessageDays = interaction.options.getInteger("delete-messages") || 0;
                
                try {
                    const embed = await moderationSystem.banUser(
                        interaction.guild, 
                        banUser.id, 
                        banReason, 
                        interaction.user, 
                        deleteMessageDays
                    );
                    await interaction.reply({ embeds: [embed] });
                    await moderationSystem.logModerationAction(interaction.guild, "ban", embed);
                } catch (error) {
                    await interaction.reply({
                        content: `❌ Failed to ban ${banUser}: ${error.message}`,
                        ephemeral: true,
                    });
                }
                break;

            case "unban":
                if (!moderationSystem.hasAdminPermissions(member)) {
                    return interaction.reply({
                        content: "❌ You need administrator permissions to use this command.",
                        ephemeral: true,
                    });
                }
                const unbanUserId = interaction.options.getString("user-id");
                
                try {
                    const embed = await moderationSystem.unbanUser(
                        interaction.guild, 
                        unbanUserId, 
                        interaction.user
                    );
                    await interaction.reply({ embeds: [embed] });
                    await moderationSystem.logModerationAction(interaction.guild, "unban", embed);
                } catch (error) {
                    await interaction.reply({
                        content: `❌ Failed to unban user: ${error.message}`,
                        ephemeral: true,
                    });
                }
                break;

            case "warn":
                if (!moderationSystem.hasModPermissions(member)) {
                    return interaction.reply({
                        content: "❌ You don't have permission to use this command.",
                        ephemeral: true,
                    });
                }
                const warnUser = interaction.options.getUser("user");
                const warnReason = interaction.options.getString("reason");
                
                try {
                    const embed = await moderationSystem.warnUser(
                        interaction.guild, 
                        warnUser.id, 
                        warnReason, 
                        interaction.user
                    );
                    await interaction.reply({ embeds: [embed] });
                    await moderationSystem.logModerationAction(interaction.guild, "warn", embed);
                } catch (error) {
                    await interaction.reply({
                        content: `❌ Failed to warn ${warnUser}: ${error.message}`,
                        ephemeral: true,
                    });
                }
                break;

            case "userinfo":
                if (!moderationSystem.hasModPermissions(member)) {
                    return interaction.reply({
                        content: "❌ You don't have permission to use this command.",
                        ephemeral: true,
                    });
                }
                const infoUser = interaction.options.getUser("user");
                
                try {
                    const embed = await moderationSystem.getUserInfo(interaction.guild, infoUser.id);
                    await interaction.reply({ embeds: [embed], ephemeral: true });
                } catch (error) {
                    await interaction.reply({
                        content: `❌ Failed to get user info: ${error.message}`,
                        ephemeral: true,
                    });
                }
                break;

            // Ticket Commands
            case "setup-tickets":
                if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return interaction.reply({
                        content: "❌ You need Administrator permissions to use this command.",
                        ephemeral: true,
                    });
                }
                await ticketSystem.setupTicketCreationMessage();
                await interaction.reply({
                    content: "✅ Ticket creation message has been set up!",
                    ephemeral: true,
                });
                break;

            case "close-ticket":
                await ticketSystem.handleCloseTicketCommand(interaction);
                break;

            case "add-user":
                await ticketSystem.handleTicketUserManagement(interaction, "add");
                break;

            case "remove-user":
                await ticketSystem.handleTicketUserManagement(interaction, "remove");
                break;

            case "ticket-info":
                await ticketSystem.showTicketInfo(interaction);
                break;

            // Rules Commands
            case "discordrules":
                await rulesSystem.handleDiscordRulesCommand(interaction);
                break;

            case "serverrules":
                await rulesSystem.handleServerRulesCommand(interaction);
                break;

            // Debug Commands
            case "debug-config":
                await debugSystem.debugConfiguration(interaction);
                break;

            case "ping":
                await debugSystem.handlePingCommand(interaction);
                break;

            case "bot-status":
                const statusEmbed = debugSystem.createBotStatusEmbed();
                await interaction.reply({ embeds: [statusEmbed] });
                break;

            case "test-systems":
                if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return interaction.reply({
                        content: "❌ You need Administrator permissions to use this command.",
                        ephemeral: true,
                    });
                }
                await debugSystem.testBotSystems(interaction);
                break;

            // Utility Commands
            case "server-info":
                const { guild } = interaction;
                const serverInfoEmbed = new (require("discord.js").EmbedBuilder)()
                    .setTitle(`📊 ${guild.name} Server Information`)
                    .setColor(0x3498db)
                    .setThumbnail(guild.iconURL({ dynamic: true, size: 256 }))
                    .addFields(
                        { name: "🆔 Server ID", value: guild.id, inline: true },
                        { name: "👤 Owner", value: `<@${guild.ownerId}>`, inline: true },
                        { name: "📅 Created", value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:f>`, inline: true },
                        { name: "👥 Members", value: `${guild.memberCount}`, inline: true },
                        { name: "📺 Channels", value: `${guild.channels.cache.size}`, inline: true },
                        { name: "🎭 Roles", value: `${guild.roles.cache.size}`, inline: true },
                        { name: "😀 Emojis", value: `${guild.emojis.cache.size}`, inline: true },
                        { name: "🔒 Verification Level", value: guild.verificationLevel.toString(), inline: true },
                        { name: "🛡️ Boost Level", value: `${guild.premiumTier}`, inline: true }
                    )
                    .setTimestamp();

                await interaction.reply({ embeds: [serverInfoEmbed] });
                break;

            case "help":
                const category = interaction.options.getString("category");
                const helpEmbed = createHelpEmbed(category);
                await interaction.reply({ embeds: [helpEmbed], ephemeral: true });
                break;

            default:
                await interaction.reply({
                    content: "❌ Unknown command.",
                    ephemeral: true,
                });
        }
    } catch (error) {
        console.error(`❌ Error handling command ${commandName}:`, error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: "❌ An error occurred while processing your command.",
                ephemeral: true,
            });
        }
    }
}

// Create help embed
function createHelpEmbed(category) {
    const { EmbedBuilder } = require("discord.js");
    const embed = new EmbedBuilder()
        .setTitle("🤖 UnitedRust Bot Help")
        .setColor(0x3498db)
        .setTimestamp()
        .setFooter({ text: "UnitedRust Bot Help System" });

    if (!category) {
        embed.setDescription(
            "**Available Command Categories:**\n\n" +
            "🛡️ **Moderation** - `/help category:moderation`\n" +
            "🎫 **Tickets** - `/help category:tickets`\n" +
            "📋 **Rules** - `/help category:rules`\n" +
            "🚫 **Curfew** - `/help category:curfew`\n" +
            "🎁 **Giveaway** - `/help category:giveaway`\n" +
            "🔧 **Debug** - `/help category:debug`\n\n" +
            "Use `/help category:[name]` to see commands in each category."
        );
    } else {
        const commands = commandManager.getCommandsByCategory();
        
        switch (category) {
            case "moderation":
                embed.setTitle("🛡️ Moderation Commands")
                    .setDescription("Commands for server moderation (Mod/Admin only)")
                    .addFields(
                        { name: "/purge", value: "Delete multiple messages", inline: false },
                        { name: "/timeout", value: "Timeout a user", inline: false },
                        { name: "/remove-timeout", value: "Remove timeout from user", inline: false },
                        { name: "/kick", value: "Kick a user from server", inline: false },
                        { name: "/ban", value: "Ban a user from server", inline: false },
                        { name: "/unban", value: "Unban a user", inline: false },
                        { name: "/warn", value: "Warn a user", inline: false },
                        { name: "/userinfo", value: "Get user information", inline: false }
                    );
                break;

            case "tickets":
                embed.setTitle("🎫 Ticket System Commands")
                    .setDescription("Commands for managing the ticket system")
                    .addFields(
                        { name: "/setup-tickets", value: "Setup ticket creation message (Admin)", inline: false },
                        { name: "/close-ticket", value: "Close current ticket", inline: false },
                        { name: "/add-user", value: "Add user to ticket", inline: false },
                        { name: "/remove-user", value: "Remove user from ticket", inline: false },
                        { name: "/ticket-info", value: "Get ticket information", inline: false }
                    );
                break;

            case "rules":
                embed.setTitle("📋 Rules Commands")
                    .setDescription("Commands for displaying server rules")
                    .addFields(
                        { name: "/discordrules", value: "Display Discord server rules", inline: false },
                        { name: "/serverrules", value: "Display Rust server rules", inline: false }
                    );
                break;

            case "curfew":
                embed.setTitle("🚫 Curfew Commands")
                    .setDescription("Commands for raid curfew system")
                    .addFields(
                        { name: "/curfew", value: "Check current raid curfew status", inline: false }
                    );
                break;

            case "giveaway":
                embed.setTitle("🎁 Giveaway Commands")
                    .setDescription("Commands for playtime giveaway system")
                    .addFields(
                        { name: "/send-giveaway", value: "Send giveaway message (Admin)", inline: false }
                    );
                break;

            case "debug":
                embed.setTitle("🔧 Debug Commands")
                    .setDescription("Commands for debugging and system status")
                    .addFields(
                        { name: "/debug-config", value: "Debug bot configuration (Admin)", inline: false },
                        { name: "/ping", value: "Check bot ping and status", inline: false },
                        { name: "/bot-status", value: "Get detailed bot status", inline: false },
                        { name: "/test-systems", value: "Test all bot systems (Admin)", inline: false }
                    );
                break;

            default:
                embed.setDescription("❌ Unknown category. Use `/help` to see available categories.");
        }
    }

    return embed;
}

// Web server for health checks
const app = express();
const port = config.port;

app.get("/", (req, res) => {
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);

    res.json({
        status: "UnitedRust Enhanced Bot is running!",
        uptime: `${hours}h ${minutes}m`,
        bot_status: client.user ? "Online" : "Connecting...",
        guilds: client.guilds.cache.size,
        tickets: ticketSystem ? ticketSystem.tickets.size : 0,
        features: [
            "Raid Curfew",
            "Ticket System", 
            "Rules Commands",
            "Playtime Giveaway",
            "Welcome Messages",
            "Message Purge System",
            "Advanced Moderation"
        ],
        systems: {
            curfew: "✅ Active",
            tickets: "✅ Active", 
            welcome: "✅ Active",
            giveaway: "✅ Active",
            moderation: "✅ Active",
            rules: "✅ Active",
            debug: "✅ Active"
        }
    });
});

app.get("/ping", (req, res) => {
    res.send("Pong! Enhanced bot is alive.");
});

app.get("/health", (req, res) => {
    res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        raid_status: curfewSystem ? (curfewSystem.isRaidingAllowed() ? "allowed" : "not_allowed") : "unknown",
        next_ticket: ticketSystem ? ticketSystem.ticketCounter : 0,
        systems_active: 7,
        memory_usage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + "MB"
    });
});

app.listen(port, () => {
    console.log(`🌐 Web server running on port ${port}`);
});

// Error handling
client.on("error", (error) => {
    console.error("❌ Discord client error:", error);
});

process.on("unhandledRejection", (reason, promise) => {
    console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (error) => {
    console.error("❌ Uncaught Exception:", error);
});

// Graceful shutdown
process.on("SIGINT", () => {
    console.log("🔄 Received SIGINT, shutting down gracefully...");
    client.destroy();
    process.exit(0);
});

process.on("SIGTERM", () => {
    console.log("🔄 Received SIGTERM, shutting down gracefully...");
    client.destroy();
    process.exit(0);
});

// Startup
console.log("🚀 Starting UnitedRust Enhanced Discord Bot...");
console.log("🔐 Attempting to login to Discord...");
console.log("📋 Guild ID:", config.guildId);
console.log("🎯 Token configured:", config.token ? "✅" : "❌");
console.log("🆔 Client ID:", config.clientId);
console.log("🎫 Ticket System: ENABLED");
console.log("🚫 Curfew System: ENABLED");
console.log("👋 Welcome System: ENABLED");
console.log("🎁 Giveaway System: ENABLED");
console.log("🛡️ Moderation System: ENABLED");
console.log("📋 Rules System: ENABLED");
console.log("🔧 Debug System: ENABLED");

// Validate configuration and login
if (validateConfig()) {
    client.login(config.token).catch((error) => {
        console.error("❌ Failed to login to Discord:", error.message);

        if (error.code === "TOKEN_INVALID") {
            console.error("💡 The bot token is invalid. Please check your DISCORD_TOKEN in the .env file.");
        }

        process.exit(1);
    });
} else {
    process.exit(1);
}