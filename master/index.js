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

                    // Bot configuration - Replit compatible
                    const config = {
                        token: process.env.DISCORD_TOKEN || process.env["DISCORD_TOKEN"] || "",
                        clientId: process.env.CLIENT_ID || process.env["CLIENT_ID"] || "",
                        guildId: process.env.GUILD_ID || process.env["GUILD_ID"] || "",

                        // Raid curfew config
                        generalChannelId:
                            process.env.GENERAL_CHANNEL_ID ||
                            process.env["GENERAL_CHANNEL_ID"] ||
                            "",

                        // Tickets config
                        ticketCategoryId:
                            process.env.TICKET_CATEGORY_ID ||
                            process.env["TICKET_CATEGORY_ID"] ||
                            "",
                        moderatorRoleId:
                            process.env.MODERATOR_ROLE_ID || process.env["MODERATOR_ROLE_ID"] || "",
                        ticketChannelId:
                            process.env.TICKET_CHANNEL_ID || process.env["TICKET_CHANNEL_ID"] || "",

                        // NEW: Welcome and moderation config
                        welcomeChannelId:
                            process.env.WELCOME_CHANNEL_ID || process.env["WELCOME_CHANNEL_ID"] || "",

                        // Role IDs
                        adminRoleId: "1370106309503877220",
                        modRoleId: "1370145215536562195",
                    };

                    // For Replit: Auto-detect CLIENT_ID from token if not provided
                    if (!config.clientId && config.token) {
                        try {
                            // Extract client ID from token (first part before first dot, base64 decoded)
                            const tokenPart = config.token.split(".")[0];
                            const decoded = Buffer.from(tokenPart, "base64").toString();
                            config.clientId = decoded;
                            console.log("🔍 Auto-detected CLIENT_ID from token:", config.clientId);
                        } catch (error) {
                            console.log("⚠️ Could not auto-detect CLIENT_ID from token");
                        }
                    }

                    // Initialize Discord client with additional intents for member events
                    const client = new Client({
                        intents: [
                            GatewayIntentBits.Guilds,
                            GatewayIntentBits.GuildMessages,
                            GatewayIntentBits.MessageContent,
                            GatewayIntentBits.GuildMembers, // Required for welcome messages
                        ],
                    });

                    // Ticket storage (IMPROVED WITH BETTER DEBUGGING)
                    const tickets = new Map();
                    let ticketCounter = loadTicketCounter();

                    // ================== NEW: WELCOME SYSTEM ==================

                    // Function to send welcome message
                    async function sendWelcomeMessage(member) {
                        try {
                            // If no welcome channel is configured, use the general channel
                            const welcomeChannelId = config.welcomeChannelId || config.generalChannelId;
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
                                    },
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

                    // ================== NEW: PURGE COMMAND FUNCTION ==================

                    async function handlePurgeCommand(interaction) {
                        try {
                            const { member, channel } = interaction;
                            const amount = interaction.options.getInteger("amount");

                            // Check permissions
                            const hasAdminRole = member.roles.cache.has(config.adminRoleId);
                            const hasModRole = member.roles.cache.has(config.modRoleId);
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
                                    { name: "👤 Requested by", value: `${member}`, inline: true },
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
                                    .setStyle(ButtonStyle.Secondary),
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

                    async function executePurge(interaction, amount) {
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
                                    { name: "👤 Purged by", value: `${interaction.user}`, inline: true },
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

                    // Load tickets from file on startup (IMPROVED DEBUGGING)
                    function loadTickets() {
                        try {
                            console.log("🔍 Attempting to load tickets from tickets.json...");

                            // Check if file exists first
                            if (!fs.existsSync("tickets.json")) {
                                console.log("📝 tickets.json doesn't exist, creating empty file");
                                saveTickets(); // Create empty file
                                return;
                            }

                            const data = fs.readFileSync("tickets.json", "utf8");
                            console.log("📄 Raw file content:", data);

                            if (!data.trim()) {
                                console.log("📝 tickets.json is empty, initializing...");
                                saveTickets();
                                return;
                            }

                            const ticketsData = JSON.parse(data);
                            console.log("🔍 Parsed tickets data:", ticketsData);

                            // Restore tickets to Map
                            let loadedCount = 0;
                            Object.entries(ticketsData).forEach(([channelId, ticketData]) => {
                                tickets.set(channelId, {
                                    ...ticketData,
                                    createdAt: new Date(ticketData.createdAt),
                                    closedAt: ticketData.closedAt ? new Date(ticketData.closedAt) : null
                                });
                                loadedCount++;
                                console.log(`✅ Loaded ticket for channel ${channelId}:`, ticketData);
                            });

                            console.log(`✅ Successfully loaded ${loadedCount} tickets from storage`);
                            console.log("📋 Current tickets in memory:", Array.from(tickets.keys()));
                        } catch (error) {
                            console.error("❌ Error loading tickets:", error);
                            console.log("📝 Creating fresh tickets file");
                            saveTickets(); // Create fresh file
                        }
                    }

                    // Save tickets to file (IMPROVED DEBUGGING)
                    function saveTickets() {
                        try {
                            const ticketsObj = {};
                            tickets.forEach((value, key) => {
                                ticketsObj[key] = value;
                            });

                            console.log("💾 Saving tickets to file:", ticketsObj);
                            fs.writeFileSync("tickets.json", JSON.stringify(ticketsObj, null, 2));
                            console.log("✅ Tickets saved successfully");
                        } catch (error) {
                            console.error("❌ Error saving tickets:", error);
                        }
                    }

                    // Load command files
                    function loadCommandFiles() {
                        const commandsPath = path.join(__dirname, "commands");
                        const discordRules = fs.readFileSync(
                            path.join(commandsPath, "discordrules.txt"),
                            "utf8",
                        );
                        const serverRules = fs.readFileSync(
                            path.join(commandsPath, "serverrules.txt"),
                            "utf8",
                        );

                        return {
                            discordRules,
                            serverRules,
                        };
                    }

                    // Load ticket counter from file (IMPROVED DEBUGGING)
                    function loadTicketCounter() {
                        try {
                            console.log("🔍 Loading ticket counter...");

                            if (!fs.existsSync("ticketCounter.json")) {
                                console.log("📝 ticketCounter.json doesn't exist, creating with counter 1");
                                const newCounter = 1;
                                fs.writeFileSync("ticketCounter.json", JSON.stringify({ counter: newCounter }, null, 2));
                                return newCounter;
                            }

                            const data = fs.readFileSync("ticketCounter.json", "utf8");
                            console.log("📄 Ticket counter file content:", data);

                            if (!data.trim()) {
                                console.log("📝 ticketCounter.json is empty, initializing with 1");
                                const newCounter = 1;
                                fs.writeFileSync("ticketCounter.json", JSON.stringify({ counter: newCounter }, null, 2));
                                return newCounter;
                            }

                            const parsed = JSON.parse(data);
                            const counter = parsed.counter || 1;
                            console.log("✅ Loaded ticket counter:", counter);
                            return counter;
                        } catch (error) {
                            console.error("❌ Error loading ticket counter:", error);
                            console.log("📝 Creating fresh counter file with value 1");
                            const newCounter = 1;
                            fs.writeFileSync("ticketCounter.json", JSON.stringify({ counter: newCounter }, null, 2));
                            return newCounter;
                        }
                    }

                    // Save ticket counter to file (IMPROVED DEBUGGING)
                    function saveTicketCounter() {
                        try {
                            console.log("💾 Saving ticket counter:", ticketCounter);
                            fs.writeFileSync("ticketCounter.json", JSON.stringify({ counter: ticketCounter }, null, 2));
                            console.log("✅ Ticket counter saved successfully");
                        } catch (error) {
                            console.error("❌ Error saving ticket counter:", error);
                        }
                    }

                    // ================== RAID CURFEW FUNCTIONS ==================

                    // Function to get current GMT time
                    function getCurrentGMT() {
                        const now = new Date();
                        return new Date(now.getTime() + 1 * 60 * 60 * 1000);
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

                    // ================== PLAYTIME GIVEAWAY FUNCTIONS ==================

                    // Function to send playtime giveaway reminder
                    async function sendPlaytimeGiveawayMessage() {
                        try {
                            const channel = await client.channels.fetch(config.generalChannelId);

                            const embed = new EmbedBuilder()
                                .setColor("#FFD700") // Gold color
                                .setTitle("🎁 UnitedRust - Playtime Giveaway!")
                                .setDescription(
                                    "**Think you've got the grind in you?**\n\nWe're rewarding the **Top 3 players** with the most **Active Playtime** (AFK excluded!) with some juicy rewards!",
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
                                    },
                                )
                                .setThumbnail(
                                    "https://via.placeholder.com/128x128/FFD700/000000?text=🎁",
                                )
                                .setTimestamp()
                                .setFooter({ text: "UnitedRust - Active Playtime Counts!" });

                            await channel.send({ embeds: [embed] });
                            console.log("✅ Playtime giveaway message sent successfully");
                        } catch (error) {
                            console.error("❌ Error sending playtime giveaway message:", error);
                        }
                    }

                    // ================== TICKET FUNCTIONS (FIXED) ==================

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

                    // Create a new ticket (IMPROVED DEBUGGING)
                    async function createTicket(interaction, ticketType) {
                        try {
                            const { user, guild } = interaction;

                            console.log(`🎫 Creating ${ticketType} ticket for ${user.tag} (${user.id})`);

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

                            // Validate ticket category exists
                            const ticketCategory = guild.channels.cache.get(config.ticketCategoryId);
                            if (!ticketCategory) {
                                console.error(`❌ Ticket category not found: ${config.ticketCategoryId}`);
                                return interaction.editReply({
                                    content: `❌ Ticket system is misconfigured. Category not found. Please contact an administrator.\n\nDebug info: Category ID ${config.ticketCategoryId} not found.`,
                                });
                            }

                            console.log(`✅ Found ticket category: ${ticketCategory.name}`);

                            const ticketNumber = ticketCounter;
                            const prefix = ticketType === "staff" ? "staff-report" : "player-report";
                            const channelName = `${prefix}-${ticketNumber.toString().padStart(4, "0")}`;

                            console.log(`🏗️ Creating channel: ${channelName}`);

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
                                {
                                    id: guild.members.me.id,
                                    allow: [
                                        PermissionFlagsBits.ViewChannel,
                                        PermissionFlagsBits.SendMessages,
                                        PermissionFlagsBits.ReadMessageHistory,
                                        PermissionFlagsBits.ManageChannels,
                                    ],
                                },
                            ];

                            if (ticketType === "staff") {
                                // Staff reports: Admin only
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

                                // Add moderator role permissions
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

                            console.log(`✅ Created ticket channel: ${ticketChannel.name} (${ticketChannel.id})`);

                            // Store ticket data (IMPORTANT: Store immediately after channel creation)
                            const ticketData = {
                                id: ticketNumber,
                                channelId: ticketChannel.id,
                                userId: user.id,
                                type: ticketType,
                                createdAt: new Date(),
                                closed: false,
                            };

                            console.log(`💾 Storing ticket data:`, ticketData);
                            tickets.set(ticketChannel.id, ticketData);
                            console.log(`📋 Tickets after storing:`, Array.from(tickets.entries()));

                            ticketCounter = ticketCounter + 1;
                            saveTicketCounter();
                            saveTickets(); // Save tickets to file immediately

                            console.log(`💾 Stored ticket data for channel ${ticketChannel.id}:`, ticketData);

                            // Send welcome message with close button
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

                            console.log(`📩 ${ticketTypeText} #${ticketNumber} created successfully by ${user.tag} (${user.id})`);
                        } catch (error) {
                            console.error("❌ Error creating ticket:", error);
                            await interaction.editReply({
                                content: "❌ There was an error creating the ticket. Please try again or contact an administrator.",
                            });
                        }
                    }

                    // Close ticket functions (IMPROVED DEBUGGING)
                    async function closeTicket(interaction) {
                        const channelId = interaction.channel.id;
                        console.log(`🔍 Attempting to close ticket in channel: ${channelId}`);

                        // First check memory
                        let ticketData = tickets.get(channelId);
                        console.log(`📋 Ticket data from memory:`, ticketData);
                        console.log(`📋 All tickets in memory:`, Array.from(tickets.entries()));

                        if (!ticketData) {
                            console.log(`❌ No ticket data found in memory for channel ${channelId}`);
                            console.log(`🔄 Attempting to reload tickets from file...`);

                            // Try to reload tickets from file
                            loadTickets();
                            ticketData = tickets.get(channelId);
                            console.log(`📋 Ticket data after reload:`, ticketData);

                            if (!ticketData) {
                                console.log(`❌ Still no ticket data found after reload for channel ${channelId}`);

                                // Manual check - let's see if this channel is actually a ticket
                                const channelName = interaction.channel.name;
                                console.log(`📝 Channel name: ${channelName}`);

                                if (channelName.includes('player-report') || channelName.includes('staff-report')) {
                                    console.log(`🎫 Channel name suggests this IS a ticket channel`);
                                    console.log(`📁 Let me check the file system directly...`);

                                    // Let's read the file directly to see what's in it
                                    try {
                                        const fileContent = fs.readFileSync("tickets.json", "utf8");
                                        console.log(`📄 Direct file read result:`, fileContent);
                                    } catch (error) {
                                        console.log(`❌ Could not read tickets.json:`, error.message);
                                    }
                                }

                                return interaction.reply({
                                    content: `❌ This is not a valid ticket channel or the ticket data was lost.\n\n**Debug Info:**\n- Channel ID: ${channelId}\n- Channel Name: ${channelName}\n- Tickets in memory: ${tickets.size}\n- Available ticket IDs: ${Array.from(tickets.keys()).join(', ') || 'None'}\n\nPlease contact an administrator.`,
                                    ephemeral: true,
                                });
                            }

                            console.log(`✅ Found ticket data after reload:`, ticketData);
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
                            const channelId = interaction.channel.id;
                            let ticketData = tickets.get(channelId);

                            console.log(`🔒 Confirming close for ticket in channel: ${channelId}`);

                            // If not found in memory, try to reload from file
                            if (!ticketData) {
                                console.log(`❌ No ticket data found in memory, reloading...`);
                                loadTickets();
                                ticketData = tickets.get(channelId);
                            }

                            if (!ticketData) {
                                console.log(`❌ Still no ticket data found after reload`);
                                return interaction.update({
                                    content: "❌ This is not a valid ticket channel or ticket data was lost.",
                                    components: [],
                                });
                            }

                            console.log(`✅ Found ticket data for closing:`, ticketData);

                            // Update ticket data
                            ticketData.closed = true;
                            ticketData.closedAt = new Date();
                            ticketData.closedBy = interaction.user.id;

                            // Save updated ticket data
                            tickets.set(channelId, ticketData);
                            saveTickets();

                            console.log(`💾 Updated and saved ticket data:`, ticketData);

                            const ticketTypeText = ticketData.type === "staff" ? "Staff Report" : "Player Report";

                            const embed = new EmbedBuilder()
                                .setTitle("🔒 Ticket Closed")
                                .setDescription(
                                    `This ${ticketTypeText.toLowerCase()} has been closed by ${interaction.user}.\n\nChannel will be deleted in 10 seconds.`,
                                )
                                .setColor(0xff0000)
                                .setTimestamp();

                            await interaction.update({ embeds: [embed], components: [] });

                            console.log(`🔒 ${ticketTypeText} #${ticketData.id} closed by ${interaction.user.tag}`);

                            setTimeout(async () => {
                                try {
                                    console.log(`🗑️ Attempting to delete ticket channel ${channelId}`);
                                    await interaction.channel.delete();
                                    // Remove from memory after deletion
                                    tickets.delete(channelId);
                                    saveTickets();
                                    console.log(`🗑️ Successfully deleted ticket channel ${channelId}`);
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

                    // Debug configuration function
                    async function debugConfiguration(interaction) {
                        try {
                            const { guild } = interaction;

                            // Check all configured resources
                            const checks = [];

                            // Check ticket category
                            const ticketCategory = guild.channels.cache.get(
                                config.ticketCategoryId,
                            );
                            checks.push({
                                name: "🗂️ Ticket Category",
                                value: ticketCategory
                                    ? `✅ ${ticketCategory.name} (${ticketCategory.id})`
                                    : `❌ Not found (${config.ticketCategoryId})`,
                                inline: false,
                            });

                            // Check moderator role
                            const moderatorRole = guild.roles.cache.get(config.moderatorRoleId);
                            checks.push({
                                name: "👮 Moderator Role",
                                value: moderatorRole
                                    ? `✅ ${moderatorRole.name} (${moderatorRole.id})`
                                    : `❌ Not found (${config.moderatorRoleId})`,
                                inline: false,
                            });

                            // Check admin role
                            const adminRole = guild.roles.cache.get(config.adminRoleId);
                            checks.push({
                                name: "👑 Admin Role",
                                value: adminRole
                                    ? `✅ ${adminRole.name} (${adminRole.id})`
                                    : `❌ Not found (${config.adminRoleId})`,
                                inline: false,
                            });

                            // Check mod role
                            const modRole = guild.roles.cache.get(config.modRoleId);
                            checks.push({
                                name: "🛡️ Mod Role",
                                value: modRole
                                    ? `✅ ${modRole.name} (${modRole.id})`
                                    : `❌ Not found (${config.modRoleId})`,
                                inline: false,
                            });

                            // Check ticket channel
                            const ticketChannel = guild.channels.cache.get(config.ticketChannelId);
                            checks.push({
                                name: "🎫 Ticket Creation Channel",
                                value: ticketChannel
                                    ? `✅ ${ticketChannel.name} (${ticketChannel.id})`
                                    : `❌ Not found (${config.ticketChannelId})`,
                                inline: false,
                            });

                            // Check general channel
                            const generalChannel = guild.channels.cache.get(
                                config.generalChannelId,
                            );
                            checks.push({
                                name: "📢 General Channel",
                                value: generalChannel
                                    ? `✅ ${generalChannel.name} (${generalChannel.id})`
                                    : `❌ Not found (${config.generalChannelId})`,
                                inline: false,
                            });

                            // Check welcome channel
                            const welcomeChannel = guild.channels.cache.get(
                                config.welcomeChannelId,
                            );
                            checks.push({
                                name: "👋 Welcome Channel",
                                value: welcomeChannel
                                    ? `✅ ${welcomeChannel.name} (${welcomeChannel.id})`
                                    : config.welcomeChannelId 
                                        ? `❌ Not found (${config.welcomeChannelId})`
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
                                .setDescription(
                                    "Checking all configured resources and permissions...",
                                )
                                .addFields(checks)
                                .addFields({
                                    name: "📊 Bot Status",
                                    value: `✅ Online as ${client.user.tag}\n🆔 Client ID: ${config.clientId}\n🏠 Guild: ${guild.name} (${guild.id})`,
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

                    // ================== COMMAND DEFINITIONS ==================

                    const commands = [
                        // Raid Curfew Commands
                        new SlashCommandBuilder()
                            .setName("curfew")
                            .setDescription(
                                "Check if raiding is currently allowed or when it will be allowed again",
                            ),

                        // Playtime Giveaway Commands
                        new SlashCommandBuilder()
                            .setName("send-giveaway")
                            .setDescription(
                                "Manually send the playtime giveaway message (Admin only)",
                            ),

                        // NEW: Purge Command
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

                        // Debug Command
                        new SlashCommandBuilder()
                            .setName("debug-config")
                            .setDescription("Debug bot configuration (Admin only)"),
                    ];

                    // Register slash commands
                    async function registerCommands() {
                        try {
                            const rest = new REST({ version: "10" }).setToken(config.token);

                            console.log("🔄 Started refreshing application (/) commands.");
                            console.log("🔍 Using Client ID:", config.clientId);
                            console.log("🔍 Using Guild ID:", config.guildId);

                            // Validate that we have the correct client ID
                            if (!config.clientId || config.clientId === "your_bot_client_id_here") {
                                throw new Error(
                                    "CLIENT_ID is not properly configured. Please check your environment variables.",
                                );
                            }

                            // Try to get the application info to verify the client ID
                            try {
                                const app = await rest.get(Routes.oauth2CurrentApplication());
                                console.log("✅ Application verified:", app.name, `(${app.id})`);

                                if (app.id !== config.clientId) {
                                    console.warn(
                                        "⚠️ Warning: CLIENT_ID in config doesn't match the bot's actual application ID",
                                    );
                                    console.warn(`Expected: ${config.clientId}, Actual: ${app.id}`);
                                    // Update the config with the correct client ID
                                    config.clientId = app.id;
                                }
                            } catch (appError) {
                                console.error("❌ Failed to verify application:", appError.message);
                                throw appError;
                            }

                            // Register commands using the verified client ID
                            await rest.put(
                                Routes.applicationGuildCommands(config.clientId, config.guildId),
                                {
                                    body: commands,
                                },
                            );

                            console.log("✅ Successfully reloaded application (/) commands.");
                        } catch (error) {
                            console.error("❌ Error registering commands:", error);
                            console.error("💡 Troubleshooting tips:");
                            console.error(
                                "   1. Make sure CLIENT_ID matches your bot's Application ID",
                            );
                            console.error("   2. Verify the bot token is correct");
                            console.error(
                                "   3. Check that the bot is added to the server with 'applications.commands' scope",
                            );
                            console.error(
                                "   4. Ensure the bot has 'Use Slash Commands' permission",
                            );

                            // Don't throw the error, let the bot continue running without slash commands
                            console.log(
                                "⚠️ Bot will continue running without slash commands. Fix the configuration and restart.",
                            );
                        }
                    }

                    // ================== EVENT HANDLERS ==================

                    // Bot ready event
                    client.once("ready", async () => {
                        console.log(`✅ ${client.user.tag} is online and ready!`);
                        console.log(`🎫 UnitedRust Combined Bot initialized`);

                        // Load existing tickets on startup
                        loadTickets();

                        console.log(`🔧 Next ticket number: ${ticketCounter}`);
                        console.log(`📋 Active tickets: ${Array.from(tickets.values()).filter(t => !t.closed).length}`);

                        // Auto-detect CLIENT_ID if not set
                        if (!config.clientId) {
                            config.clientId = client.application.id;
                            console.log(`🔍 Auto-detected CLIENT_ID: ${config.clientId}`);
                        }

                        // Register slash commands
                        await registerCommands();

                        // Schedule curfew reminders
                        cron.schedule(
                            "30 23 * * *",
                            () => {
                                console.log("⏰ Triggering curfew start reminder...");
                                sendCurfewStartReminder();
                            },
                            { timezone: "UTC" },
                        );

                        cron.schedule(
                            "30 6 * * *",
                            () => {
                                console.log("⏰ Triggering curfew end reminder...");
                                sendCurfewEndReminder();
                            },
                            { timezone: "UTC" },
                        );

                        // Schedule playtime giveaway message every 4 hours
                        cron.schedule(
                            "0 */4 * * *",
                            () => {
                                console.log("🎁 Triggering playtime giveaway message...");
                                sendPlaytimeGiveawayMessage();
                            },
                            { timezone: "UTC" },
                        );

                        console.log("🕒 Cron jobs scheduled successfully!");
                        console.log("- Curfew start reminder: 23:30 UTC (00:30 GMT) daily");
                        console.log("- Curfew end reminder: 06:30 UTC (07:30 GMT) daily");
                        console.log(
                            "- Playtime giveaway message: Every 4 hours (00:00, 04:00, 08:00, 12:00, 16:00, 20:00 UTC)",
                        );
                    });

                    // NEW: Member join event for welcome messages
                    client.on("guildMemberAdd", async (member) => {
                        console.log(`👋 New member joined: ${member.user.tag} (${member.id})`);
                        await sendWelcomeMessage(member);
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
                        } else if (customId.startsWith("purge_confirm_")) {
                            const amount = parseInt(customId.split("_")[2]);
                            await executePurge(interaction, amount);
                        } else if (customId === "purge_cancel") {
                            await interaction.update({
                                content: "❌ Purge cancelled.",
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
                                    const currentTimeGMT =
                                        gmtTime.toISOString().replace("T", " ").slice(0, 19) +
                                        " GMT";

                                    const curfewEmbed = new EmbedBuilder()
                                        .setColor(isRaidingAllowed() ? "#00FF00" : "#FF0000")
                                        .setTitle("🏴‍☠️ Raid Curfew Status")
                                        .setDescription(statusMessage)
                                        .addFields(
                                            {
                                                name: "🕐 Current Time (GMT)",
                                                value: currentTimeGMT,
                                                inline: true,
                                            },
                                            {
                                                name: "🚫 Curfew Hours",
                                                value: "00:00 GMT - 08:00 GMT",
                                                inline: true,
                                            },
                                        )
                                        .setTimestamp()
                                        .setFooter({ text: "UnitedRust Server" });

                                    await interaction.reply({ embeds: [curfewEmbed] });
                                    break;

                                case "send-giveaway":
                                    if (
                                        !member.permissions.has(PermissionFlagsBits.Administrator)
                                    ) {
                                        return interaction.reply({
                                            content:
                                                "❌ You need Administrator permissions to use this command.",
                                            ephemeral: true,
                                        });
                                    }
                                    await sendPlaytimeGiveawayMessage();
                                    await interaction.reply({
                                        content: "✅ Playtime giveaway message has been sent!",
                                        ephemeral: true,
                                    });
                                    break;

                                case "purge":
                                    await handlePurgeCommand(interaction);
                                    break;

                                case "setup-tickets":
                                    if (
                                        !member.permissions.has(PermissionFlagsBits.Administrator)
                                    ) {
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
                                    let ticketData = tickets.get(interaction.channel.id);

                                    // Try to reload if not found
                                    if (!ticketData) {
                                        loadTickets();
                                        ticketData = tickets.get(interaction.channel.id);
                                    }

                                    if (!ticketData) {
                                        return interaction.reply({
                                            content:
                                                "❌ This command can only be used in ticket channels.",
                                            ephemeral: true,
                                        });
                                    }

                                    let canClose = false;
                                    if (ticketData.type === "staff") {
                                        canClose =
                                            member.permissions.has(
                                                PermissionFlagsBits.Administrator,
                                            ) || ticketData.userId === interaction.user.id;
                                    } else {
                                        const hasModeratorRole = member.roles.cache.has(
                                            config.moderatorRoleId,
                                        );
                                        canClose =
                                            member.permissions.has(
                                                PermissionFlagsBits.Administrator,
                                            ) ||
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

                                case "discordrules":
                                    try {
                                        const commandFiles = loadCommandFiles();

                                        // First embed - Introduction and General Rules Part 1
                                        const generalRulesEmbed1 = new EmbedBuilder()
                                            .setTitle("📋 UnitedRust Discord Server Rules")
                                            .setColor(0x5865f2)
                                            .setDescription(
                                                "Please read and follow these rules to maintain a positive community environment.",
                                            )
                                            .addFields(
                                                {
                                                    name: "**1. Respect Staff**",
                                                    value: "Respect the staff team and their decisions, their word is final and if you have an issue put a ticket in.",
                                                    inline: false,
                                                },
                                                {
                                                    name: "**2. No Harmful Content**",
                                                    value: "Absolutely no: NSFW Content/Racism/Sexism/Discrimination/Bigotry/Doxxing and or Harassment. Be respectful towards members and remember banter is fine but be mindful that what you say may not be perceived as a joke by others.",
                                                    inline: false,
                                                },
                                                {
                                                    name: "**3. Use Appropriate Channels**",
                                                    value: "Utilise appropriate channels for your messages (eg: self promotion in the self promo channel)",
                                                    inline: false,
                                                },
                                            );

                                        // Second embed - General Rules Part 2
                                        const generalRulesEmbed2 = new EmbedBuilder()
                                            .setTitle("📋 Discord Rules (Continued)")
                                            .setColor(0x5865f2)
                                            .addFields(
                                                {
                                                    name: "**3a. Self-Promotion Guidelines**",
                                                    value: "In the self-promotion channel you may only link your content such as (Videos, Streams, Art etc). You may not upload malicious files into the channel, or post malicious links (IP-Loggers, screamers etc) or videos of you cheating blatantly. This is an instant ban.",
                                                    inline: false,
                                                },
                                                {
                                                    name: "**4. Language Filters**",
                                                    value: "Do not intentionally attempt to get around the language filters that we have set.",
                                                    inline: false,
                                                },
                                                {
                                                    name: "**5. Staff Mentions**",
                                                    value: "Mentioning @Admin / @OWNER for silly things will result in instant mute.",
                                                    inline: false,
                                                },
                                                {
                                                    name: "**6. No Drama**",
                                                    value: "Do NOT stir drama in chat/s with staff or other members of DC. Don't bring your in-ticket issues into chat if you are unhappy with the outcome. Don't type same thing, going in circles with staff. Do NOT be disrespectful to staff. If you have issue with staff contact Manager/s or Owner. Failure to do so will get you muted.",
                                                    inline: false,
                                                },
                                            );

                                        // Third embed - Voice Chat Rules
                                        const voiceRulesEmbed = new EmbedBuilder()
                                            .setTitle("🎤 Voice Chat Rules")
                                            .setColor(0x57f287)
                                            .addFields(
                                                {
                                                    name: "**1. No Mic Spam**",
                                                    value: "Keep your microphone usage respectful and avoid spamming.",
                                                    inline: false,
                                                },
                                                {
                                                    name: "**2. No Harmful Content**",
                                                    value: "Absolutely no: Racism/Sexism/Discrimination/Bigotry/Doxxing and or Harassment within the voice channels.",
                                                    inline: false,
                                                },
                                                {
                                                    name: "**3. No NSFW Streaming**",
                                                    value: "No Streaming NSFW Content or anything illegal.",
                                                    inline: false,
                                                },
                                            )
                                            .setFooter({
                                                text: "Remember: These rules help maintain a positive community environment for everyone. Violations will result in appropriate punishments ranging from warnings to permanent bans.",
                                            });

                                        // Send all embeds as separate messages
                                        await interaction.reply({ embeds: [generalRulesEmbed1] });
                                        await interaction.followUp({
                                            embeds: [generalRulesEmbed2],
                                        });
                                        await interaction.followUp({ embeds: [voiceRulesEmbed] });
                                    } catch (error) {
                                        console.error("❌ Error loading Discord rules:", error);
                                        await interaction.reply({
                                            content:
                                                "❌ Error loading Discord rules. Please contact an administrator.",
                                            ephemeral: true,
                                        });
                                    }
                                    break;

                                case "serverrules":
                                    try {
                                        const commandFiles = loadCommandFiles();

                                        // First embed - Introduction and Raid Policy
                                        const serverRulesEmbed1 = new EmbedBuilder()
                                            .setTitle("🎮 UnitedRust Server Rules")
                                            .setDescription(
                                                "**Play Fair. Play Hard. Zero Tolerance for Cheating**",
                                            )
                                            .setColor(0xe67e22)
                                            .addFields(
                                                {
                                                    name: "🕐 **RAID POLICY & OFFLINE PROTECTION**",
                                                    value: "**No-Raid Hours:** 00:00GMT - 08:00GMT\n\nStrictly enforced with active monitoring. No raiding, door camping, or aggressive PvP during these hours. Violations result in immediate punishment - no warnings given.\n\n**Exception:** Self-defense is permitted if you are attacked first.",
                                                    inline: false,
                                                },
                                                {
                                                    name: "🚫 **ANTI-CHEAT & EXPLOITS**",
                                                    value: "**Zero Tolerance Policy** - No cheats, hacks, scripts, macro programs, or automation tools. Game exploits and bug abuse are prohibited.\n\n**Punishment:** Instant permanent ban for player and entire team. No appeals for cheat bans.",
                                                    inline: false,
                                                },
                                            )
                                            .setTimestamp();

                                        // Second embed - Team Rules and Chat Rules
                                        const serverRulesEmbed2 = new EmbedBuilder()
                                            .setTitle("👥 Team & Communication Rules")
                                            .setColor(0x3498db)
                                            .addFields(
                                                {
                                                    name: "👥 **GROUP & TEAM REGULATIONS**",
                                                    value: "**Maximum:** 6 players per team, strictly enforced\n**No Alliances:** Cannot work with other teams\n**Team Changes:** One per wipe cycle only\n**Process:** Must open Discord ticket before switching\n**Cooldown:** 24-hour waiting period",
                                                    inline: false,
                                                },
                                                {
                                                    name: "💬 **CHAT RULES & COMMUNICATION**",
                                                    value: "**Global Chat:** English only, friendly banter encouraged\n**Strictly Forbidden:** Personal harassment, spam, racist/discriminatory language, trolling, doxxing\n**Team Chat:** Any language permitted, not monitored unless reported",
                                                    inline: false,
                                                },
                                            );

                                        // Third embed - Raiding Rules
                                        const serverRulesEmbed3 = new EmbedBuilder()
                                            .setTitle("⚔️ Raiding Rules & Guidelines")
                                            .setColor(0xf39c12)
                                            .addFields(
                                                {
                                                    name: "⚔️ **PERMITTED RAIDING**",
                                                    value: "**Timing:** Only between 08:01GMT and 23:59GMT\n**Team Composition:** Only raid with registered teammates\n**Time Limit:** Must complete within 4 hours maximum",
                                                    inline: false,
                                                },
                                                {
                                                    name: "🚫 **PROHIBITED BEHAVIORS**",
                                                    value: "**Base Blocking:** Cannot place external TCs to prevent expansion\n**Complete Sealing:** Cannot fully wall off bases\n**Base Takeovers:** Cannot claim someone else's active base\n**Grief Despawning:** Cannot destroy loot solely to deny it",
                                                    inline: false,
                                                },
                                                {
                                                    name: "📋 **RAID COMPLETION REQUIREMENTS**",
                                                    value: "All external TCs placed during raid must have locks removed or unlocked. Raided party must be able to access/remove external TCs after completion.",
                                                    inline: false,
                                                },
                                            );

                                        // Fourth embed - Account Requirements and Punishment
                                        const serverRulesEmbed4 = new EmbedBuilder()
                                            .setTitle("📋 Account & Punishment System")
                                            .setColor(0x9b59b6)
                                            .addFields(
                                                {
                                                    name: "📋 **ACCOUNT REQUIREMENTS**",
                                                    value: "**Steam Profile:** Must be public at all times\n**Ban History:** No VAC/game bans under 500 days\n**Rust Bans:** No more than 1 previous admin ban\n**VPNs:** Prohibited (contact staff for exceptions)",
                                                    inline: false,
                                                },
                                                {
                                                    name: "⚖️ **PUNISHMENT SYSTEM**",
                                                    value: "**First Offense:** 15-day temporary ban\n**Second Offense:** Permanent ban\n**Cheating/Exploiting:** Immediate permanent ban for entire team\n**Chat Violations:** Progressive muting system (1h → 24h → 7d ban → permanent)",
                                                    inline: false,
                                                },
                                            );

                                        // Fifth embed - Reporting and Final Information
                                        const serverRulesEmbed5 = new EmbedBuilder()
                                            .setTitle("🎯 Reporting & Support")
                                            .setColor(0x1abc9c)
                                            .addFields(
                                                {
                                                    name: "🎯 **REPORTING SYSTEM**",
                                                    value: "**In-Game:** Use `/report [playername] [reason]`\n**Discord:** Open support tickets for complex issues\n**Response Time:** Staff investigate within 24 hours\n**Evidence:** Screenshots/video help investigations",
                                                    inline: false,
                                                },
                                                {
                                                    name: "👮 **STAFF AUTHORITY**",
                                                    value: "All staff decisions are final. Use Discord tickets for concerns. Treat staff with respect - harassment results in escalated punishment.",
                                                    inline: false,
                                                },
                                                {
                                                    name: "👨‍👩‍👧‍👦 **TEAM ACCOUNTABILITY**",
                                                    value: "Teams are responsible for ALL members' actions. One rule breaker can result in entire team punishment. Choose teammates carefully!",
                                                    inline: false,
                                                },
                                            )
                                            .setFooter({
                                                text: "Ignorance of rules is not an excuse. Play fair, respect others, and enjoy! | Last Updated: May 25, 2025",
                                            });

                                        // Send all embeds as separate messages
                                        await interaction.reply({ embeds: [serverRulesEmbed1] });
                                        await interaction.followUp({ embeds: [serverRulesEmbed2] });
                                        await interaction.followUp({ embeds: [serverRulesEmbed3] });
                                        await interaction.followUp({ embeds: [serverRulesEmbed4] });
                                        await interaction.followUp({ embeds: [serverRulesEmbed5] });
                                    } catch (error) {
                                        console.error("❌ Error loading server rules:", error);
                                        await interaction.reply({
                                            content:
                                                "❌ Error loading server rules. Please contact an administrator.",
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

                                case "debug-config":
                                    if (
                                        !member.permissions.has(PermissionFlagsBits.Administrator)
                                    ) {
                                        return interaction.reply({
                                            content:
                                                "❌ You need Administrator permissions to use this command.",
                                            ephemeral: true,
                                        });
                                    }
                                    await debugConfiguration(interaction);
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
                        let ticketData = tickets.get(interaction.channel.id);

                        // Try to reload if not found
                        if (!ticketData) {
                            loadTickets();
                            ticketData = tickets.get(interaction.channel.id);
                        }

                        if (!ticketData) {
                            return interaction.reply({
                                content: "❌ This command can only be used in ticket channels.",
                                ephemeral: true,
                            });
                        }

                        const { member } = interaction;
                        let canManageUsers = false;

                        if (ticketData.type === "staff") {
                            canManageUsers = member.permissions.has(
                                PermissionFlagsBits.Administrator,
                            );
                        } else {
                            const hasModeratorRole = member.roles.cache.has(config.moderatorRoleId);
                            canManageUsers =
                                member.permissions.has(PermissionFlagsBits.Administrator) ||
                                hasModeratorRole;
                        }

                        if (!canManageUsers) {
                            const requiredPerms =
                                ticketData.type === "staff"
                                    ? "administrator permissions"
                                    : "admin/moderator permissions";
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
                                await interaction.reply({
                                    content: `✅ Added ${user} to this ticket.`,
                                });
                            } else {
                                await interaction.channel.permissionOverwrites.delete(user);
                                await interaction.reply({
                                    content: `✅ Removed ${user} from this ticket.`,
                                });
                            }
                        } catch (error) {
                            console.error(
                                `❌ Error ${action}ing user ${action === "add" ? "to" : "from"} ticket:`,
                                error,
                            );
                            await interaction.reply({
                                content: `❌ Failed to ${action} user ${action === "add" ? "to" : "from"} ticket.`,
                                ephemeral: true,
                            });
                        }
                    }

                    // Show ticket information
                    async function showTicketInfo(interaction) {
                        let ticketData = tickets.get(interaction.channel.id);

                        // Try to reload if not found
                        if (!ticketData) {
                            loadTickets();
                            ticketData = tickets.get(interaction.channel.id);
                        }

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

                    // ================== WEB SERVER FOR HEALTH CHECKS ==================

                    const express = require("express");
                    const app = express();
                    const port = process.env.PORT || 3000;

                    app.get("/", (req, res) => {
                        const uptime = process.uptime();
                        const hours = Math.floor(uptime / 3600);
                        const minutes = Math.floor((uptime % 3600) / 60);

                        res.json({
                            status: "UnitedRust Enhanced Bot is running!",
                            uptime: `${hours}h ${minutes}m`,
                            bot_status: client.user ? "Online" : "Connecting...",
                            guilds: client.guilds.cache.size,
                            tickets: tickets.size,
                            features: [
                                "Raid Curfew",
                                "Ticket System", 
                                "Rules Commands",
                                "Playtime Giveaway",
                                "Welcome Messages",
                                "Message Purge System",
                            ],
                            new_features: [
                                "Welcome system for new members",
                                "Advanced purge command with confirmation",
                            ],
                        });
                    });

                    app.get("/ping", (req, res) => {
                        res.send("Pong! Enhanced bot is alive.");
                    });

                    app.get("/health", (req, res) => {
                        res.json({
                            status: "healthy",
                            timestamp: new Date().toISOString(),
                            raid_status: isRaidingAllowed() ? "allowed" : "not_allowed",
                            next_ticket: ticketCounter,
                            welcome_system: "active",
                            purge_system: "active",
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

                    console.log("🚀 Starting UnitedRust Enhanced Discord Bot...");
                    console.log("🔐 Attempting to login to Discord...");
                    console.log("📋 Guild ID:", config.guildId);
                    console.log("🎯 Token configured:", config.token ? "✅" : "❌");
                    console.log("🆔 Client ID:", config.clientId);
                    console.log("👋 Welcome system: ENABLED");
                    console.log("🗑️ Purge system: ENABLED");

                    // Validate critical configuration
                    const criticalErrors = [];
                    if (!config.token || config.token === "your_bot_token_here") {
                        criticalErrors.push("DISCORD_TOKEN is not configured");
                    }
                    if (!config.clientId || config.clientId === "your_bot_client_id_here") {
                        criticalErrors.push("CLIENT_ID is not configured");
                    }
                    if (!config.guildId || config.guildId === "your_discord_server_id_here") {
                        criticalErrors.push("GUILD_ID is not configured");
                    }

                    if (criticalErrors.length > 0) {
                        console.error("❌ Critical configuration errors found:");
                        criticalErrors.forEach((error) => console.error(`   - ${error}`));
                        console.error(
                            "Please update your .env file or environment variables before starting the bot.",
                        );
                        process.exit(1);
                    }

                    // Login to Discord
                    client.login(config.token).catch((error) => {
                        console.error("❌ Failed to login to Discord:", error.message);

                        if (error.code === "TOKEN_INVALID") {
                            console.error(
                                "💡 The bot token is invalid. Please check your DISCORD_TOKEN in the .env file.",
                            );
                        }

                        process.exit(1);
                    });