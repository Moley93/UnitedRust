// Command Definitions for UnitedRust Discord Bot
const { SlashCommandBuilder, REST, Routes } = require("discord.js");

class CommandManager {
    constructor(config) {
        this.config = config;
        this.commands = this.defineCommands();
    }

    // Define all slash commands
    defineCommands() {
        return [
            // Leaderboard Commands - UPDATED WITH NEW COMMANDS
            new SlashCommandBuilder()
                .setName("leaderboard")
                .setDescription("View server leaderboards")
                .addStringOption((option) =>
                    option
                        .setName("category")
                        .setDescription("Leaderboard category to display")
                        .setRequired(false)
                        .addChoices(
                            // Material categories
                            { name: "Stone Gathered", value: "stones" },
                            { name: "Wood Gathered", value: "wood" },
                            { name: "Sulfur Ore", value: "sulfurOre" },
                            { name: "Metal Ore", value: "metalOre" },
                            // PvP categories
                            { name: "PvP Kills", value: "kills" },
                            { name: "Deaths", value: "deaths" },
                            { name: "K/D Ratio", value: "kdRatio" },
                            { name: "PvP Accuracy", value: "accuracy" },
                            // Time categories
                            { name: "Total Playtime", value: "totalLifetime" },
                            { name: "Wipe Playtime", value: "sinceWipe" },
                            { name: "AFK Time", value: "afkTime" }
                        )
                ),

            new SlashCommandBuilder()
                .setName("lb")
                .setDescription("View server leaderboards (short version)")
                .addStringOption((option) =>
                    option
                        .setName("category")
                        .setDescription("Leaderboard category to display")
                        .setRequired(false)
                        .addChoices(
                            // Material categories
                            { name: "Stone Gathered", value: "stones" },
                            { name: "Wood Gathered", value: "wood" },
                            { name: "Sulfur Ore", value: "sulfurOre" },
                            { name: "Metal Ore", value: "metalOre" },
                            // PvP categories
                            { name: "PvP Kills", value: "kills" },
                            { name: "Deaths", value: "deaths" },
                            { name: "K/D Ratio", value: "kdRatio" },
                            { name: "PvP Accuracy", value: "accuracy" },
                            // Time categories
                            { name: "Total Playtime", value: "totalLifetime" },
                            { name: "Wipe Playtime", value: "sinceWipe" },
                            { name: "AFK Time", value: "afkTime" }
                        )
                ),

            new SlashCommandBuilder()
                .setName("playerstats")
                .setDescription("View detailed statistics for a specific player")
                .addStringOption((option) =>
                    option
                        .setName("steamid")
                        .setDescription("Player's Steam ID (17 digits)")
                        .setRequired(true)
                        .setMinLength(17)
                        .setMaxLength(17)
                ),

            new SlashCommandBuilder()
                .setName("topplayers")
                .setDescription("View an overview of top players across different categories"),

            // NEW LEADERBOARD COMMANDS
            new SlashCommandBuilder()
                .setName("top3all")
                .setDescription("View top 3 players from each leaderboard category"),

            new SlashCommandBuilder()
                .setName("playerrank")
                .setDescription("View a player's ranking position across all leaderboard categories")
                .addStringOption((option) =>
                    option
                        .setName("steamid")
                        .setDescription("Player's Steam ID (17 digits)")
                        .setRequired(true)
                        .setMinLength(17)
                        .setMaxLength(17)
                ),

            new SlashCommandBuilder()
                .setName("findplayer")
                .setDescription("Search for a player by name and show their rankings")
                .addStringOption((option) =>
                    option
                        .setName("playername")
                        .setDescription("Player's name (partial matches allowed)")
                        .setRequired(true)
                        .setMinLength(2)
                        .setMaxLength(50)
                ),

            // Raid Curfew Commands
            new SlashCommandBuilder()
                .setName("curfew")
                .setDescription("Check if raiding is currently allowed or when it will be allowed again"),

            // Wipe Countdown Commands
            new SlashCommandBuilder()
                .setName("wipe")
                .setDescription("Check the countdown to the next server wipe"),

            new SlashCommandBuilder()
                .setName("send-wipe-announcement")
                .setDescription("Manually send the wipe countdown announcement (Admin only)"),

            // Playtime Giveaway Commands
            new SlashCommandBuilder()
                .setName("send-giveaway")
                .setDescription("Manually send the playtime giveaway message (Admin only)"),

            // Purge Command
            new SlashCommandBuilder()
                .setName("purge")
                .setDescription("Delete multiple messages from the current channel (Admin/Mod only)")
                .addIntegerOption((option) =>
                    option
                        .setName("amount")
                        .setDescription("Number of messages to delete (1-100)")
                        .setRequired(true)
                        .setMinValue(1)
                        .setMaxValue(100)
                ),

            // Ticket Commands
            new SlashCommandBuilder()
                .setName("setup-tickets")
                .setDescription("Setup the ticket creation message (Admin only)"),

            new SlashCommandBuilder()
                .setName("close-ticket")
                .setDescription("Close the current ticket"),

            new SlashCommandBuilder()
                .setName("add-user")
                .setDescription("Add a user to the current ticket")
                .addUserOption((option) =>
                    option
                        .setName("user")
                        .setDescription("User to add to the ticket")
                        .setRequired(true)
                ),

            new SlashCommandBuilder()
                .setName("remove-user")
                .setDescription("Remove a user from the current ticket")
                .addUserOption((option) =>
                    option
                        .setName("user")
                        .setDescription("User to remove from the ticket")
                        .setRequired(true)
                ),

            new SlashCommandBuilder()
                .setName("ticket-info")
                .setDescription("Get information about the current ticket"),

            // Rules Commands
            new SlashCommandBuilder()
                .setName("discordrules")
                .setDescription("Display the Discord server rules"),

            new SlashCommandBuilder()
                .setName("serverrules")
                .setDescription("Display the Rust server rules"),

            // Moderation Commands
            new SlashCommandBuilder()
                .setName("timeout")
                .setDescription("Timeout a user (Mod/Admin only)")
                .addUserOption((option) =>
                    option
                        .setName("user")
                        .setDescription("User to timeout")
                        .setRequired(true)
                )
                .addIntegerOption((option) =>
                    option
                        .setName("duration")
                        .setDescription("Timeout duration in minutes")
                        .setRequired(true)
                        .setMinValue(1)
                        .setMaxValue(10080) // 7 days max
                )
                .addStringOption((option) =>
                    option
                        .setName("reason")
                        .setDescription("Reason for the timeout")
                        .setRequired(false)
                ),

            new SlashCommandBuilder()
                .setName("remove-timeout")
                .setDescription("Remove timeout from a user (Mod/Admin only)")
                .addUserOption((option) =>
                    option
                        .setName("user")
                        .setDescription("User to remove timeout from")
                        .setRequired(true)
                ),

            new SlashCommandBuilder()
                .setName("kick")
                .setDescription("Kick a user from the server (Mod/Admin only)")
                .addUserOption((option) =>
                    option
                        .setName("user")
                        .setDescription("User to kick")
                        .setRequired(true)
                )
                .addStringOption((option) =>
                    option
                        .setName("reason")
                        .setDescription("Reason for the kick")
                        .setRequired(false)
                ),

            new SlashCommandBuilder()
                .setName("ban")
                .setDescription("Ban a user from the server (Admin only)")
                .addUserOption((option) =>
                    option
                        .setName("user")
                        .setDescription("User to ban")
                        .setRequired(true)
                )
                .addStringOption((option) =>
                    option
                        .setName("reason")
                        .setDescription("Reason for the ban")
                        .setRequired(false)
                )
                .addIntegerOption((option) =>
                    option
                        .setName("delete-messages")
                        .setDescription("Days of messages to delete (0-7)")
                        .setRequired(false)
                        .setMinValue(0)
                        .setMaxValue(7)
                ),

            new SlashCommandBuilder()
                .setName("unban")
                .setDescription("Unban a user from the server (Admin only)")
                .addStringOption((option) =>
                    option
                        .setName("user-id")
                        .setDescription("User ID to unban")
                        .setRequired(true)
                ),

            new SlashCommandBuilder()
                .setName("warn")
                .setDescription("Warn a user (Mod/Admin only)")
                .addUserOption((option) =>
                    option
                        .setName("user")
                        .setDescription("User to warn")
                        .setRequired(true)
                )
                .addStringOption((option) =>
                    option
                        .setName("reason")
                        .setDescription("Reason for the warning")
                        .setRequired(true)
                ),

            new SlashCommandBuilder()
                .setName("userinfo")
                .setDescription("Get information about a user (Mod/Admin only)")
                .addUserOption((option) =>
                    option
                        .setName("user")
                        .setDescription("User to get information about")
                        .setRequired(true)
                ),

            // Debug Commands
            new SlashCommandBuilder()
                .setName("debug-config")
                .setDescription("Debug bot configuration (Admin only)"),

            new SlashCommandBuilder()
                .setName("ping")
                .setDescription("Check bot's ping and status"),

            new SlashCommandBuilder()
                .setName("bot-status")
                .setDescription("Get detailed bot status information"),

            new SlashCommandBuilder()
                .setName("test-systems")
                .setDescription("Test all bot systems (Admin only)"),

            // Utility Commands
            new SlashCommandBuilder()
                .setName("server-info")
                .setDescription("Get information about the server"),

            // Team Management Commands (Updated - removed /team join)
            new SlashCommandBuilder()
                .setName("team")
                .setDescription("Team management commands")
                .addSubcommand(subcommand =>
                    subcommand
                        .setName("create")
                        .setDescription("Create a new team")
                        .addStringOption(option =>
                            option
                                .setName("name")
                                .setDescription("Team name (2-20 characters)")
                                .setRequired(true)
                                .setMinLength(2)
                                .setMaxLength(20)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName("leave")
                        .setDescription("Leave your current team")
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName("info")
                        .setDescription("View your team information")
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName("list")
                        .setDescription("List all active teams")
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName("invite")
                        .setDescription("Invite a user to your team (Leader only)")
                        .addUserOption(option =>
                            option
                                .setName("user")
                                .setDescription("User to invite to your team")
                                .setRequired(true)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName("kick")
                        .setDescription("Remove a member from your team (Leader only)")
                        .addUserOption(option =>
                            option
                                .setName("user")
                                .setDescription("User to remove from the team")
                                .setRequired(true)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName("transfer")
                        .setDescription("Transfer team leadership to another member (Leader only)")
                        .addUserOption(option =>
                            option
                                .setName("user")
                                .setDescription("User to transfer leadership to")
                                .setRequired(true)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName("disband")
                        .setDescription("Force disband a team (Admin only)")
                        .addStringOption(option =>
                            option
                                .setName("name")
                                .setDescription("Team name to disband")
                                .setRequired(true)
                        )
                ),

            new SlashCommandBuilder()
                .setName("help")
                .setDescription("Get help with bot commands")
                .addStringOption((option) =>
                    option
                        .setName("category")
                        .setDescription("Command category to get help for")
                        .setRequired(false)
                        .addChoices(
                            { name: "Moderation", value: "moderation" },
                            { name: "Tickets", value: "tickets" },
                            { name: "Rules", value: "rules" },
                            { name: "Curfew", value: "curfew" },
                            { name: "Giveaway", value: "giveaway" },
                            { name: "Debug", value: "debug" },
                            { name: "Teams", value: "team" },
                            { name: "Wipe", value: "wipe" },
                            { name: "Leaderboard", value: "leaderboard" }
                        )
                )
        ];
    }

    // Register slash commands
    async registerCommands() {
        try {
            const rest = new REST({ version: "10" }).setToken(this.config.token);

            console.log("🔄 Started refreshing application (/) commands.");
            console.log("🔍 Using Client ID:", this.config.clientId);
            console.log("🔍 Using Guild ID:", this.config.guildId);

            // Validate that we have the correct client ID
            if (!this.config.clientId || this.config.clientId === "your_bot_client_id_here") {
                throw new Error(
                    "CLIENT_ID is not properly configured. Please check your environment variables."
                );
            }

            // Try to get the application info to verify the client ID
            try {
                const app = await rest.get(Routes.oauth2CurrentApplication());
                console.log("✅ Application verified:", app.name, `(${app.id})`);

                if (app.id !== this.config.clientId) {
                    console.warn(
                        "⚠️ Warning: CLIENT_ID in config doesn't match the bot's actual application ID"
                    );
                    console.warn(`Expected: ${this.config.clientId}, Actual: ${app.id}`);
                    // Update the config with the correct client ID
                    this.config.clientId = app.id;
                }
            } catch (appError) {
                console.error("❌ Failed to verify application:", appError.message);
                throw appError;
            }

            // Register commands using the verified client ID
            await rest.put(
                Routes.applicationGuildCommands(this.config.clientId, this.config.guildId),
                {
                    body: this.commands,
                }
            );

            console.log("✅ Successfully reloaded application (/) commands.");
            console.log(`📊 Registered ${this.commands.length} commands total`);
        } catch (error) {
            console.error("❌ Error registering commands:", error);
            console.error("💡 Troubleshooting tips:");
            console.error("   1. Make sure CLIENT_ID matches your bot's Application ID");
            console.error("   2. Verify the bot token is correct");
            console.error("   3. Check that the bot is added to the server with 'applications.commands' scope");
            console.error("   4. Ensure the bot has 'Use Slash Commands' permission");

            // Don't throw the error, let the bot continue running without slash commands
            console.log("⚠️ Bot will continue running without slash commands. Fix the configuration and restart.");
            return false;
        }
        return true;
    }

    // Get commands by category - UPDATED
    getCommandsByCategory() {
        return {
            moderation: [
                "purge", "timeout", "remove-timeout", "kick", "ban", "unban", "warn", "userinfo"
            ],
            tickets: [
                "setup-tickets", "close-ticket", "add-user", "remove-user", "ticket-info"
            ],
            rules: [
                "discordrules", "serverrules"
            ],
            curfew: [
                "curfew"
            ],
            giveaway: [
                "send-giveaway"
            ],
            debug: [
                "debug-config", "ping", "bot-status", "test-systems"
            ],
            utility: [
                "server-info", "help"
            ],
            team: [
                "team"
            ],
            wipe: [
                "wipe", "send-wipe-announcement"
            ],
            leaderboard: [
                "leaderboard", "lb", "playerstats", "topplayers", "top3all", "playerrank", "findplayer"
            ]
        };
    }

    // Get command information
    getCommandInfo(commandName) {
        const command = this.commands.find(cmd => cmd.name === commandName);
        if (!command) return null;

        return {
            name: command.name,
            description: command.description,
            options: command.options || [],
            category: this.getCommandCategory(commandName)
        };
    }

    // Get command category
    getCommandCategory(commandName) {
        const categories = this.getCommandsByCategory();
        for (const [category, commands] of Object.entries(categories)) {
            if (commands.includes(commandName)) {
                return category;
            }
        }
        return "unknown";
    }
}

module.exports = CommandManager;