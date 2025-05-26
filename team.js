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
        this.maxTeamSize = 6; // Configurable max team size
        this.teamCategoryId = config.teamCategoryId || null; // Voice channel category for teams
        this.loadTeams();
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

    // Generate unique team invite code
    generateInviteCode() {
        return crypto.randomBytes(3).toString('hex').toUpperCase();
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

            // Generate unique team ID and invite code
            const teamId = `team_${Date.now()}_${user.id}`;
            const inviteCode = this.generateInviteCode();

            // Create team data
            const teamData = {
                id: teamId,
                name: teamName,
                leader: user.id,
                members: [user.id],
                inviteCode: inviteCode,
                createdAt: new Date(),
                lastActivity: new Date(),
                stats: {
                    gamesPlayed: 0,
                    wins: 0,
                    totalKills: 0,
                    totalDeaths: 0
                },
                settings: {
                    allowInvites: true,
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
                    { name: "🎫 Invite Code", value: `\`${inviteCode}\``, inline: true },
                    { name: "📊 Members", value: `1/${this.maxTeamSize}`, inline: true },
                    { name: "📅 Created", value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
                    { name: "🆔 Team ID", value: `\`${teamId}\``, inline: true },
                    { 
                        name: "📋 Next Steps", 
                        value: `• Share invite code \`${inviteCode}\` with friends\n• Use \`/team info\` to manage your team\n• Use \`/team invite @user\` to directly invite members${voiceChannelMention}`, 
                        inline: false 
                    }
                )
                .setThumbnail(user.displayAvatarURL({ dynamic: true }))
                .setTimestamp()
                .setFooter({ text: "UnitedRust Team Management" });

            await interaction.reply({ embeds: [embed] });

            console.log(`✅ Team "${teamName}" created by ${user.tag} with code ${inviteCode}`);
        } catch (error) {
            console.error("❌ Error creating team:", error);
            await interaction.reply({
                content: "❌ An error occurred while creating the team.",
                ephemeral: true,
            });
        }
    }

    // Join a team using invite code
    async handleJoinTeamCommand(interaction) {
        try {
            const { user } = interaction;
            const inviteCode = interaction.options.getString("code").toUpperCase();

            // Check if user is already in a team
            if (this.playerTeams.has(user.id)) {
                const currentTeamId = this.playerTeams.get(user.id);
                const currentTeam = this.teams.get(currentTeamId);
                return interaction.reply({
                    content: `❌ You're already in team "${currentTeam?.name || 'Unknown'}". Use \`/team leave\` first.`,
                    ephemeral: true,
                });
            }

            // Find team by invite code
            const team = Array.from(this.teams.values()).find(t => t.inviteCode === inviteCode);
            if (!team) {
                return interaction.reply({
                    content: "❌ Invalid invite code. Please check the code and try again.",
                    ephemeral: true,
                });
            }

            // Check if team is full
            if (team.members.length >= this.maxTeamSize) {
                return interaction.reply({
                    content: `❌ Team "${team.name}" is full (${this.maxTeamSize}/${this.maxTeamSize} members).`,
                    ephemeral: true,
                });
            }

            // Check if invites are allowed
            if (!team.settings.allowInvites) {
                return interaction.reply({
                    content: `❌ Team "${team.name}" is not accepting new members.`,
                    ephemeral: true,
                });
            }

            // Add user to team
            team.members.push(user.id);
            team.lastActivity = new Date();
            this.teams.set(team.id, team);
            this.playerTeams.set(user.id, team.id);
            this.saveTeams();

            // Update voice channel permissions if it exists
            const voiceChannelId = this.teamVoiceChannels.get(team.id);
            if (voiceChannelId) {
                try {
                    const voiceChannel = interaction.guild.channels.cache.get(voiceChannelId);
                    if (voiceChannel) {
                        await voiceChannel.permissionOverwrites.create(user, {
                            ViewChannel: true,
                            Connect: true,
                            Speak: true
                        });
                    }
                } catch (error) {
                    console.error("❌ Error updating voice channel permissions:", error);
                }
            }

            const embed = new EmbedBuilder()
                .setTitle("✅ Successfully Joined Team!")
                .setColor(0x00ff00)
                .addFields(
                    { name: "👥 Team Name", value: team.name, inline: true },
                    { name: "👑 Team Leader", value: `<@${team.leader}>`, inline: true },
                    { name: "📊 Members", value: `${team.members.length}/${this.maxTeamSize}`, inline: true },
                    { name: "📅 Team Created", value: `<t:${Math.floor(team.createdAt.getTime() / 1000)}:R>`, inline: true }
                )
                .setThumbnail(user.displayAvatarURL({ dynamic: true }))
                .setTimestamp()
                .setFooter({ text: "UnitedRust Team Management" });

            await interaction.reply({ embeds: [embed] });

            // Notify team leader
            try {
                const leader = await this.client.users.fetch(team.leader);
                const dmEmbed = new EmbedBuilder()
                    .setTitle("👥 New Team Member!")
                    .setDescription(`${user} (${user.tag}) has joined your team "${team.name}".`)
                    .setColor(0x00ff00)
                    .addFields(
                        { name: "📊 Team Size", value: `${team.members.length}/${this.maxTeamSize}`, inline: true }
                    )
                    .setTimestamp();

                await leader.send({ embeds: [dmEmbed] });
            } catch (error) {
                console.log("❌ Could not notify team leader:", error.message);
            }

            console.log(`✅ ${user.tag} joined team "${team.name}" using code ${inviteCode}`);
        } catch (error) {
            console.error("❌ Error joining team:", error);
            await interaction.reply({
                content: "❌ An error occurred while joining the team.",
                ephemeral: true,
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
                    content: "❌ You're not in any team. Use `/team create` or `/team join` to get started!",
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
                    { name: "🎫 Invite Code", value: `\`${team.inviteCode}\``, inline: true },
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

            // Add management buttons if user is team leader
            let components = [];
            if (team.leader === user.id) {
                const buttons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`regenerate_invite_${teamId}`)
                        .setLabel("🔄 New Invite Code")
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId(`toggle_invites_${teamId}`)
                        .setLabel(team.settings.allowInvites ? "🔒 Disable Invites" : "🔓 Enable Invites")
                        .setStyle(team.settings.allowInvites ? ButtonStyle.Danger : ButtonStyle.Success)
                );
                components = [buttons];
            }

            await interaction.reply({ 
                embeds: [embed], 
                components: components,
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
            if (customId.startsWith("confirm_leave_")) {
                const teamId = customId.replace("confirm_leave_", "");
                await this.handleLeaveTeamConfirmation(interaction, teamId);
            } else if (customId === "cancel_leave") {
                await interaction.update({
                    content: "❌ Team leave cancelled.",
                    embeds: [],
                    components: [],
                });
            } else if (customId.startsWith("regenerate_invite_")) {
                const teamId = customId.replace("regenerate_invite_", "");
                await this.handleRegenerateInvite(interaction, teamId);
            } else if (customId.startsWith("toggle_invites_")) {
                const teamId = customId.replace("toggle_invites_", "");
                await this.handleToggleInvites(interaction, teamId);
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

    // Regenerate team invite code (leader only)
    async handleRegenerateInvite(interaction, teamId) {
        const team = this.teams.get(teamId);
        if (!team || team.leader !== interaction.user.id) {
            return interaction.reply({
                content: "❌ You don't have permission to do this.",
                ephemeral: true,
            });
        }

        const oldCode = team.inviteCode;
        team.inviteCode = this.generateInviteCode();
        this.teams.set(teamId, team);
        this.saveTeams();

        await interaction.reply({
            content: `✅ New invite code generated!\n**Old Code:** ~~\`${oldCode}\`~~\n**New Code:** \`${team.inviteCode}\``,
            ephemeral: true,
        });

        console.log(`🔄 Team "${team.name}" invite code regenerated by ${interaction.user.tag}`);
    }

    // Toggle team invite permissions (leader only)
    async handleToggleInvites(interaction, teamId) {
        const team = this.teams.get(teamId);
        if (!team || team.leader !== interaction.user.id) {
            return interaction.reply({
                content: "❌ You don't have permission to do this.",
                ephemeral: true,
            });
        }

        team.settings.allowInvites = !team.settings.allowInvites;
        this.teams.set(teamId, team);
        this.saveTeams();

        const status = team.settings.allowInvites ? "enabled" : "disabled";
        const emoji = team.settings.allowInvites ? "🔓" : "🔒";

        await interaction.reply({
            content: `${emoji} Team invites ${status} for "${team.name}".`,
            ephemeral: true,
        });

        console.log(`${emoji} Team "${team.name}" invites ${status} by ${interaction.user.tag}`);
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
                    content: "❌ Only the team leader can directly invite users.",
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

            // Check if invites are enabled
            if (!team.settings.allowInvites) {
                return interaction.reply({
                    content: "❌ Your team has invites disabled. Enable them first using `/team info`.",
                    ephemeral: true,
                });
            }

            // Send invitation to target user
            try {
                const inviteEmbed = new EmbedBuilder()
                    .setTitle("👥 Team Invitation!")
                    .setDescription(`You've been invited to join team "${team.name}" by ${user}.`)
                    .setColor(0x00ff00)
                    .addFields(
                        { name: "👥 Team Name", value: team.name, inline: true },
                        { name: "👑 Team Leader", value: `${user.tag}`, inline: true },
                        { name: "📊 Current Members", value: `${team.members.length}/${this.maxTeamSize}`, inline: true },
                        { name: "📅 Team Created", value: `<t:${Math.floor(team.createdAt.getTime() / 1000)}:R>`, inline: true },
                        { name: "🎫 How to Join", value: `Use \`/team join ${team.inviteCode}\` to accept this invitation!`, inline: false }
                    )
                    .setTimestamp()
                    .setFooter({ text: "UnitedRust Team Invitation" });

                await targetUser.send({ embeds: [inviteEmbed] });

                await interaction.reply({
                    content: `✅ Invitation sent to ${targetUser}! They can join using code \`${team.inviteCode}\`.`,
                    ephemeral: true,
                });

                console.log(`📧 Team invite sent to ${targetUser.tag} for team "${team.name}" by ${user.tag}`);
            } catch (error) {
                console.log("❌ Could not send DM to target user:", error.message);
                await interaction.reply({
                    content: `⚠️ Could not send DM to ${targetUser}. Share this invite code with them: \`${team.inviteCode}\``,
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
                        { name: "📋 New Responsibilities", value: "• Manage team members\n• Control team settings\n• Invite new members", inline: false }
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

    // Get team statistics
    getTeamStats() {
        const totalTeams = this.teams.size;
        const totalPlayers = this.playerTeams.size;
        const averageTeamSize = totalTeams > 0 ? (totalPlayers / totalTeams).toFixed(1) : 0;
        const fullTeams = Array.from(this.teams.values()).filter(team => team.members.length === this.maxTeamSize).length;
        
        return {
            totalTeams,
            totalPlayers,
            averageTeamSize,
            fullTeams,
            maxTeamSize: this.maxTeamSize
        };
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
                console.log(`🧹 Cleaned up ${inactiveTeams.length} inactive teams`);
            }

            return inactiveTeams.length;
        } catch (error) {
            console.error("❌ Error cleaning up inactive teams:", error);
            return 0;
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
}

module.exports = TeamManagementSystem;