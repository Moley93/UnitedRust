const {
    Client,
    GatewayIntentBits,
    PermissionFlagsBits,
    ChannelType,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    SlashCommandBuilder,
    REST,
    Routes,
} = require("discord.js");
const cron = require("node-cron");
const fs = require("fs");
const path = require("path");

// Bot configuration
const config = {
    token: process.env.DISCORD_TOKEN || '',
    clientId: process.env.CLIENT_ID || '',
    guildId: process.env.GUILD_ID || '',
    
    // Raid curfew config
    generalChannelId: process.env.GENERAL_CHANNEL_ID || '',
    
    // Tickets config
    ticketCategoryId: process.env.TICKET_CATEGORY_ID || '',
    moderatorRoleId: process.env.MODERATOR_ROLE_ID || '',
    ticketChannelId: process.env.TICKET_CHANNEL_ID || ''
};

// Validate configuration
const requiredConfig = ['token', 'clientId', 'guildId', 'generalChannelId', 'ticketCategoryId', 'moderatorRoleId', 'ticketChannelId'];
const missingConfig = requiredConfig.filter(key => !config[key]);

if (missingConfig.length > 0) {
    console.error(`❌ Missing required environment variables: ${missingConfig.join(', ')}`);
    console.error('Please set these in your environment or update the config object directly.');
    process.exit(1);
}

// Initialize Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ],
});

// Ticket storage (in production, use a database)
const tickets = new Map();
let ticketCounter = loadTicketCounter();

// Load command files
function loadCommandFiles() {
    const commandsPath = path.join(__dirname, 'commands');
    const discordRules = fs.readFileSync(path.join(commandsPath, 'discordrules.txt'), 'utf8');
    const serverRules = fs.readFileSync(path.join(commandsPath, 'serverrules.txt'), 'utf8');
    
    return {
        discordRules,
        serverRules
    };
}

// Load ticket counter from file
function loadTicketCounter() {
    try {
        const data = fs.readFileSync("ticketCounter.json", "utf8");
        return JSON.parse(data).counter || 1;
    } catch (error) {
        return 1;
    }
}

// Save ticket counter to file
function saveTicketCounter() {
    fs.writeFileSync(
        "ticketCounter.json",
        JSON.stringify({ counter: ticketCounter }),
    );
}

// ================== RAID CURFEW FUNCTIONS ==================

// Function to get current GMT time
function getCurrentGMT() {
    const now = new Date();
    return new Date(now.getTime() + (1 * 60 * 60 * 1000));
}

// Function to check if raiding is currently allowed
function isRaidingAllowed() {
    const gmtTime = getCurrentGMT();
    const gmtHour = gmtTime.getUTCHours();
    return gmtHour >= 8 && gmtHour < 24;
}

// Function to get time until raiding is allowed
function getTimeUntilRaidingAllowed() {
    const gmtTime = getCurrentGMT();
    const gmtHour = gmtTime.getUTCHours();
    const gmtMinute = gmtTime.getUTCMinutes();

    if (isRaidingAllowed()) {
        let hoursUntilCurfew = 24 - gmtHour;
        let minutesUntilCurfew = 60 - gmtMinute;
        
        if (minutesUntilCurfew === 60) {
            minutesUntilCurfew = 0;
        } else {
            hoursUntilCurfew--;
        }

        if (hoursUntilCurfew === 24) {
            hoursUntilCurfew = 0;
        }

        return `Raiding is currently **ALLOWED**! Next curfew starts in ${hoursUntilCurfew}h ${minutesUntilCurfew}m`;
    } else {
        let hoursUntilEnd = 8 - gmtHour;
        let minutesUntilEnd = 60 - gmtMinute;
        
        if (minutesUntilEnd === 60) {
            minutesUntilEnd = 0;
        } else {
            hoursUntilEnd--;
        }

        if (hoursUntilEnd < 0) {
            hoursUntilEnd += 24;
        }
        
        return `Raiding is currently **NOT ALLOWED**! Curfew ends in ${hoursUntilEnd}h ${minutesUntilEnd}m`;
    }
}

// Function to send curfew start reminder
async function sendCurfewStartReminder() {
    try {
        const channel = await client.channels.fetch(config.generalChannelId);

        const embed = new EmbedBuilder()
            .setColor("#FF0000")
            .setTitle("🚫 Raid Curfew Starting Soon!")
            .setDescription(
                "**Raid Curfew Reminder**\n\nRemember, we do not allow raiding between the hours of 00:00GMT and 08:00GMT. We actively monitor this and raiding during these times may result in an instant ban! We have implemented this rule for the good of the entire community.",
            )
            .addFields(
                {
                    name: "⏰ Time Until Curfew",
                    value: "30 minutes",
                    inline: true,
                },
                {
                    name: "🕐 Curfew Hours",
                    value: "00:00 GMT - 08:00 GMT",
                    inline: true,
                },
            )
            .setTimestamp()
            .setFooter({ text: "UnitedRust Server" });

        await channel.send({ embeds: [embed] });
        console.log("✅ Curfew start reminder sent successfully");
    } catch (error) {
        console.error("❌ Error sending curfew start reminder:", error);
    }
}

// Function to send curfew end reminder
async function sendCurfewEndReminder() {
    try {
        const channel = await client.channels.fetch(config.generalChannelId);

        const embed = new EmbedBuilder()
            .setColor("#00FF00")
            .setTitle("✅ Raid Curfew Ending Soon!")
            .setDescription(
                "**Curfew End Reminder**\n\nThe raid curfew will be ending in 30 minutes! You will be able to start raiding again soon.",
            )
            .addFields(
                {
                    name: "⏰ Time Until Raiding Allowed",
                    value: "30 minutes",
                    inline: true,
                },
                {
                    name: "🕐 Raiding Resumes At",
                    value: "08:00 GMT",
                    inline: true,
                },
            )
            .setTimestamp()
            .setFooter({ text: "UnitedRust Server" });

        await channel.send({ embeds: [embed] });
        console.log("✅ Curfew end reminder sent successfully");
    } catch (error) {
        console.error("❌ Error sending curfew end reminder:", error);
    }
}

// ================== TICKET FUNCTIONS ==================

// Setup ticket creation message
async function setupTicketCreationMessage() {
    try {
        const channel = client.channels.cache.get(config.ticketChannelId);
        if (!channel) {
            console.error("❌ Could not find channel with ID:", config.ticketChannelId);
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle("🎫 UnitedRust Reporting System")
            .setDescription(
                "Need to report a player or staff member? Select the appropriate option below!\n\n**Report Player:** Use this for reporting rule violations by players\n**Report Staff:** Use this if staff members are involved in your report\n\n**What to include in your report:**\n• Detailed description of the incident\n• Screenshots/evidence if available\n• Names of involved parties\n• Date and time of occurrence\n\n**Response Time:** We aim to respond within 24 hours.",
            )
            .setColor(0x2f3136)
            .setThumbnail("https://via.placeholder.com/100x100/7289DA/FFFFFF?text=UR")
            .setFooter({ text: "UnitedRust Reporting System" })
            .setTimestamp();

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("report_player")
                .setLabel("⚠️ Report Player")
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId("report_staff")
                .setLabel("🚨 Report Staff")
                .setStyle(ButtonStyle.Danger),
        );

        await channel.send({ embeds: [embed], components: [buttons] });
        console.log("✅ Ticket creation message sent successfully");
    } catch (error) {
        console.error("❌ Error setting up ticket creation message:", error);
    }
}

// Create a new ticket
async function createTicket(interaction, ticketType) {
    try {
        const { user, guild } = interaction;

        // Check if user already has an open ticket
        const existingTicket = Array.from(tickets.values()).find(
            (t) => t.userId === user.id && !t.closed,
        );
        if (existingTicket) {
            return interaction.reply({
                content: `❌ You already have an open ticket: <#${existingTicket.channelId}>`,
                ephemeral: true,
            });
        }

        await interaction.deferReply({ ephemeral: true });

        const ticketNumber = ticketCounter;
        const prefix = ticketType === "staff" ? "staff-report" : "player-report";
        const channelName = `${prefix}-${ticketNumber.toString().padStart(4, "0")}`;

        // Set permissions based on ticket type
        let permissionOverwrites = [
            {
                id: guild.roles.everyone.id,
                deny: [PermissionFlagsBits.ViewChannel],
            },
            {
                id: user.id,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory,
                ],
            },
        ];

        if (ticketType === "staff") {
            const adminRole = guild.roles.cache.find((role) =>
                role.permissions.has(PermissionFlagsBits.Administrator),
            );
            if (adminRole) {
                permissionOverwrites.push({
                    id: adminRole.id,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory,
                        PermissionFlagsBits.ManageChannels,
                    ],
                });
            }
        } else {
            const adminRole = guild.roles.cache.find((role) =>
                role.permissions.has(PermissionFlagsBits.Administrator),
            );
            if (adminRole) {
                permissionOverwrites.push({
                    id: adminRole.id,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory,
                        PermissionFlagsBits.ManageChannels,
                    ],
                });
            }

            permissionOverwrites.push({
                id: config.moderatorRoleId,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory,
                    PermissionFlagsBits.ManageChannels,
                ],
            });
        }

        // Create ticket channel
        const ticketChannel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: config.ticketCategoryId,
            permissionOverwrites: permissionOverwrites,
        });

        // Store ticket data
        const ticketData = {
            id: ticketNumber,
            channelId: ticketChannel.id,
            userId: user.id,
            type: ticketType,
            createdAt: new Date(),
            closed: false,
        };

        tickets.set(ticketChannel.id, ticketData);
        ticketCounter = ticketCounter + 1;
        saveTicketCounter();

        // Send welcome message
        const ticketTypeText = ticketType === "staff" ? "Staff Report" : "Player Report";
        const ticketEmoji = ticketType === "staff" ? "🚨" : "⚠️";
        const ticketColor = ticketType === "staff" ? 0xff4500 : 0x00ff00;

        let pingText = `${user}`;
        let descriptionText = "";

        if (ticketType === "staff") {
            pingText += " | Admins will be notified";
            descriptionText = `Hello ${user}! Thank you for creating a **staff report**.\n\n**Please provide detailed information about:**\n• Which staff member(s) are involved\n• What happened (with evidence if possible)\n• When this occurred\n\nThis ticket is **admin-only** for confidentiality.`;
        } else {
            pingText += ` | <@&${config.moderatorRoleId}>`;
            descriptionText = `Hello ${user}! Thank you for creating a **player report**.\n\n**Please provide detailed information about:**\n• Which player(s) you're reporting\n• What rule(s) were broken\n• Evidence (screenshots, etc.)\n• When this occurred\n\nA member of our moderation team will be with you shortly.`;
        }

        const welcomeEmbed = new EmbedBuilder()
            .setTitle(`${ticketEmoji} ${ticketTypeText} #${ticketNumber.toString().padStart(4, "0")}`)
            .setDescription(descriptionText)
            .setColor(ticketColor)
            .addFields(
                { name: "👤 Created by", value: user.toString(), inline: true },
                { name: "📅 Created at", value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
                { name: "📋 Type", value: ticketTypeText, inline: true },
            )
            .setFooter({ text: "UnitedRust Reporting System" });

        const closeButton = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("close_ticket")
                .setLabel("🔒 Close Ticket")
                .setStyle(ButtonStyle.Danger),
        );

        await ticketChannel.send({
            content: pingText,
            embeds: [welcomeEmbed],
            components: [closeButton],
        });

        await interaction.editReply({
            content: `✅ ${ticketTypeText} created successfully! Check it out: ${ticketChannel}`,
        });

        console.log(`📩 ${ticketTypeText} #${ticketNumber} created by ${user.tag} (${user.id})`);
    } catch (error) {
        console.error("❌ Error creating ticket:", error);
        await interaction.editReply({
            content: "❌ There was an error creating your ticket. Please try again later.",
        });
    }
}

// Close ticket functions
async function closeTicket(interaction) {
    const ticketData = tickets.get(interaction.channel.id);

    if (!ticketData) {
        return interaction.reply({
            content: "❌ This is not a valid ticket channel.",
            ephemeral: true,
        });
    }

    const embed = new EmbedBuilder()
        .setTitle("🔒 Close Ticket")
        .setDescription("Are you sure you want to close this ticket? This action cannot be undone.")
        .setColor(0xff0000);

    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("confirm_close")
            .setLabel("✅ Confirm")
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId("cancel_close")
            .setLabel("❌ Cancel")
            .setStyle(ButtonStyle.Secondary),
    );

    await interaction.reply({ embeds: [embed], components: [buttons] });
}

async function confirmCloseTicket(interaction) {
    try {
        const ticketData = tickets.get(interaction.channel.id);

        if (!ticketData) {
            return interaction.update({
                content: "❌ This is not a valid ticket channel.",
                components: [],
            });
        }

        ticketData.closed = true;
        ticketData.closedAt = new Date();
        ticketData.closedBy = interaction.user.id;

        const ticketTypeText = ticketData.type === "staff" ? "Staff Report" : "Player Report";

        const embed = new EmbedBuilder()
            .setTitle("🔒 Ticket Closed")
            .setDescription(`This ${ticketTypeText.toLowerCase()} has been closed by ${interaction.user}.\n\nChannel will be deleted in 10 seconds.`)
            .setColor(0xff0000)
            .setTimestamp();

        await interaction.update({ embeds: [embed], components: [] });

        console.log(`🔒 ${ticketTypeText} #${ticketData.id} closed by ${interaction.user.tag}`);

        setTimeout(async () => {
            try {
                await interaction.channel.delete();
                tickets.delete(interaction.channel.id);
            } catch (error) {
                console.error("❌ Error deleting ticket channel:", error);
            }
        }, 10000);
    } catch (error) {
        console.error("❌ Error closing ticket:", error);
        await interaction.update({
            content: "❌ There was an error closing the ticket.",
            components: [],
        });
    }
}

// ================== COMMAND DEFINITIONS ==================

const commands = [
    // Raid Curfew Commands
    new SlashCommandBuilder()
        .setName("curfew")
        .setDescription("Check if raiding is currently allowed or when it will be allowed again"),

    // Ticket Commands
    new SlashCommandBuilder()
        .setName("setup-tickets")
        .setDescription("Setup the ticket creation message"),

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
                .setRequired(true),
        ),

    new SlashCommandBuilder()
        .setName("remove-user")
        .setDescription("Remove a user from the current ticket")
        .addUserOption((option) =>
            option
                .setName("user")
                .setDescription("User to remove from the ticket")
                .setRequired(true),
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
];

// Register slash commands
async function registerCommands() {
    try {
        const rest = new REST({ version: "10" }).setToken(config.token);

        console.log("🔄 Started refreshing application (/) commands.");

        await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), {
            body: commands,
        });

        console.log("✅ Successfully reloaded application (/) commands.");
    } catch (error) {
        console.error("❌ Error registering commands:", error);
    }
}

// ================== EVENT HANDLERS ==================

// Bot ready event
client.once("ready", async () => {
    console.log(`✅ ${client.user.tag} is online and ready!`);
    console.log(`🎫 UnitedRust Combined Bot initialized`);
    console.log(`🔧 Next ticket number: ${ticketCounter}`);

    // Register slash commands
    await registerCommands();

    // Schedule curfew reminders
    cron.schedule("30 23 * * *", () => {
        console.log("⏰ Triggering curfew start reminder...");
        sendCurfewStartReminder();
    }, { timezone: "UTC" });

    cron.schedule("30 6 * * *", () => {
        console.log("⏰ Triggering curfew end reminder...");
        sendCurfewEndReminder();
    }, { timezone: "UTC" });

    console.log("🕒 Cron jobs scheduled successfully!");
    console.log("- Curfew start reminder: 23:30 UTC (00:30 GMT) daily");
    console.log("- Curfew end reminder: 06:30 UTC (07:30 GMT) daily");
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

    if (customId === "report_player") {
        await createTicket(interaction, "player");
    } else if (customId === "report_staff") {
        await createTicket(interaction, "staff");
    } else if (customId === "close_ticket") {
        await closeTicket(interaction);
    } else if (customId === "confirm_close") {
        await confirmCloseTicket(interaction);
    } else if (customId === "cancel_close") {
        await interaction.update({
            content: "❌ Ticket closure cancelled.",
            components: [],
        });
    }
}

// Handle slash commands
async function handleSlashCommand(interaction) {
    const { commandName, member } = interaction;

    try {
        switch (commandName) {
            case "curfew":
                const statusMessage = getTimeUntilRaidingAllowed();
                const gmtTime = getCurrentGMT();
                const currentTimeGMT = gmtTime.toISOString().replace("T", " ").slice(0, 19) + " GMT";

                const curfewEmbed = new EmbedBuilder()
                    .setColor(isRaidingAllowed() ? "#00FF00" : "#FF0000")
                    .setTitle("🏴‍☠️ Raid Curfew Status")
                    .setDescription(statusMessage)
                    .addFields(
                        { name: "🕐 Current Time (GMT)", value: currentTimeGMT, inline: true },
                        { name: "🚫 Curfew Hours", value: "00:00 GMT - 08:00 GMT", inline: true },
                    )
                    .setTimestamp()
                    .setFooter({ text: "UnitedRust Server" });

                await interaction.reply({ embeds: [curfewEmbed] });
                break;

            case "setup-tickets":
                if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return interaction.reply({
                        content: "❌ You need Administrator permissions to use this command.",
                        ephemeral: true,
                    });
                }
                await setupTicketCreationMessage();
                await interaction.reply({
                    content: "✅ Ticket creation message has been set up!",
                    ephemeral: true,
                });
                break;

            case "close-ticket":
                const ticketData = tickets.get(interaction.channel.id);
                if (!ticketData) {
                    return interaction.reply({
                        content: "❌ This command can only be used in ticket channels.",
                        ephemeral: true,
                    });
                }

                let canClose = false;
                if (ticketData.type === "staff") {
                    canClose = member.permissions.has(PermissionFlagsBits.Administrator) || ticketData.userId === interaction.user.id;
                } else {
                    const hasModeratorRole = member.roles.cache.has(config.moderatorRoleId);
                    canClose = member.permissions.has(PermissionFlagsBits.Administrator) || hasModeratorRole || ticketData.userId === interaction.user.id;
                }

                if (!canClose) {
                    const requiredPerms = ticketData.type === "staff" ? "administrator permissions" : "admin/moderator permissions or be the ticket creator";
                    return interaction.reply({
                        content: `❌ You need ${requiredPerms} to close this ticket.`,
                        ephemeral: true,
                    });
                }
                await closeTicket(interaction);
                break;

            case "discordrules":
                try {
                    const commandFiles = loadCommandFiles();
                    const rulesContent = commandFiles.discordRules;
                    
                    // Parse the markdown content and create embeds
                    const lines = rulesContent.split('\n').filter(line => line.trim());
                    
                    const generalRulesEmbed = new EmbedBuilder()
                        .setTitle("📋 UnitedRust Discord Server Rules")
                        .setColor(0x5865F2)
                        .setDescription("Please read and follow these rules to maintain a positive community environment.")
                        .addFields(
                            { name: "**1. Respect Staff**", value: "Respect the staff team and their decisions, their word is final and if you have an issue put a ticket in.", inline: false },
                            { name: "**2. No Harmful Content**", value: "Absolutely no: NSFW Content/Racism/Sexism/Discrimination/Bigotry/Doxxing and or Harassment. Be respectful towards members and remember banter is fine but be mindful that what you say may not be perceived as a joke by others.", inline: false },
                            { name: "**3. Use Appropriate Channels**", value: "Utilise appropriate channels for your messages (eg: self promotion in the self promo channel)", inline: false },
                            { name: "**4. Language Filters**", value: "Do not intentionally attempt to get around the language filters that we have set.", inline: false },
                            { name: "**5. Staff Mentions**", value: "Mentioning @Admin / @OWNER for silly things will result in instant mute.", inline: false },
                            { name: "**6. No Drama**", value: "Do NOT stir drama in chat/s with staff or other members of DC. Don't bring your in-ticket issues into chat if you are unhappy with the outcome.", inline: false }
                        )
                        .setTimestamp();

                    const voiceRulesEmbed = new EmbedBuilder()
                        .setTitle("🎤 Voice Chat Rules")
                        .setColor(0x57F287)
                        .addFields(
                            { name: "**1. No Mic Spam**", value: "Keep your microphone usage respectful and avoid spamming.", inline: false },
                            { name: "**2. No Harmful Content**", value: "Absolutely no: Racism/Sexism/Discrimination/Bigotry/Doxxing and or Harassment within the voice channels.", inline: false },
                            { name: "**3. No NSFW Streaming**", value: "No Streaming NSFW Content or anything illegal.", inline: false }
                        )
                        .setFooter({ text: "Remember: These rules help maintain a positive community environment for everyone. Violations will result in appropriate punishments ranging from warnings to permanent bans." });

                    await interaction.reply({ embeds: [generalRulesEmbed, voiceRulesEmbed] });
                } catch (error) {
                    console.error("❌ Error loading Discord rules:", error);
                    await interaction.reply({
                        content: "❌ Error loading Discord rules. Please contact an administrator.",
                        ephemeral: true,
                    });
                }
                break;

            case "serverrules":
                try {
                    const commandFiles = loadCommandFiles();
                    const rulesContent = commandFiles.serverRules;
                    
                    // Create main rules embed
                    const mainRulesEmbed = new EmbedBuilder()
                        .setTitle("🎮 UnitedRust Server Rules")
                        .setDescription("**Play Fair. Play Hard. Zero Tolerance for Cheating**")
                        .setColor(0xE67E22)
                        .addFields(
                            { name: "🕐 **RAID POLICY & OFFLINE PROTECTION**", value: "**No-Raid Hours:** 00:00GMT - 08:00GMT\nStrictly enforced with active monitoring. No raiding, door camping, or aggressive PvP during these hours. Violations result in immediate punishment.", inline: false },
                            { name: "🚫 **ANTI-CHEAT & EXPLOITS**", value: "**Zero Tolerance Policy** - No cheats, hacks, scripts, macro programs, or automation tools. Game exploits and bug abuse are prohibited. Instant permanent ban for player and entire team.", inline: false },
                            { name: "👥 **GROUP & TEAM REGULATIONS**", value: "**Maximum:** 6 players per team, strictly enforced. No alliances between teams. One team change per wipe cycle only.", inline: false }
                        )
                        .setTimestamp();

                    const detailedRulesEmbed = new EmbedBuilder()
                        .setTitle("📋 Detailed Server Rules")
                        .setColor(0x3498DB)
                        .addFields(
                            { name: "💬 **CHAT RULES**", value: "English only in global chat. Friendly banter encouraged. Strictly forbidden: harassment, spam, racist/discriminatory language, trolling, doxxing.", inline: false },
                            { name: "⚔️ **RAIDING RULES**", value: "Only allowed 08:01GMT - 23:59GMT. Must complete raids within 4 hours. All external TCs must be unlocked after raids. No base blocking or complete sealing.", inline: false },
                            { name: "📋 **ACCOUNT REQUIREMENTS**", value: "Steam profile must be public. No VAC/game bans under 500 days. No more than 1 previous Rust admin ban. No VPNs allowed.", inline: false },
                            { name: "⚖️ **PUNISHMENT SYSTEM**", value: "**First Offense:** 15-day ban (rule violations)\n**Second Offense:** Permanent ban\n**Cheating:** Immediate permanent ban for entire team\n**Chat:** Progressive muting system", inline: false }
                        )
                        .setFooter({ text: "For full rules, visit our Discord. Last Updated: May 25, 2025" });

                    await interaction.reply({ embeds: [mainRulesEmbed, detailedRulesEmbed] });
                } catch (error) {
                    console.error("❌ Error loading server rules:", error);
                    await interaction.reply({
                        content: "❌ Error loading server rules. Please contact an administrator.",
                        ephemeral: true,
                    });
                }
                break;

            // Ticket management commands
            case "add-user":
                await handleTicketUserManagement(interaction, "add");
                break;

            case "remove-user":
                await handleTicketUserManagement(interaction, "remove");
                break;

            case "ticket-info":
                await showTicketInfo(interaction);
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

// Handle ticket user management (add/remove)
async function handleTicketUserManagement(interaction, action) {
    const ticketData = tickets.get(interaction.channel.id);
    if (!ticketData) {
        return interaction.reply({
            content: "❌ This command can only be used in ticket channels.",
            ephemeral: true,
        });
    }

    const { member } = interaction;
    let canManageUsers = false;

    if (ticketData.type === "staff") {
        canManageUsers = member.permissions.has(PermissionFlagsBits.Administrator);
    } else {
        const hasModeratorRole = member.roles.cache.has(config.moderatorRoleId);
        canManageUsers = member.permissions.has(PermissionFlagsBits.Administrator) || hasModeratorRole;
    }

    if (!canManageUsers) {
        const requiredPerms = ticketData.type === "staff" ? "administrator permissions" : "admin/moderator permissions";
        return interaction.reply({
            content: `❌ You need ${requiredPerms} to ${action} users ${action === "add" ? "to" : "from"} this ticket.`,
            ephemeral: true,
        });
    }

    const user = interaction.options.getUser("user");

    if (action === "remove" && user.id === ticketData.userId) {
        return interaction.reply({
            content: "❌ Cannot remove the ticket creator.",
            ephemeral: true,
        });
    }

    try {
        if (action === "add") {
            await interaction.channel.permissionOverwrites.create(user, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true,
            });
            await interaction.reply({ content: `✅ Added ${user} to this ticket.` });
        } else {
            await interaction.channel.permissionOverwrites.delete(user);
            await interaction.reply({ content: `✅ Removed ${user} from this ticket.` });
        }
    } catch (error) {
        console.error(`❌ Error ${action}ing user ${action === "add" ? "to" : "from"} ticket:`, error);
        await interaction.reply({
            content: `❌ Failed to ${action} user ${action === "add" ? "to" : "from"} ticket.`,
            ephemeral: true,
        });
    }
}

// Show ticket information
async function showTicketInfo(interaction) {
    const ticketData = tickets.get(interaction.channel.id);

    if (!ticketData) {
        return interaction.reply({
            content: "❌ This command can only be used in ticket channels.",
            ephemeral: true,
        });
    }

    try {
        const creator = await client.users.fetch(ticketData.userId);
        const ticketTypeText = ticketData.type === "staff" ? "Staff Report" : "Player Report";
        const ticketEmoji = ticketData.type === "staff" ? "🚨" : "⚠️";

        const embed = new EmbedBuilder()
            .setTitle(`${ticketEmoji} ${ticketTypeText} #${ticketData.id.toString().padStart(4, "0")} Information`)
            .addFields(
                { name: "👤 Created by", value: creator.toString(), inline: true },
                { name: "📅 Created at", value: `<t:${Math.floor(ticketData.createdAt.getTime() / 1000)}:F>`, inline: true },
                { name: "📊 Status", value: ticketData.closed ? "🔒 Closed" : "🔓 Open", inline: true },
                { name: "📋 Type", value: ticketTypeText, inline: true },
            )
            .setColor(ticketData.closed ? 0xff0000 : ticketData.type === "staff" ? 0xff4500 : 0x00ff00)
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
        console.error("❌ Error showing ticket info:", error);
        await interaction.reply({
            content: "❌ Error retrieving ticket information.",
            ephemeral: true,
        });
    }
}

// ================== WEB SERVER FOR HEALTH CHECKS ==================

const express = require("express");
const app = express();
const port = process.env.PORT || 3000;

app.get("/", (req, res) => {
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);

    res.json({
        status: "UnitedRust Combined Bot is running!",
        uptime: `${hours}h ${minutes}m`,
        bot_status: client.user ? "Online" : "Connecting...",
        guilds: client.guilds.cache.size,
        tickets: tickets.size,
        features: ["Raid Curfew", "Ticket System", "Rules Commands"]
    });
});

app.get("/ping", (req, res) => {
    res.send("Pong! Bot is alive.");
});

app.get("/health", (req, res) => {
    res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        raid_status: isRaidingAllowed() ? "allowed" : "not_allowed",
        next_ticket: ticketCounter
    });
});

app.listen(port, () => {
    console.log(`🌐 Web server running on port ${port}`);
});

// ================== ERROR HANDLING ==================

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

// ================== STARTUP ==================

console.log("🚀 Starting UnitedRust Combined Discord Bot...");
console.log("🔐 Attempting to login to Discord...");
console.log("📋 Guild ID:", config.guildId);
console.log("🎯 Token configured:", config.token ? "✅" : "❌");

// Login to Discord
client.login(config.token).catch((error) => {
    console.error("❌ Failed to login to Discord:", error.message);
    process.exit(1);
});