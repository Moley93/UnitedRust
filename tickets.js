// Ticket System for UnitedRust Discord Bot
const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ChannelType, 
    PermissionFlagsBits 
} = require("discord.js");
const fs = require("fs");

class TicketSystem {
    constructor(client, config) {
        this.client = client;
        this.config = config;
        this.tickets = new Map();
        this.ticketCounter = this.loadTicketCounter();
        this.loadTickets();
    }

    // Load tickets from file on startup
    loadTickets() {
        try {
            console.log("🔍 Attempting to load tickets from tickets.json...");

            if (!fs.existsSync("tickets.json")) {
                console.log("📝 tickets.json doesn't exist, creating empty file");
                this.saveTickets();
                return;
            }

            const data = fs.readFileSync("tickets.json", "utf8");
            console.log("📄 Raw file content:", data);

            if (!data.trim()) {
                console.log("📝 tickets.json is empty, initializing...");
                this.saveTickets();
                return;
            }

            const ticketsData = JSON.parse(data);
            console.log("🔍 Parsed tickets data:", ticketsData);

            let loadedCount = 0;
            Object.entries(ticketsData).forEach(([channelId, ticketData]) => {
                this.tickets.set(channelId, {
                    ...ticketData,
                    createdAt: new Date(ticketData.createdAt),
                    closedAt: ticketData.closedAt ? new Date(ticketData.closedAt) : null
                });
                loadedCount++;
                console.log(`✅ Loaded ticket for channel ${channelId}:`, ticketData);
            });

            console.log(`✅ Successfully loaded ${loadedCount} tickets from storage`);
            console.log("📋 Current tickets in memory:", Array.from(this.tickets.keys()));
        } catch (error) {
            console.error("❌ Error loading tickets:", error);
            console.log("📝 Creating fresh tickets file");
            this.saveTickets();
        }
    }

    // Save tickets to file
    saveTickets() {
        try {
            const ticketsObj = {};
            this.tickets.forEach((value, key) => {
                ticketsObj[key] = value;
            });

            console.log("💾 Saving tickets to file:", ticketsObj);
            fs.writeFileSync("tickets.json", JSON.stringify(ticketsObj, null, 2));
            console.log("✅ Tickets saved successfully");
        } catch (error) {
            console.error("❌ Error saving tickets:", error);
        }
    }

    // Load ticket counter from file
    loadTicketCounter() {
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

    // Save ticket counter to file
    saveTicketCounter() {
        try {
            console.log("💾 Saving ticket counter:", this.ticketCounter);
            fs.writeFileSync("ticketCounter.json", JSON.stringify({ counter: this.ticketCounter }, null, 2));
            console.log("✅ Ticket counter saved successfully");
        } catch (error) {
            console.error("❌ Error saving ticket counter:", error);
        }
    }

    // Setup ticket creation message
    async setupTicketCreationMessage() {
        try {
            const channel = this.client.channels.cache.get(this.config.ticketChannelId);
            if (!channel) {
                console.error("❌ Could not find channel with ID:", this.config.ticketChannelId);
                return;
            }

            const embed = new EmbedBuilder()
                .setTitle("🎫 UnitedRust Reporting System")
                .setDescription(
                    "Need to report a player or staff member? Select the appropriate option below!\n\n**Report Player:** Use this for reporting rule violations by players\n**Report Staff:** Use this if staff members are involved in your report\n\n**What to include in your report:**\n• Detailed description of the incident\n• Screenshots/evidence if available\n• Names of involved parties\n• Date and time of occurrence\n\n**Response Time:** We aim to respond within 24 hours."
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
                    .setStyle(ButtonStyle.Danger)
            );

            await channel.send({ embeds: [embed], components: [buttons] });
            console.log("✅ Ticket creation message sent successfully");
        } catch (error) {
            console.error("❌ Error setting up ticket creation message:", error);
        }
    }

    // Create a new ticket
    async createTicket(interaction, ticketType) {
        try {
            const { user, guild } = interaction;

            console.log(`🎫 Creating ${ticketType} ticket for ${user.tag} (${user.id})`);

            // Check if user already has an open ticket
            const existingTicket = Array.from(this.tickets.values()).find(
                (t) => t.userId === user.id && !t.closed
            );
            if (existingTicket) {
                return interaction.reply({
                    content: `❌ You already have an open ticket: <#${existingTicket.channelId}>`,
                    ephemeral: true,
                });
            }

            await interaction.deferReply({ ephemeral: true });

            // Validate ticket category exists
            const ticketCategory = guild.channels.cache.get(this.config.ticketCategoryId);
            if (!ticketCategory) {
                console.error(`❌ Ticket category not found: ${this.config.ticketCategoryId}`);
                return interaction.editReply({
                    content: `❌ Ticket system is misconfigured. Category not found. Please contact an administrator.\n\nDebug info: Category ID ${this.config.ticketCategoryId} not found.`,
                });
            }

            console.log(`✅ Found ticket category: ${ticketCategory.name}`);

            const ticketNumber = this.ticketCounter;
            const prefix = ticketType === "staff" ? "staff-report" : "player-report";
            const channelName = `${prefix}-${ticketNumber.toString().padStart(4, "0")}`;

            console.log(`🏗️ Creating channel: ${channelName}`);

            // Set base permissions for everyone, user, and bot
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

            // Add admin role permissions - using configured admin role IDs
            for (const adminRoleId of this.config.adminRoleIds) {
                const adminRole = guild.roles.cache.get(adminRoleId);
                if (adminRole) {
                    console.log(`✅ Found admin role: ${adminRole.name} (${adminRole.id})`);
                    permissionOverwrites.push({
                        id: adminRoleId,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory,
                            PermissionFlagsBits.ManageChannels,
                        ],
                    });
                } else {
                    console.warn(`⚠️ Admin role ID ${adminRoleId} not found in guild`);
                }
            }

            // For player reports, also add moderator role permissions
            if (ticketType === "player") {
                const moderatorRole = guild.roles.cache.get(this.config.moderatorRoleId);
                if (moderatorRole) {
                    console.log(`✅ Found moderator role: ${moderatorRole.name} (${moderatorRole.id})`);
                    permissionOverwrites.push({
                        id: this.config.moderatorRoleId,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory,
                            PermissionFlagsBits.ManageChannels,
                        ],
                    });
                } else {
                    console.warn(`⚠️ Moderator role ID ${this.config.moderatorRoleId} not found in guild`);
                }
            }

            console.log(`🔐 Permission overwrites configured:`, permissionOverwrites.length);

            // Create ticket channel
            const ticketChannel = await guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                parent: this.config.ticketCategoryId,
                permissionOverwrites: permissionOverwrites,
            });

            console.log(`✅ Created ticket channel: ${ticketChannel.name} (${ticketChannel.id})`);

            // Store ticket data
            const ticketData = {
                id: ticketNumber,
                channelId: ticketChannel.id,
                userId: user.id,
                type: ticketType,
                createdAt: new Date(),
                closed: false,
            };

            console.log(`💾 Storing ticket data:`, ticketData);
            this.tickets.set(ticketChannel.id, ticketData);
            console.log(`📋 Tickets after storing:`, Array.from(this.tickets.entries()));

            this.ticketCounter = this.ticketCounter + 1;
            this.saveTicketCounter();
            this.saveTickets();

            console.log(`💾 Stored ticket data for channel ${ticketChannel.id}:`, ticketData);

            // Send welcome message with close button
            const ticketTypeText = ticketType === "staff" ? "Staff Report" : "Player Report";
            const ticketEmoji = ticketType === "staff" ? "🚨" : "⚠️";
            const ticketColor = ticketType === "staff" ? 0xff4500 : 0x00ff00;

            let pingText = `${user}`;
            let descriptionText = "";

            if (ticketType === "staff") {
                // For staff reports, ping admin roles
                const adminMentions = this.config.adminRoleIds
                    .map(roleId => {
                        const role = guild.roles.cache.get(roleId);
                        return role ? `<@&${roleId}>` : null;
                    })
                    .filter(mention => mention !== null);
                
                if (adminMentions.length > 0) {
                    pingText += ` | ${adminMentions.join(' ')}`;
                } else {
                    pingText += " | Admins will be notified";
                }
                
                descriptionText = `Hello ${user}! Thank you for creating a **staff report**.\n\n**Please provide detailed information about:**\n• Which staff member(s) are involved\n• What happened (with evidence if possible)\n• When this occurred\n\nThis ticket is **admin-only** for confidentiality.`;
            } else {
                // For player reports, ping moderator role
                const moderatorRole = guild.roles.cache.get(this.config.moderatorRoleId);
                if (moderatorRole) {
                    pingText += ` | <@&${this.config.moderatorRoleId}>`;
                } else {
                    pingText += " | Moderators will be notified";
                }
                
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
                    { name: "📋 Type", value: ticketTypeText, inline: true }
                )
                .setFooter({ text: "UnitedRust Reporting System" });

            const closeButton = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("close_ticket")
                    .setLabel("🔒 Close Ticket")
                    .setStyle(ButtonStyle.Danger)
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
            console.error("❌ Error stack:", error.stack);
            await interaction.editReply({
                content: `❌ There was an error creating the ticket. Please try again or contact an administrator.\n\nError details: ${error.message}`,
            });
        }
    }

    // Close ticket functions
    async closeTicket(interaction) {
        const channelId = interaction.channel.id;
        console.log(`🔍 Attempting to close ticket in channel: ${channelId}`);

        let ticketData = this.tickets.get(channelId);
        console.log(`📋 Ticket data from memory:`, ticketData);
        console.log(`📋 All tickets in memory:`, Array.from(this.tickets.entries()));

        if (!ticketData) {
            console.log(`❌ No ticket data found in memory for channel ${channelId}`);
            console.log(`🔄 Attempting to reload tickets from file...`);

            this.loadTickets();
            ticketData = this.tickets.get(channelId);
            console.log(`📋 Ticket data after reload:`, ticketData);

            if (!ticketData) {
                console.log(`❌ Still no ticket data found after reload for channel ${channelId}`);

                const channelName = interaction.channel.name;
                console.log(`📝 Channel name: ${channelName}`);

                if (channelName.includes('player-report') || channelName.includes('staff-report')) {
                    console.log(`🎫 Channel name suggests this IS a ticket channel`);
                    console.log(`📁 Let me check the file system directly...`);

                    try {
                        const fileContent = fs.readFileSync("tickets.json", "utf8");
                        console.log(`📄 Direct file read result:`, fileContent);
                    } catch (error) {
                        console.log(`❌ Could not read tickets.json:`, error.message);
                    }
                }

                return interaction.reply({
                    content: `❌ This is not a valid ticket channel or the ticket data was lost.\n\n**Debug Info:**\n- Channel ID: ${channelId}\n- Channel Name: ${channelName}\n- Tickets in memory: ${this.tickets.size}\n- Available ticket IDs: ${Array.from(this.tickets.keys()).join(', ') || 'None'}\n\nPlease contact an administrator.`,
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
                .setStyle(ButtonStyle.Secondary)
        );

        await interaction.reply({ embeds: [embed], components: [buttons] });
    }

    async confirmCloseTicket(interaction) {
        try {
            const channelId = interaction.channel.id;
            let ticketData = this.tickets.get(channelId);

            console.log(`🔒 Confirming close for ticket in channel: ${channelId}`);

            if (!ticketData) {
                console.log(`❌ No ticket data found in memory, reloading...`);
                this.loadTickets();
                ticketData = this.tickets.get(channelId);
            }

            if (!ticketData) {
                console.log(`❌ Still no ticket data found after reload`);
                return interaction.update({
                    content: "❌ This is not a valid ticket channel or ticket data was lost.",
                    components: [],
                });
            }

            console.log(`✅ Found ticket data for closing:`, ticketData);

            ticketData.closed = true;
            ticketData.closedAt = new Date();
            ticketData.closedBy = interaction.user.id;

            this.tickets.set(channelId, ticketData);
            this.saveTickets();

            console.log(`💾 Updated and saved ticket data:`, ticketData);

            const ticketTypeText = ticketData.type === "staff" ? "Staff Report" : "Player Report";

            const embed = new EmbedBuilder()
                .setTitle("🔒 Ticket Closed")
                .setDescription(
                    `This ${ticketTypeText.toLowerCase()} has been closed by ${interaction.user}.\n\nChannel will be deleted in 10 seconds.`
                )
                .setColor(0xff0000)
                .setTimestamp();

            await interaction.update({ embeds: [embed], components: [] });

            console.log(`🔒 ${ticketTypeText} #${ticketData.id} closed by ${interaction.user.tag}`);

            setTimeout(async () => {
                try {
                    console.log(`🗑️ Attempting to delete ticket channel ${channelId}`);
                    await interaction.channel.delete();
                    this.tickets.delete(channelId);
                    this.saveTickets();
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

    // Handle ticket user management (add/remove)
    async handleTicketUserManagement(interaction, action) {
        let ticketData = this.tickets.get(interaction.channel.id);

        if (!ticketData) {
            this.loadTickets();
            ticketData = this.tickets.get(interaction.channel.id);
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
            canManageUsers = member.permissions.has(PermissionFlagsBits.Administrator);
        } else {
            const hasModeratorRole = member.roles.cache.has(this.config.moderatorRoleId);
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
            console.error(`❌ Error ${action}ing user ${action === "add" ? "to" : "from"} ticket:`, error);
            await interaction.reply({
                content: `❌ Failed to ${action} user ${action === "add" ? "to" : "from"} ticket.`,
                ephemeral: true,
            });
        }
    }

    // Show ticket information
    async showTicketInfo(interaction) {
        let ticketData = this.tickets.get(interaction.channel.id);

        if (!ticketData) {
            this.loadTickets();
            ticketData = this.tickets.get(interaction.channel.id);
        }

        if (!ticketData) {
            return interaction.reply({
                content: "❌ This command can only be used in ticket channels.",
                ephemeral: true,
            });
        }

        try {
            const creator = await this.client.users.fetch(ticketData.userId);
            const ticketTypeText = ticketData.type === "staff" ? "Staff Report" : "Player Report";
            const ticketEmoji = ticketData.type === "staff" ? "🚨" : "⚠️";

            const embed = new EmbedBuilder()
                .setTitle(`${ticketEmoji} ${ticketTypeText} #${ticketData.id.toString().padStart(4, "0")} Information`)
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
                    { name: "📋 Type", value: ticketTypeText, inline: true }
                )
                .setColor(
                    ticketData.closed ? 0xff0000 : ticketData.type === "staff" ? 0xff4500 : 0x00ff00
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

    // Handle close ticket command
    async handleCloseTicketCommand(interaction) {
        let ticketData = this.tickets.get(interaction.channel.id);

        if (!ticketData) {
            this.loadTickets();
            ticketData = this.tickets.get(interaction.channel.id);
        }

        if (!ticketData) {
            return interaction.reply({
                content: "❌ This command can only be used in ticket channels.",
                ephemeral: true,
            });
        }

        const { member } = interaction;
        let canClose = false;

        if (ticketData.type === "staff") {
            canClose = member.permissions.has(PermissionFlagsBits.Administrator) || ticketData.userId === interaction.user.id;
        } else {
            const hasModeratorRole = member.roles.cache.has(this.config.moderatorRoleId);
            canClose = member.permissions.has(PermissionFlagsBits.Administrator) || hasModeratorRole || ticketData.userId === interaction.user.id;
        }

        if (!canClose) {
            const requiredPerms = ticketData.type === "staff" ? "administrator permissions" : "admin/moderator permissions or be the ticket creator";
            return interaction.reply({
                content: `❌ You need ${requiredPerms} to close this ticket.`,
                ephemeral: true,
            });
        }

        await this.closeTicket(interaction);
    }

    // Get ticket statistics
    getTicketStats() {
        const totalTickets = this.tickets.size;
        const openTickets = Array.from(this.tickets.values()).filter(t => !t.closed).length;
        const closedTickets = totalTickets - openTickets;
        const playerReports = Array.from(this.tickets.values()).filter(t => t.type === "player").length;
        const staffReports = Array.from(this.tickets.values()).filter(t => t.type === "staff").length;

        return {
            total: totalTickets,
            open: openTickets,
            closed: closedTickets,
            playerReports,
            staffReports,
            nextTicketNumber: this.ticketCounter
        };
    }
}

module.exports = TicketSystem;