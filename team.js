// Team Management System for UnitedRust Discord Bot
const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ChannelType, 
    PermissionFlagsBits 
} = require("discord.js");
const fs = require("fs");
const crypto = require("crypto");

class TeamManagementSystem {
    constructor(client, config) {
        this.client = client;
        this.config = config;
        this.teams = new Map();
        this.playerTeams = new Map(); // Maps userId to teamId
        this.teamVoiceChannels = new Map(); // Maps teamId to voice channel ID
        this.pendingInvites = new Map(); // Maps inviteId to invitation data
        this.maxTeamSize = 6; // Configurable max team size
        this.teamCategoryId = config.teamCategoryId || null; // Voice channel category for teams
        this.loadTeams();
        this.loadPendingInvites();
    }

    // Load teams from file
    loadTeams() {
        try {
            if (!fs.existsSync("teams.json")) {
                this.saveTeams();
                return;
            }

            const data = fs.readFileSync("teams.json", "utf8");
            if (!data.trim()) {
                this.saveTeams();
                return;
            }

            const teamsData = JSON.parse(data);
            
            // Load teams
            if (teamsData.teams) {
                Object.entries(teamsData.teams).forEach(([teamId, teamData]) => {
                    this.teams.set(teamId, {
                        ...teamData,
                        createdAt: new Date(teamData.createdAt),
                        lastActivity: teamData.lastActivity ? new Date(teamData.lastActivity) : new Date()
                    });
                });
            }

            // Load player-team mappings
            if (teamsData.playerTeams) {
                Object.entries(teamsData.playerTeams).forEach(([userId, teamId]) => {
                    this.playerTeams.set(userId, teamId);
                });
            }

            console.log(`✅ Loaded ${this.teams.size} teams and ${this.playerTeams.size} player mappings`);
        } catch (error) {
            console.error("❌ Error loading teams:", error);
            this.saveTeams();
        }
    }

    // Load pending invites from file
    loadPendingInvites() {
        try {
            if (!fs.existsSync("pending_invites.json")) {
                this.savePendingInvites();
                return;
            }

            const data = fs.readFileSync("pending_invites.json", "utf8");
            if (!data.trim()) {
                this.savePendingInvites();
                return;
            }

            const invitesData = JSON.parse(data);
            
            Object.entries(invitesData).forEach(([inviteId, inviteData]) => {
                this.pendingInvites.set(inviteId, {
                    ...inviteData,
                    createdAt: new Date(inviteData.createdAt),
                    expiresAt: new Date(inviteData.expiresAt)
                });
            });

            console.log(`✅ Loaded ${this.pendingInvites.size} pending invites`);
        } catch (error) {
            console.error("❌ Error loading pending invites:", error);
            this.savePendingInvites();
        }
    }

    // Save teams to file
    saveTeams() {
        try {
            const teamsObj = {};
            this.teams.forEach((value, key) => {
                teamsObj[key] = value;
            });

            const playerTeamsObj = {};
            this.playerTeams.forEach((value, key) => {
                playerTeamsObj[key] = value;
            });

            const data = {
                teams: teamsObj,
                playerTeams: playerTeamsObj,
                lastUpdated: new Date().toISOString()
            };

            fs.writeFileSync("teams.json", JSON.stringify(data, null, 2));
            console.log("✅ Teams saved successfully");
        } catch (error) {
            console.error("❌ Error saving teams:", error);
        }
    }

    // Save pending invites to file
    savePendingInvites() {
        try {
            const invitesObj = {};
            this.pendingInvites.forEach((value, key) => {
                invitesObj[key] = value;
            });

            fs.writeFileSync("pending_invites.json", JSON.stringify(invitesObj, null, 2));
            console.log("✅ Pending invites saved successfully");
        } catch (error) {
            console.error("❌ Error saving pending invites:", error);
        }
    }

    // Generate unique invite ID
    generateInviteId() {
        return crypto.randomBytes(16).toString('hex');
    }

    // Create a new team
    async handleCreateTeamCommand(interaction) {
        try {
            const { user, guild } = interaction;
            const teamName = interaction.options.getString("name");

            // Check if user is already in a team
            if (this.playerTeams.has(user.id)) {
                return interaction.reply({
                    content: "❌ You're already in a team! Use `/team leave` first if you want to create a new team.",
                    ephemeral: true,
                });
            }

            // Validate team name
            if (teamName.length < 2 || teamName.length > 20) {
                return interaction.reply({
                    content: "❌ Team name must be between 2 and 20 characters.",
                    ephemeral: true,
                });
            }

            // Check if team name already exists
            const existingTeam = Array.from(this.teams.values()).find(
                team => team.name.toLowerCase() === teamName.toLowerCase()
            );
            if (existingTeam) {
                return interaction.reply({
                    content: "❌ A team with that name already exists. Please choose a different name.",
                    ephemeral: true,
                });
            }

            // Generate unique team ID
            const teamId = `team_${Date.now()}_${user.id}`;

            // Create team data
            const teamData = {
                id: teamId,
                name: teamName,
                leader: user.id,
                members: [user.id],
                createdAt: new Date(),
                lastActivity: new Date(),
                stats: {
                    gamesPlayed: 0,
                    wins: 0,
                    totalKills: 0,
                    totalDeaths: 0
                },
                settings: {
                    publicStats: true
                }
            };

            // Store team and player mapping
            this.teams.set(teamId, teamData);
            this.playerTeams.set(user.id, teamId);
            this.saveTeams();

            // Create team voice channel if category is configured
            let voiceChannelMention = "";
            if (this.teamCategoryId) {
                try {
                    const voiceChannel = await this.createTeamVoiceChannel(guild, teamData);
                    if (voiceChannel) {
                        voiceChannelMention = `\n🔊 **Team Voice Channel:** ${voiceChannel}`;
                        this.teamVoiceChannels.set(teamId, voiceChannel.id);
                    }
                } catch (error) {
                    console.error("❌ Error creating team voice channel:", error);
                }
            }

            const embed = new EmbedBuilder()
                .setTitle("✅ Team Created Successfully!")
                .setColor(0x00ff00)
                .addFields(
                    { name: "👥 Team Name", value: teamName, inline: true },
                    { name: "👑 Team Leader", value: `${user}`, inline: true },
                    { name: "📊 Members", value: `1/${this.maxTeamSize}`, inline: true },
                    { name: "📅 Created", value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
                    { name: "🆔 Team ID", value: `\`${teamId}\``, inline: true },
                    { 
                        name: "📋 Next Steps", 
                        value: `• Use \`/team invite @user\` to invite friends to your team\n• Use \`/team info\` to manage your team\n• Invited users will receive a DM with accept/deny buttons${voiceChannelMention}`, 
                        inline: false 
                    }
                )
                .setThumbnail(user.displayAvatarURL({ dynamic: true }))
                .setTimestamp()
                .setFooter({ text: "UnitedRust Team Management" });

            await interaction.reply({ embeds: [embed] });

            console.log(`✅ Team "${teamName}" created by ${user.tag}`);
        } catch (error) {
            console.error("❌ Error creating team:", error);
            await interaction.reply({
                content: "❌ An error occurred while creating the team.",
                ephemeral: true,
            });
        }
    }

    // Direct invite a user to team (leader only)
    async handleInviteUserCommand(interaction) {
        try {
            const { user, guild } = interaction;
            const targetUser = interaction.options.getUser("user");
            const teamId = this.playerTeams.get(user.id);

            if (!teamId) {
                return interaction.reply({
                    content: "❌ You're not in any team.",
                    ephemeral: true,
                });
            }

            const team = this.teams.get(teamId);
            if (!team) {
                return interaction.reply({
                    content: "❌ Team data not found.",
                    ephemeral: true,
                });
            }

            // Check if user is team leader
            if (team.leader !== user.id) {
                return interaction.reply({
                    content: "❌ Only the team leader can invite users.",
                    ephemeral: true,
                });
            }

            // Check if target user is already in a team
            if (this.playerTeams.has(targetUser.id)) {
                const targetTeamId = this.playerTeams.get(targetUser.id);
                const targetTeam = this.teams.get(targetTeamId);
                return interaction.reply({
                    content: `❌ ${targetUser} is already in team "${targetTeam?.name || 'Unknown'}".`,
                    ephemeral: true,
                });
            }

            // Check if team is full
            if (team.members.length >= this.maxTeamSize) {
                return interaction.reply({
                    content: `❌ Your team is full (${this.maxTeamSize}/${this.maxTeamSize} members).`,
                    ephemeral: true,
                });
            }

            // Check if there's already a pending invite for this user to this team
            const existingInvite = Array.from(this.pendingInvites.values()).find(
                invite => invite.teamId === teamId && invite.targetUserId === targetUser.id && invite.status === 'pending'
            );
            
            if (existingInvite) {
                return interaction.reply({
                    content: `⚠️ ${targetUser} already has a pending invitation to your team.`,
                    ephemeral: true,
                });
            }

            // Create invitation
            const inviteId = this.generateInviteId();
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

            const inviteData = {
                id: inviteId,
                teamId: teamId,
                teamName: team.name,
                inviterId: user.id,
                inviterTag: user.tag,
                targetUserId: targetUser.id,
                targetUserTag: targetUser.tag,
                guildId: guild.id,
                status: 'pending',
                createdAt: new Date(),
                expiresAt: expiresAt
            };

            this.pendingInvites.set(inviteId, inviteData);
            this.savePendingInvites();

            // Send invitation DM to target user
            try {
                const inviteEmbed = new EmbedBuilder()
                    .setTitle("👥 Team Invitation!")
                    .setDescription(`You've been invited to join team **"${team.name}"** by ${user}.`)
                    .setColor(0x00ff00)
                    .addFields(
                        { name: "👥 Team Name", value: team.name, inline: true },
                        { name: "👑 Team Leader", value: `${user.tag}`, inline: true },
                        { name: "📊 Current Members", value: `${team.members.length}/${this.maxTeamSize}`, inline: true },
                        { name: "📅 Team Created", value: `<t:${Math.floor(team.createdAt.getTime() / 1000)}:R>`, inline: true },
                        { name: "⏰ Invitation Expires", value: `<t:${Math.floor(expiresAt.getTime() / 1000)}:R>`, inline: false }
                    )
                    .setThumbnail(user.displayAvatarURL({ dynamic: true }))
                    .setTimestamp()
                    .setFooter({ text: "UnitedRust Team Invitation" });

                const buttons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`accept_invite_${inviteId}`)
                        .setLabel("✅ Accept")
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`deny_invite_${inviteId}`)
                        .setLabel("❌ Deny")
                        .setStyle(ButtonStyle.Danger)
                );

                await targetUser.send({ embeds: [inviteEmbed], components: [buttons] });

                await interaction.reply({
                    content: `✅ Invitation sent to ${targetUser}! They have 24 hours to respond.`,
                    ephemeral: true,
                });

                console.log(`📧 Team invite sent to ${targetUser.tag} for team "${team.name}" by ${user.tag}`);
            } catch (error) {
                // Remove the pending invite if we couldn't send the DM
                this.pendingInvites.delete(inviteId);
                this.savePendingInvites();
                
                console.log("❌ Could not send DM to target user:", error.message);
                await interaction.reply({
                    content: `❌ Could not send invitation to ${targetUser}. They may have DMs disabled.`,
                    ephemeral: true,
                });
            }

        } catch (error) {
            console.error("❌ Error inviting user to team:", error);
            await interaction.reply({
                content: "❌ An error occurred while sending the invitation.",
                ephemeral: true,
            });
        }
    }

    // Handle invitation response buttons
    async handleInviteResponse(interaction, inviteId, response) {
        try {
            const invite = this.pendingInvites.get(inviteId);
            
            if (!invite) {
                return interaction.update({
                    content: "❌ This invitation has expired or is no longer valid.",
                    embeds: [],
                    components: []
                });
            }

            // Check if invitation has expired
            if (new Date() > invite.expiresAt) {
                this.pendingInvites.delete(inviteId);
                this.savePendingInvites();
                
                return interaction.update({
                    content: "❌ This invitation has expired.",
                    embeds: [],
                    components: []
                });
            }

            // Check if the user responding is the target user
            if (interaction.user.id !== invite.targetUserId) {
                return interaction.reply({
                    content: "❌ This invitation is not for you.",
                    ephemeral: true
                });
            }

            const team = this.teams.get(invite.teamId);
            if (!team) {
                this.pendingInvites.delete(inviteId);
                this.savePendingInvites();
                
                return interaction.update({
                    content: "❌ The team no longer exists.",
                    embeds: [],
                    components: []
                });
            }

            if (response === 'accept') {
                // Check if user is already in a team
                if (this.playerTeams.has(interaction.user.id)) {
                    const currentTeamId = this.playerTeams.get(interaction.user.id);
                    const currentTeam = this.teams.get(currentTeamId);
                    
                    this.pendingInvites.delete(inviteId);
                    this.savePendingInvites();
                    
                    return interaction.update({
                        content: `❌ You're already in team "${currentTeam?.name || 'Unknown'}". Leave your current team first.`,
                        embeds: [],
                        components: []
                    });
                }

                // Check if team is now full
                if (team.members.length >= this.maxTeamSize) {
                    this.pendingInvites.delete(inviteId);
                    this.savePendingInvites();
                    
                    return interaction.update({
                        content: `❌ Team "${team.name}" is now full.`,
                        embeds: [],
                        components: []
                    });
                }

                // Add user to team
                team.members.push(interaction.user.id);
                team.lastActivity = new Date();
                this.teams.set(team.id, team);
                this.playerTeams.set(interaction.user.id, team.id);

                // Update invitation status
                invite.status = 'accepted';
                invite.respondedAt = new Date();
                this.pendingInvites.set(inviteId, invite);
                
                this.saveTeams();
                this.savePendingInvites();

                // Update voice channel permissions if it exists
                const voiceChannelId = this.teamVoiceChannels.get(team.id);
                if (voiceChannelId) {
                    try {
                        const guild = this.client.guilds.cache.get(invite.guildId);
                        if (guild) {
                            const voiceChannel = guild.channels.cache.get(voiceChannelId);
                            if (voiceChannel) {
                                await voiceChannel.permissionOverwrites.create(interaction.user, {
                                    ViewChannel: true,
                                    Connect: true,
                                    Speak: true
                                });
                            }
                        }
                    } catch (error) {
                        console.error("❌ Error updating voice channel permissions:", error);
                    }
                }

                const acceptEmbed = new EmbedBuilder()
                    .setTitle("✅ Team Invitation Accepted!")
                    .setDescription(`You have successfully joined team **"${team.name}"**!`)
                    .setColor(0x00ff00)
                    .addFields(
                        { name: "👥 Team Name", value: team.name, inline: true },
                        { name: "📊 Team Size", value: `${team.members.length}/${this.maxTeamSize}`, inline: true }
                    )
                    .setTimestamp();

                await interaction.update({
                    embeds: [acceptEmbed],
                    components: []
                });

                // Notify team leader
                try {
                    const leader = await this.client.users.fetch(team.leader);
                    const leaderEmbed = new EmbedBuilder()
                        .setTitle("👥 Team Invitation Accepted!")
                        .setDescription(`${interaction.user} (${interaction.user.tag}) has joined your team "${team.name}".`)
                        .setColor(0x00ff00)
                        .addFields(
                            { name: "📊 Team Size", value: `${team.members.length}/${this.maxTeamSize}`, inline: true }
                        )
                        .setTimestamp();

                    await leader.send({ embeds: [leaderEmbed] });
                } catch (error) {
                    console.log("❌ Could not notify team leader:", error.message);
                }

                console.log(`✅ ${interaction.user.tag} accepted invitation to team "${team.name}"`);

            } else if (response === 'deny') {
                // Update invitation status
                invite.status = 'denied';
                invite.respondedAt = new Date();
                this.pendingInvites.set(inviteId, invite);
                this.savePendingInvites();

                const denyEmbed = new EmbedBuilder()
                    .setTitle("❌ Team Invitation Declined")
                    .setDescription(`You have declined the invitation to join team **"${team.name}"**.`)
                    .setColor(0xff0000)
                    .setTimestamp();

                await interaction.update({
                    embeds: [denyEmbed],
                    components: []
                });

                // Notify team leader
                try {
                    const leader = await this.client.users.fetch(team.leader);
                    const leaderEmbed = new EmbedBuilder()
                        .setTitle("❌ Team Invitation Declined")
                        .setDescription(`${interaction.user} (${interaction.user.tag}) has declined your invitation to join team "${team.name}".`)
                        .setColor(0xff0000)
                        .setTimestamp();

                    await leader.send({ embeds: [leaderEmbed] });
                } catch (error) {
                    console.log("❌ Could not notify team leader:", error.message);
                }

                console.log(`❌ ${interaction.user.tag} declined invitation to team "${team.name}"`);
            }

        } catch (error) {
            console.error("❌ Error handling invite response:", error);
            await interaction.update({
                content: "❌ An error occurred while processing your response.",
                embeds: [],
                components: []
            });
        }
    }

    // Leave current team
    async handleLeaveTeamCommand(interaction) {
        try {
            const { user, guild } = interaction;

            // Check if user is in a team
            const teamId = this.playerTeams.get(user.id);
            if (!teamId) {
                return interaction.reply({
                    content: "❌ You're not in any team.",
                    ephemeral: true,
                });
            }

            const team = this.teams.get(teamId);
            if (!team) {
                // Clean up orphaned mapping
                this.playerTeams.delete(user.id);
                this.saveTeams();
                return interaction.reply({
                    content: "❌ Team data not found. Your team membership has been cleared.",
                    ephemeral: true,
                });
            }

            // Confirm leave action
            const confirmEmbed = new EmbedBuilder()
                .setTitle("⚠️ Confirm Leave Team")
                .setDescription(`Are you sure you want to leave team "${team.name}"?`)
                .setColor(0xff9500)
                .addFields(
                    { name: "👥 Team Name", value: team.name, inline: true },
                    { name: "📊 Current Members", value: `${team.members.length}/${this.maxTeamSize}`, inline: true }
                );

            // Special warning if user is team leader
            if (team.leader === user.id) {
                confirmEmbed.addFields({
                    name: "⚠️ Leadership Warning",
                    value: "You are the team leader. Leaving will **disband the entire team** and remove all members!",
                    inline: false
                });
            }

            const buttons = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`confirm_leave_${teamId}`)
                    .setLabel("✅ Confirm Leave")
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId("cancel_leave")
                    .setLabel("❌ Cancel")
                    .setStyle(ButtonStyle.Secondary)
            );

            await interaction.reply({
                embeds: [confirmEmbed],
                components: [buttons],
                ephemeral: true,
            });

        } catch (error) {
            console.error("❌ Error in leave team command:", error);
            await interaction.reply({
                content: "❌ An error occurred while processing your request.",
                ephemeral: true,
            });
        }
    }

    // Handle leave team confirmation
    async handleLeaveTeamConfirmation(interaction, teamId) {
        try {
            const { user, guild } = interaction;
            const team = this.teams.get(teamId);

            if (!team) {
                return interaction.update({
                    content: "❌ Team not found.",
                    embeds: [],
                    components: [],
                });
            }

            let resultEmbed;

            if (team.leader === user.id) {
                // Leader is leaving - disband entire team
                const memberIds = [...team.members];
                
                // Remove all members from team mapping
                memberIds.forEach(memberId => {
                    this.playerTeams.delete(memberId);
                });

                // Cancel all pending invites for this team
                const teamInvites = Array.from(this.pendingInvites.entries()).filter(
                    ([_, invite]) => invite.teamId === teamId && invite.status === 'pending'
                );
                teamInvites.forEach(([inviteId, _]) => {
                    this.pendingInvites.delete(inviteId);
                });

                // Delete team voice channel if it exists
                const voiceChannelId = this.teamVoiceChannels.get(teamId);
                if (voiceChannelId) {
                    try {
                        const voiceChannel = guild.channels.cache.get(voiceChannelId);
                        if (voiceChannel) {
                            await voiceChannel.delete();
                        }
                        this.teamVoiceChannels.delete(teamId);
                    } catch (error) {
                        console.error("❌ Error deleting team voice channel:", error);
                    }
                }

                // Delete team
                this.teams.delete(teamId);

                resultEmbed = new EmbedBuilder()
                    .setTitle("🗑️ Team Disbanded")
                    .setDescription(`Team "${team.name}" has been disbanded because the leader left.`)
                    .setColor(0xff0000)
                    .addFields(
                        { name: "👥 Team Name", value: team.name, inline: true },
                        { name: "📊 Former Members", value: `${memberIds.length}`, inline: true }
                    )
                    .setTimestamp();

                // Notify all former members (except the leader)
                const notificationPromises = memberIds
                    .filter(memberId => memberId !== user.id)
                    .map(async (memberId) => {
                        try {
                            const member = await this.client.users.fetch(memberId);
                            const dmEmbed = new EmbedBuilder()
                                .setTitle("🗑️ Team Disbanded")
                                .setDescription(`Your team "${team.name}" has been disbanded because the team leader left.`)
                                .setColor(0xff0000)
                                .setTimestamp();

                            await member.send({ embeds: [dmEmbed] });
                        } catch (error) {
                            console.log(`❌ Could not notify member ${memberId}:`, error.message);
                        }
                    });

                await Promise.all(notificationPromises);

                console.log(`🗑️ Team "${team.name}" disbanded by leader ${user.tag}`);
            } else {
                // Regular member leaving
                team.members = team.members.filter(memberId => memberId !== user.id);
                team.lastActivity = new Date();
                this.teams.set(teamId, team);
                this.playerTeams.delete(user.id);

                // Remove voice channel permissions
                const voiceChannelId = this.teamVoiceChannels.get(teamId);
                if (voiceChannelId) {
                    try {
                        const voiceChannel = guild.channels.cache.get(voiceChannelId);
                        if (voiceChannel) {
                            await voiceChannel.permissionOverwrites.delete(user);
                        }
                    } catch (error) {
                        console.error("❌ Error removing voice channel permissions:", error);
                    }
                }

                resultEmbed = new EmbedBuilder()
                    .setTitle("✅ Left Team Successfully")
                    .setDescription(`You have left team "${team.name}".`)
                    .setColor(0x00ff00)
                    .addFields(
                        { name: "👥 Team Name", value: team.name, inline: true },
                        { name: "📊 Remaining Members", value: `${team.members.length}/${this.maxTeamSize}`, inline: true }
                    )
                    .setTimestamp();

                // Notify team leader
                try {
                    const leader = await this.client.users.fetch(team.leader);
                    const dmEmbed = new EmbedBuilder()
                        .setTitle("👥 Member Left Team")
                        .setDescription(`${user} (${user.tag}) has left your team "${team.name}".`)
                        .setColor(0xff9500)
                        .addFields(
                            { name: "📊 Team Size", value: `${team.members.length}/${this.maxTeamSize}`, inline: true }
                        )
                        .setTimestamp();

                    await leader.send({ embeds: [dmEmbed] });
                } catch (error) {
                    console.log("❌ Could not notify team leader:", error.message);
                }

                console.log(`✅ ${user.tag} left team "${team.name}"`);
            }

            this.saveTeams();
            this.savePendingInvites();

            await interaction.update({
                embeds: [resultEmbed],
                components: [],
            });

        } catch (error) {
            console.error("❌ Error confirming team leave:", error);
            await interaction.update({
                content: "❌ An error occurred while leaving the team.",
                embeds: [],
                components: [],
            });
        }
    }

    // List all teams
    async handleListTeamsCommand(interaction) {
        try {
            const teams = Array.from(this.teams.values())
                .filter(team => team.settings.publicStats)
                .sort((a, b) => b.members.length - a.members.length);

            if (teams.length === 0) {
                return interaction.reply({
                    content: "📋 No teams have been created yet. Use `/team create` to start the first team!",
                    ephemeral: true,
                });
            }

            const embed = new EmbedBuilder()
                .setTitle("👥 UnitedRust Teams")
                .setDescription(`**${teams.length} active teams** competing for dominance!`)
                .setColor(0x3498db)
                .setTimestamp()
                .setFooter({ text: "UnitedRust Team Management" });

            const teamList = await Promise.all(teams.slice(0, 15).map(async (team, index) => {
                let leaderTag = "Unknown";
                try {
                    const leader = await this.client.users.fetch(team.leader);
                    leaderTag = leader.tag;
                } catch (error) {
                    // Leader not found, keep as "Unknown"
                }

                const memberCount = `${team.members.length}/${this.maxTeamSize}`;
                const createdDate = `<t:${Math.floor(team.createdAt.getTime() / 1000)}:R>`;
                
                return `**${index + 1}.** ${team.name}\n` +
                       `└ 👑 ${leaderTag} | 👥 ${memberCount} | 📅 ${createdDate}`;
            }));

            embed.addFields({
                name: "📊 Team Rankings",
                value: teamList.join('\n\n'),
                inline: false
            });

            if (teams.length > 15) {
                embed.addFields({
                    name: "📋 Additional Info",
                    value: `Showing top 15 teams. ${teams.length - 15} more teams exist.`,
                    inline: false
                });
            }

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error("❌ Error listing teams:", error);
            await interaction.reply({
                content: "❌ An error occurred while listing teams.",
                ephemeral: true,
            });
        }
    }

    // Get team info for current user's team
    async handleTeamInfoCommand(interaction) {
        try {
            const { user } = interaction;
            const teamId = this.playerTeams.get(user.id);

            if (!teamId) {
                return interaction.reply({
                    content: "❌ You're not in any team. Use `/team create` or get invited to get started!",
                    ephemeral: true,
                });
            }

            const team = this.teams.get(teamId);
            if (!team) {
                this.playerTeams.delete(user.id);
                this.saveTeams();
                return interaction.reply({
                    content: "❌ Team data not found. Your team membership has been cleared.",
                    ephemeral: true,
                });
            }

            // Get member list with tags
            const memberList = await Promise.all(team.members.map(async (memberId, index) => {
                let memberTag = "Unknown User";
                let isLeader = memberId === team.leader;
                
                try {
                    const member = await this.client.users.fetch(memberId);
                    memberTag = member.tag;
                } catch (error) {
                    // Member not found, keep as "Unknown User"
                }

                return `${index + 1}. ${memberTag}${isLeader ? ' 👑' : ''}`;
            }));

            const embed = new EmbedBuilder()
                .setTitle(`👥 ${team.name}`)
                .setColor(0x3498db)
                .addFields(
                    { name: "📊 Members", value: `${team.members.length}/${this.maxTeamSize}`, inline: true },
                    { name: "📅 Created", value: `<t:${Math.floor(team.createdAt.getTime() / 1000)}:R>`, inline: true },
                    { name: "👥 Team Members", value: memberList.join('\n'), inline: false }
                )
                .setTimestamp()
                .setFooter({ text: "UnitedRust Team Management" });

            // Add voice channel info if it exists
            const voiceChannelId = this.teamVoiceChannels.get(teamId);
            if (voiceChannelId) {
                embed.addFields({
                    name: "🔊 Team Voice Channel",
                    value: `<#${voiceChannelId}>`,
                    inline: true
                });
            }

            // Add team stats if available
            if (team.stats.gamesPlayed > 0) {
                const winRate = ((team.stats.wins / team.stats.gamesPlayed) * 100).toFixed(1);
                const kdr = team.stats.totalDeaths > 0 ? (team.stats.totalKills / team.stats.totalDeaths).toFixed(2) : team.stats.totalKills.toString();
                
                embed.addFields({
                    name: "📊 Team Statistics",
                    value: `**Games:** ${team.stats.gamesPlayed} | **Wins:** ${team.stats.wins} (${winRate}%)\n**K/D Ratio:** ${kdr} (${team.stats.totalKills}/${team.stats.totalDeaths})`,
                    inline: false
                });
            }

            await interaction.reply({ 
                embeds: [embed], 
                ephemeral: true 
            });

        } catch (error) {
            console.error("❌ Error getting team info:", error);
            await interaction.reply({
                content: "❌ An error occurred while getting team information.",
                ephemeral: true,
            });
        }
    }

    // Kick a member from team (leader only)
    async handleKickMemberCommand(interaction) {
        try {
            const { user, guild } = interaction;
            const targetUser = interaction.options.getUser("user");
            const teamId = this.playerTeams.get(user.id);

            if (!teamId) {
                return interaction.reply({
                    content: "❌ You're not in any team.",
                    ephemeral: true,
                });
            }

            const team = this.teams.get(teamId);
            if (!team) {
                return interaction.reply({
                    content: "❌ Team data not found.",
                    ephemeral: true,
                });
            }

            // Check if user is team leader
            if (team.leader !== user.id) {
                return interaction.reply({
                    content: "❌ Only the team leader can kick members.",
                    ephemeral: true,
                });
            }

            // Check if target user is in the team
            if (!team.members.includes(targetUser.id)) {
                return interaction.reply({
                    content: `❌ ${targetUser} is not in your team.`,
                    ephemeral: true,
                });
            }

            // Prevent leader from kicking themselves
            if (targetUser.id === user.id) {
                return interaction.reply({
                    content: "❌ You cannot kick yourself. Use `/team leave` to leave the team.",
                    ephemeral: true,
                });
            }

            // Remove member from team
            team.members = team.members.filter(memberId => memberId !== targetUser.id);
            team.lastActivity = new Date();
            this.teams.set(teamId, team);
            this.playerTeams.delete(targetUser.id);
            this.saveTeams();

            // Remove voice channel permissions
            const voiceChannelId = this.teamVoiceChannels.get(teamId);
            if (voiceChannelId) {
                try {
                    const voiceChannel = guild.channels.cache.get(voiceChannelId);
                    if (voiceChannel) {
                        await voiceChannel.permissionOverwrites.delete(targetUser);
                    }
                } catch (error) {
                    console.error("❌ Error removing voice channel permissions:", error);
                }
            }

            // Notify kicked member
            try {
                const kickEmbed = new EmbedBuilder()
                    .setTitle("❌ Removed from Team")
                    .setDescription(`You have been removed from team "${team.name}" by the team leader.`)
                    .setColor(0xff0000)
                    .setTimestamp();

                await targetUser.send({ embeds: [kickEmbed] });
            } catch (error) {
                console.log("❌ Could not notify kicked member:", error.message);
            }

            await interaction.reply({
                content: `✅ ${targetUser} has been removed from team "${team.name}".`,
                ephemeral: true,
            });

            console.log(`👢 ${targetUser.tag} kicked from team "${team.name}" by ${user.tag}`);

        } catch (error) {
            console.error("❌ Error kicking team member:", error);
            await interaction.reply({
                content: "❌ An error occurred while kicking the member.",
                ephemeral: true,
            });
        }
    }

    // Transfer team leadership (leader only)
    async handleTransferLeadershipCommand(interaction) {
        try {
            const { user } = interaction;
            const targetUser = interaction.options.getUser("user");
            const teamId = this.playerTeams.get(user.id);

            if (!teamId) {
                return interaction.reply({
                    content: "❌ You're not in any team.",
                    ephemeral: true,
                });
            }

            const team = this.teams.get(teamId);
            if (!team) {
                return interaction.reply({
                    content: "❌ Team data not found.",
                    ephemeral: true,
                });
            }

            // Check if user is team leader
            if (team.leader !== user.id) {
                return interaction.reply({
                    content: "❌ Only the team leader can transfer leadership.",
                    ephemeral: true,
                });
            }

            // Check if target user is in the team
            if (!team.members.includes(targetUser.id)) {
                return interaction.reply({
                    content: `❌ ${targetUser} is not in your team.`,
                    ephemeral: true,
                });
            }

            // Prevent transferring to self
            if (targetUser.id === user.id) {
                return interaction.reply({
                    content: "❌ You are already the team leader.",
                    ephemeral: true,
                });
            }

            // Confirm transfer
            const confirmEmbed = new EmbedBuilder()
                .setTitle("👑 Confirm Leadership Transfer")
                .setDescription(`Are you sure you want to transfer leadership of "${team.name}" to ${targetUser}?`)
                .setColor(0xff9500)
                .addFields(
                    { name: "⚠️ Warning", value: "This action cannot be undone. You will become a regular team member.", inline: false }
                );

            const buttons = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`confirm_transfer_${teamId}_${targetUser.id}`)
                    .setLabel("✅ Confirm Transfer")
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId("cancel_transfer")
                    .setLabel("❌ Cancel")
                    .setStyle(ButtonStyle.Secondary)
            );

            await interaction.reply({
                embeds: [confirmEmbed],
                components: [buttons],
                ephemeral: true,
            });

        } catch (error) {
            console.error("❌ Error in transfer leadership command:", error);
            await interaction.reply({
                content: "❌ An error occurred while processing the transfer.",
                ephemeral: true,
            });
        }
    }

    // Handle leadership transfer confirmation
    async handleTransferConfirmation(interaction, teamId, newLeaderId) {
        try {
            const team = this.teams.get(teamId);
            if (!team || team.leader !== interaction.user.id) {
                return interaction.update({
                    content: "❌ Transfer cancelled - invalid permissions.",
                    embeds: [],
                    components: [],
                });
            }

            const oldLeader = interaction.user;
            const newLeader = await this.client.users.fetch(newLeaderId);

            // Transfer leadership
            team.leader = newLeaderId;
            team.lastActivity = new Date();
            this.teams.set(teamId, team);
            this.saveTeams();

            // Notify new leader
            try {
                const leaderEmbed = new EmbedBuilder()
                    .setTitle("👑 You are now Team Leader!")
                    .setDescription(`${oldLeader} has transferred leadership of team "${team.name}" to you.`)
                    .setColor(0x00ff00)
                    .addFields(
                        { name: "📋 New Responsibilities", value: "• Manage team members\n• Invite new members\n• Transfer leadership", inline: false }
                    )
                    .setTimestamp();

                await newLeader.send({ embeds: [leaderEmbed] });
            } catch (error) {
                console.log("❌ Could not notify new leader:", error.message);
            }

            const resultEmbed = new EmbedBuilder()
                .setTitle("✅ Leadership Transferred")
                .setDescription(`Leadership of "${team.name}" has been transferred to ${newLeader}.`)
                .setColor(0x00ff00)
                .addFields(
                    { name: "👑 New Leader", value: newLeader.toString(), inline: true },
                    { name: "👤 Former Leader", value: oldLeader.toString(), inline: true }
                )
                .setTimestamp();

            await interaction.update({
                embeds: [resultEmbed],
                components: [],
            });

            console.log(`👑 Team "${team.name}" leadership transferred from ${oldLeader.tag} to ${newLeader.tag}`);

        } catch (error) {
            console.error("❌ Error confirming leadership transfer:", error);
            await interaction.update({
                content: "❌ An error occurred during the transfer.",
                embeds: [],
                components: [],
            });
        }
    }

    // Admin command to force disband a team
    async handleDisbandTeamCommand(interaction) {
        try {
            const { member, guild } = interaction;
            const teamName = interaction.options.getString("name");

            // Check admin permissions
            const hasAdminRole = this.config.adminRoleIds.some(roleId => 
                member.roles.cache.has(roleId)
            );
            const hasAdminPerms = member.permissions.has(PermissionFlagsBits.Administrator);

            if (!hasAdminRole && !hasAdminPerms) {
                return interaction.reply({
                    content: "❌ You need administrator permissions to use this command.",
                    ephemeral: true,
                });
            }

            // Find team by name
            const team = Array.from(this.teams.values()).find(t => 
                t.name.toLowerCase() === teamName.toLowerCase()
            );

            if (!team) {
                return interaction.reply({
                    content: `❌ Team "${teamName}" not found.`,
                    ephemeral: true,
                });
            }

            // Remove all members from team mapping
            team.members.forEach(memberId => {
                this.playerTeams.delete(memberId);
            });

            // Cancel all pending invites for this team
            const teamInvites = Array.from(this.pendingInvites.entries()).filter(
                ([_, invite]) => invite.teamId === team.id && invite.status === 'pending'
            );
            teamInvites.forEach(([inviteId, _]) => {
                this.pendingInvites.delete(inviteId);
            });

            // Delete voice channel if exists
            const voiceChannelId = this.teamVoiceChannels.get(team.id);
            if (voiceChannelId) {
                try {
                    const voiceChannel = guild.channels.cache.get(voiceChannelId);
                    if (voiceChannel) {
                        await voiceChannel.delete();
                    }
                    this.teamVoiceChannels.delete(team.id);
                } catch (error) {
                    console.error("❌ Error deleting team voice channel:", error);
                }
            }

            // Delete team
            this.teams.delete(team.id);
            this.saveTeams();
            this.savePendingInvites();

            // Notify all team members
            const memberNotifications = team.members.map(async (memberId) => {
                try {
                    const member = await this.client.users.fetch(memberId);
                    const dmEmbed = new EmbedBuilder()
                        .setTitle("🗑️ Team Disbanded by Admin")
                        .setDescription(`Your team "${team.name}" has been disbanded by server administration.`)
                        .setColor(0xff0000)
                        .setTimestamp();

                    await member.send({ embeds: [dmEmbed] });
                } catch (error) {
                    console.log(`❌ Could not notify member ${memberId}:`, error.message);
                }
            });

            await Promise.all(memberNotifications);

            await interaction.reply({
                content: `✅ Team "${team.name}" has been disbanded. ${team.members.length} members have been notified.`,
                ephemeral: true,
            });

            console.log(`🗑️ Admin ${interaction.user.tag} disbanded team "${team.name}"`);

        } catch (error) {
            console.error("❌ Error disbanding team:", error);
            await interaction.reply({
                content: "❌ An error occurred while disbanding the team.",
                ephemeral: true,
            });
        }
    }

    // Create team voice channel
    async createTeamVoiceChannel(guild, team) {
        try {
            if (!this.teamCategoryId) return null;

            const category = guild.channels.cache.get(this.teamCategoryId);
            if (!category) {
                console.error(`❌ Team category not found: ${this.teamCategoryId}`);
                return null;
            }

            const voiceChannel = await guild.channels.create({
                name: `🎤 ${team.name}`,
                type: ChannelType.GuildVoice,
                parent: this.teamCategoryId,
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone.id,
                        deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect],
                    },
                    ...team.members.map(memberId => ({
                        id: memberId,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.Connect,
                            PermissionFlagsBits.Speak
                        ],
                    }))
                ],
            });

            console.log(`✅ Created voice channel for team "${team.name}": ${voiceChannel.name}`);
            return voiceChannel;
        } catch (error) {
            console.error("❌ Error creating team voice channel:", error);
            return null;
        }
    }

    // Handle button interactions
    async handleButtonInteraction(interaction) {
        const { customId } = interaction;

        try {
            if (customId.startsWith("accept_invite_")) {
                const inviteId = customId.replace("accept_invite_", "");
                await this.handleInviteResponse(interaction, inviteId, 'accept');
            } else if (customId.startsWith("deny_invite_")) {
                const inviteId = customId.replace("deny_invite_", "");
                await this.handleInviteResponse(interaction, inviteId, 'deny');
            } else if (customId.startsWith("confirm_leave_")) {
                const teamId = customId.replace("confirm_leave_", "");
                await this.handleLeaveTeamConfirmation(interaction, teamId);
            } else if (customId === "cancel_leave") {
                await interaction.update({
                    content: "❌ Team leave cancelled.",
                    embeds: [],
                    components: [],
                });
            } else if (customId.startsWith("confirm_transfer_")) {
                const parts = customId.split("_");
                const teamId = parts[2];
                const newLeaderId = parts[3];
                await this.handleTransferConfirmation(interaction, teamId, newLeaderId);
            } else if (customId === "cancel_transfer") {
                await interaction.update({
                    content: "❌ Leadership transfer cancelled.",
                    embeds: [],
                    components: [],
                });
            }
        } catch (error) {
            console.error("❌ Error handling team button interaction:", error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: "❌ An error occurred while processing your request.",
                    ephemeral: true,
                });
            }
        }
    }

    // Get team statistics
    getTeamStats() {
        const totalTeams = this.teams.size;
        const totalPlayers = this.playerTeams.size;
        const averageTeamSize = totalTeams > 0 ? (totalPlayers / totalTeams).toFixed(1) : 0;
        const fullTeams = Array.from(this.teams.values()).filter(team => team.members.length === this.maxTeamSize).length;
        const pendingInvites = Array.from(this.pendingInvites.values()).filter(invite => invite.status === 'pending').length;
        
        return {
            totalTeams,
            totalPlayers,
            averageTeamSize,
            fullTeams,
            pendingInvites,
            maxTeamSize: this.maxTeamSize
        };
    }

    // Clean up expired invites (called periodically)
    async cleanupExpiredInvites() {
        try {
            const now = new Date();
            const expiredInvites = Array.from(this.pendingInvites.entries()).filter(
                ([_, invite]) => invite.status === 'pending' && now > invite.expiresAt
            );

            expiredInvites.forEach(([inviteId, invite]) => {
                this.pendingInvites.delete(inviteId);
                console.log(`🧹 Expired invite for team "${invite.teamName}" to ${invite.targetUserTag}`);
            });

            if (expiredInvites.length > 0) {
                this.savePendingInvites();
                console.log(`🧹 Cleaned up ${expiredInvites.length} expired invites`);
            }

            return expiredInvites.length;
        } catch (error) {
            console.error("❌ Error cleaning up expired invites:", error);
            return 0;
        }
    }

    // Clean up inactive teams (called periodically)
    async cleanupInactiveTeams(daysInactive = 30) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysInactive);

            const inactiveTeams = Array.from(this.teams.values()).filter(team => 
                team.lastActivity < cutoffDate && team.members.length === 1
            );

            for (const team of inactiveTeams) {
                console.log(`🧹 Cleaning up inactive team: ${team.name}`);
                
                // Remove player mapping
                this.playerTeams.delete(team.leader);
                
                // Cancel pending invites for this team
                const teamInvites = Array.from(this.pendingInvites.entries()).filter(
                    ([_, invite]) => invite.teamId === team.id && invite.status === 'pending'
                );
                teamInvites.forEach(([inviteId, _]) => {
                    this.pendingInvites.delete(inviteId);
                });
                
                // Delete voice channel if exists
                const voiceChannelId = this.teamVoiceChannels.get(team.id);
                if (voiceChannelId) {
                    try {
                        const voiceChannel = this.client.channels.cache.get(voiceChannelId);
                        if (voiceChannel) {
                            await voiceChannel.delete();
                        }
                        this.teamVoiceChannels.delete(team.id);
                    } catch (error) {
                        console.error("❌ Error deleting inactive team voice channel:", error);
                    }
                }
                
                // Remove team
                this.teams.delete(team.id);
            }

            if (inactiveTeams.length > 0) {
                this.saveTeams();
                this.savePendingInvites();
                console.log(`🧹 Cleaned up ${inactiveTeams.length} inactive teams`);
            }

            return inactiveTeams.length;
        } catch (error) {
            console.error("❌ Error cleaning up inactive teams:", error);
            return 0;
        }
    }
}

module.exports = TeamManagementSystem;