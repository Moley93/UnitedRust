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
} = require("discord.js");
const fs = require("fs");

// Bot configuration - Replace with your actual values
const config = {
    token: 'MTM3MDY3NzY5MDUwMzM5NzQxNg.GbJK5g.CRNDckaMh2sc0T_R5Cl0PjV-45xhv2Mb2ZvbLI',
    guildId: '1370105711131889775',
    ticketCategoryId: '1370686038137110528',
    moderatorRoleId: '1370106309503877220',
    ticketChannelId: '1370693740691324989'
};

// Validate configuration
if (
    !config.token ||
    !config.guildId ||
    !config.ticketCategoryId ||
    !config.moderatorRoleId ||
    !config.ticketChannelId
) {
    console.error(
        "❌ Missing required environment variables! Check your .env file.",
    );
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

// Bot ready event
client.once("ready", async () => {
    console.log(`✅ ${client.user.tag} is online and ready!`);
    console.log(`🎫 UnitedRustTickets system initialized`);
    console.log(`🔧 Next ticket number: ${ticketCounter}`);

    // Register slash commands
    await registerCommands();

    console.log(
        "ℹ️ Bot is ready! Use /setup-tickets command to create the ticket message.",
    );
});

// Register slash commands
async function registerCommands() {
    const commands = [
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
    ];

    try {
        const guild = client.guilds.cache.get(config.guildId);
        if (!guild) {
            console.error("❌ Could not find guild with ID:", config.guildId);
            return;
        }
        await guild.commands.set(commands);
        console.log("✅ Slash commands registered successfully");
    } catch (error) {
        console.error("❌ Error registering commands:", error);
    }
}

// Setup ticket creation message
async function setupTicketCreationMessage() {
    try {
        const channel = client.channels.cache.get(config.ticketChannelId);
        if (!channel) {
            console.error(
                "❌ Could not find channel with ID:",
                config.ticketChannelId,
            );
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle("🎫 UnitedRust Reporting System")
            .setDescription(
                "Need to report a player or staff member? Select the appropriate option below!\n\n**Report Player:** Use this for reporting rule violations by players\n**Report Staff:** Use this if staff members are involved in your report\n\n**What to include in your report:**\n• Detailed description of the incident\n• Screenshots/evidence if available\n• Names of involved parties\n• Date and time of occurrence\n\n**Response Time:** We aim to respond within 24 hours.",
            )
            .setColor(0x2f3136)
            .setThumbnail(
                "https://via.placeholder.com/100x100/7289DA/FFFFFF?text=UR",
            )
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
        const prefix =
            ticketType === "staff" ? "staff-report" : "player-report";
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
            // Staff reports: Admin only (no moderator or support role access)
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
            // Player reports: Include moderators and admins
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

        // Update counter and save
        ticketCounter = ticketCounter + 1;
        saveTicketCounter();

        // Welcome embed based on ticket type
        const ticketTypeText =
            ticketType === "staff" ? "Staff Report" : "Player Report";
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
            .setTitle(
                `${ticketEmoji} ${ticketTypeText} #${ticketNumber.toString().padStart(4, "0")}`,
            )
            .setDescription(descriptionText)
            .setColor(ticketColor)
            .addFields(
                { name: "👤 Created by", value: user.toString(), inline: true },
                {
                    name: "📅 Created at",
                    value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
                    inline: true,
                },
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

        console.log(
            `📩 ${ticketTypeText} #${ticketNumber} created by ${user.tag} (${user.id})`,
        );
    } catch (error) {
        console.error("❌ Error creating ticket:", error);
        await interaction.editReply({
            content:
                "❌ There was an error creating your ticket. Please try again later.",
        });
    }
}

// Close ticket
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
        .setDescription(
            "Are you sure you want to close this ticket? This action cannot be undone.",
        )
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

// Confirm close ticket
async function confirmCloseTicket(interaction) {
    try {
        const ticketData = tickets.get(interaction.channel.id);

        if (!ticketData) {
            return interaction.update({
                content: "❌ This is not a valid ticket channel.",
                components: [],
            });
        }

        // Mark as closed
        ticketData.closed = true;
        ticketData.closedAt = new Date();
        ticketData.closedBy = interaction.user.id;

        const ticketTypeText =
            ticketData.type === "staff" ? "Staff Report" : "Player Report";

        const embed = new EmbedBuilder()
            .setTitle("🔒 Ticket Closed")
            .setDescription(
                `This ${ticketTypeText.toLowerCase()} has been closed by ${interaction.user}.\n\nChannel will be deleted in 10 seconds.`,
            )
            .setColor(0xff0000)
            .setTimestamp();

        await interaction.update({ embeds: [embed], components: [] });

        console.log(
            `🔒 ${ticketTypeText} #${ticketData.id} closed by ${interaction.user.tag}`,
        );

        // Delete channel after 10 seconds
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

// Handle slash commands
async function handleSlashCommand(interaction) {
    const { commandName, member } = interaction;

    switch (commandName) {
        case "setup-tickets":
            // Check if user has Administrator permission
            if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({
                    content:
                        "❌ You need Administrator permissions to use this command.",
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
            // Check permissions based on ticket type
            const ticketData = tickets.get(interaction.channel.id);
            if (!ticketData) {
                return interaction.reply({
                    content:
                        "❌ This command can only be used in ticket channels.",
                    ephemeral: true,
                });
            }

            let canClose = false;

            if (ticketData.type === "staff") {
                // Staff reports: Only admins can close
                canClose =
                    member.permissions.has(PermissionFlagsBits.Administrator) ||
                    ticketData.userId === interaction.user.id;
            } else {
                // Player reports: Admin and moderators can close
                const hasModeratorRole = member.roles.cache.has(
                    config.moderatorRoleId,
                );
                canClose =
                    member.permissions.has(PermissionFlagsBits.Administrator) ||
                    hasModeratorRole ||
                    ticketData.userId === interaction.user.id;
            }

            if (!canClose) {
                const requiredPerms =
                    ticketData.type === "staff"
                        ? "administrator permissions"
                        : "admin/moderator permissions or be the ticket creator";
                return interaction.reply({
                    content: `❌ You need ${requiredPerms} to close this ticket.`,
                    ephemeral: true,
                });
            }
            await closeTicket(interaction);
            break;

        case "add-user":
            // Check permissions based on ticket type
            const ticketDataAdd = tickets.get(interaction.channel.id);
            if (!ticketDataAdd) {
                return interaction.reply({
                    content:
                        "❌ This command can only be used in ticket channels.",
                    ephemeral: true,
                });
            }

            let canAddUser = false;
            if (ticketDataAdd.type === "staff") {
                // Staff reports: Only admins can add users
                canAddUser = member.permissions.has(
                    PermissionFlagsBits.Administrator,
                );
            } else {
                // Player reports: Admin and moderators can add users
                const hasModeratorRole = member.roles.cache.has(
                    config.moderatorRoleId,
                );
                canAddUser =
                    member.permissions.has(PermissionFlagsBits.Administrator) ||
                    hasModeratorRole;
            }

            if (!canAddUser) {
                const requiredPerms =
                    ticketDataAdd.type === "staff"
                        ? "administrator permissions"
                        : "admin/moderator permissions";
                return interaction.reply({
                    content: `❌ You need ${requiredPerms} to add users to this ticket.`,
                    ephemeral: true,
                });
            }
            await addUserToTicket(interaction);
            break;

        case "remove-user":
            // Check permissions based on ticket type
            const ticketDataRemove = tickets.get(interaction.channel.id);
            if (!ticketDataRemove) {
                return interaction.reply({
                    content:
                        "❌ This command can only be used in ticket channels.",
                    ephemeral: true,
                });
            }

            let canRemoveUser = false;
            if (ticketDataRemove.type === "staff") {
                // Staff reports: Only admins can remove users
                canRemoveUser = member.permissions.has(
                    PermissionFlagsBits.Administrator,
                );
            } else {
                // Player reports: Admin and moderators can remove users
                const hasModeratorRole = member.roles.cache.has(
                    config.moderatorRoleId,
                );
                canRemoveUser =
                    member.permissions.has(PermissionFlagsBits.Administrator) ||
                    hasModeratorRole;
            }

            if (!canRemoveUser) {
                const requiredPerms =
                    ticketDataRemove.type === "staff"
                        ? "administrator permissions"
                        : "admin/moderator permissions";
                return interaction.reply({
                    content: `❌ You need ${requiredPerms} to remove users from this ticket.`,
                    ephemeral: true,
                });
            }
            await removeUserFromTicket(interaction);
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
}

// Add user to ticket
async function addUserToTicket(interaction) {
    const ticketData = tickets.get(interaction.channel.id);

    if (!ticketData) {
        return interaction.reply({
            content: "❌ This command can only be used in ticket channels.",
            ephemeral: true,
        });
    }

    const user = interaction.options.getUser("user");

    try {
        await interaction.channel.permissionOverwrites.create(user, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true,
        });

        await interaction.reply({
            content: `✅ Added ${user} to this ticket.`,
        });
    } catch (error) {
        console.error("❌ Error adding user to ticket:", error);
        await interaction.reply({
            content: "❌ Failed to add user to ticket.",
            ephemeral: true,
        });
    }
}

// Remove user from ticket
async function removeUserFromTicket(interaction) {
    const ticketData = tickets.get(interaction.channel.id);

    if (!ticketData) {
        return interaction.reply({
            content: "❌ This command can only be used in ticket channels.",
            ephemeral: true,
        });
    }

    const user = interaction.options.getUser("user");

    if (user.id === ticketData.userId) {
        return interaction.reply({
            content: "❌ Cannot remove the ticket creator.",
            ephemeral: true,
        });
    }

    try {
        await interaction.channel.permissionOverwrites.delete(user);
        await interaction.reply({
            content: `✅ Removed ${user} from this ticket.`,
        });
    } catch (error) {
        console.error("❌ Error removing user from ticket:", error);
        await interaction.reply({
            content: "❌ Failed to remove user from ticket.",
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
        const ticketTypeText =
            ticketData.type === "staff" ? "Staff Report" : "Player Report";
        const ticketEmoji = ticketData.type === "staff" ? "🚨" : "⚠️";

        const embed = new EmbedBuilder()
            .setTitle(
                `${ticketEmoji} ${ticketTypeText} #${ticketData.id.toString().padStart(4, "0")} Information`,
            )
            .addFields(
                {
                    name: "👤 Created by",
                    value: creator.toString(),
                    inline: true,
                },
                {
                    name: "📅 Created at",
                    value: `<t:${Math.floor(ticketData.createdAt.getTime() / 1000)}:F>`,
                    inline: true,
                },
                {
                    name: "📊 Status",
                    value: ticketData.closed ? "🔒 Closed" : "🔓 Open",
                    inline: true,
                },
                { name: "📋 Type", value: ticketTypeText, inline: true },
            )
            .setColor(
                ticketData.closed
                    ? 0xff0000
                    : ticketData.type === "staff"
                      ? 0xff4500
                      : 0x00ff00,
            )
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

// Keep alive for Replit
const express = require("express");
const app = express();
const port = 3000;

app.get("/", (req, res) => {
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);

    res.json({
        status: "UnitedRustTickets Bot is running!",
        uptime: `${hours}h ${minutes}m`,
        bot_status: client.user ? "Online" : "Connecting...",
        guilds: client.guilds.cache.size,
        tickets: tickets.size,
    });
});

app.get("/ping", (req, res) => {
    res.send("Pong! Bot is alive.");
});

app.listen(port, () => {
    console.log(`🌐 Web server running on port ${port}`);
    console.log(
        `🔗 Monitor this URL: https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`,
    );
});

// Error handling
client.on("error", console.error);

process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

// Debug: Log what we're trying to connect with
console.log("🔐 Attempting to login to Discord...");
console.log("📋 Guild ID:", config.guildId);
console.log(
    "🎯 Token starts with:",
    config.token ? config.token.substring(0, 10) + "..." : "MISSING",
);

// Login to Discord
client.login(config.token).catch((error) => {
    console.error("❌ Failed to login to Discord:", error.message);
    process.exit(1);
});
