// Rust Leaderboard System for UnitedRust Discord Bot
const { EmbedBuilder } = require("discord.js");

class LeaderboardSystem {
    constructor(client, config) {
        this.client = client;
        this.config = config;
        this.apiBaseUrl = process.env.RUST_API_URL || "http://localhost:3001";
        
        // Category mappings with display names and descriptions
        this.categories = {
            // Materials
            stones: {
                name: "Stone Gathered",
                emoji: "🪨",
                description: "Most stone gathered",
                unit: "",
                type: "material"
            },
            wood: {
                name: "Wood Gathered",
                emoji: "🪵",
                description: "Most wood gathered",
                unit: "",
                type: "material"
            },
            sulfurOre: {
                name: "Sulfur Ore",
                emoji: "💎",
                description: "Most sulfur ore gathered",
                unit: "",
                type: "material"
            },
            metalOre: {
                name: "Metal Ore",
                emoji: "⛏️",
                description: "Most metal ore gathered",
                unit: "",
                type: "material"
            },
            
            // PvP Stats
            kills: {
                name: "PvP Kills",
                emoji: "⚔️",
                description: "Most PvP kills",
                unit: "",
                type: "pvp"
            },
            deaths: {
                name: "Deaths",
                emoji: "💀",
                description: "Most deaths",
                unit: "",
                type: "pvp"
            },
            kdRatio: {
                name: "K/D Ratio",
                emoji: "🎯",
                description: "Highest kill/death ratio",
                unit: "",
                type: "pvp"
            },
            accuracy: {
                name: "PvP Accuracy",
                emoji: "🏹",
                description: "Highest PvP hit accuracy",
                unit: "%",
                type: "pvp"
            },
            
            // Time Stats
            totalLifetime: {
                name: "Total Playtime",
                emoji: "⏰",
                description: "Total playtime across all wipes",
                unit: "time",
                type: "time"
            },
            sinceWipe: {
                name: "Wipe Playtime",
                emoji: "🔄",
                description: "Playtime since last wipe",
                unit: "time",
                type: "time"
            },
            afkTime: {
                name: "AFK Time",
                emoji: "😴",
                description: "Most AFK time logged",
                unit: "time",
                type: "time"
            }
        };
    }

    // Format time from seconds to readable format
    formatTime(seconds) {
        if (!seconds || seconds === 0) return "0m";
        
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        
        let result = "";
        if (hours > 0) result += `${hours}h `;
        if (minutes > 0) result += `${minutes}m`;
        
        return result.trim() || "0m";
    }

    // Format numbers with commas
    formatNumber(num) {
        if (!num || num === 0) return "0";
        return num.toLocaleString();
    }

    // Format value based on category
    formatValue(value, category) {
        const categoryInfo = this.categories[category];
        if (!categoryInfo) return value;

        if (categoryInfo.unit === "time") {
            return this.formatTime(value);
        } else if (categoryInfo.unit === "%") {
            return `${value}%`;
        } else if (categoryInfo.type === "pvp" && category === "kdRatio") {
            return parseFloat(value).toFixed(2);
        } else if (categoryInfo.type === "material") {
            return this.formatNumber(value);
        } else {
            return this.formatNumber(value);
        }
    }

    // Fetch leaderboard data from API
    async fetchLeaderboard(category) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/leaderboard/${category}`);
            
            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error("Invalid category");
                }
                throw new Error(`API Error: ${response.status}`);
            }
            
            const data = await response.json();
            return data;
        } catch (error) {
            console.error(`❌ Error fetching leaderboard for ${category}:`, error);
            throw error;
        }
    }

    // Fetch individual player stats from API
    async fetchPlayerStats(steamId) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/stats/${steamId}`);
            
            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error("Player not found");
                }
                throw new Error(`API Error: ${response.status}`);
            }
            
            const data = await response.json();
            return data;
        } catch (error) {
            console.error(`❌ Error fetching player stats for ${steamId}:`, error);
            throw error;
        }
    }

    // Handle leaderboard command
    async handleLeaderboardCommand(interaction) {
        try {
            const category = interaction.options.getString("category") || "kills";
            
            if (!this.categories[category]) {
                return interaction.reply({
                    content: `❌ Invalid category. Available categories: ${Object.keys(this.categories).join(", ")}`,
                    ephemeral: true,
                });
            }

            await interaction.deferReply();

            const leaderboardData = await this.fetchLeaderboard(category);
            const categoryInfo = this.categories[category];

            if (!leaderboardData || leaderboardData.length === 0) {
                return interaction.editReply({
                    content: "❌ No leaderboard data available for this category.",
                });
            }

            // Create leaderboard embed
            const embed = new EmbedBuilder()
                .setTitle(`${categoryInfo.emoji} ${categoryInfo.name} Leaderboard`)
                .setDescription(`${categoryInfo.description} - Top ${leaderboardData.length} players`)
                .setColor(this.getColorForCategory(categoryInfo.type))
                .setTimestamp()
                .setFooter({ text: "UnitedRust Leaderboard System" });

            // Add leaderboard entries
            const leaderboardText = leaderboardData.map((player, index) => {
                const position = this.getPositionEmoji(index + 1);
                const value = this.formatValue(player.value, category);
                return `${position} **${player.playerName}** - ${value}`;
            }).join('\n');

            embed.addFields({
                name: "📊 Rankings",
                value: leaderboardText || "No data available",
                inline: false
            });

            // Add category-specific information
            if (categoryInfo.type === "time") {
                embed.addFields({
                    name: "ℹ️ Info",
                    value: "Time values exclude AFK time unless specifically noted.",
                    inline: false
                });
            } else if (categoryInfo.type === "pvp") {
                embed.addFields({
                    name: "ℹ️ Info",
                    value: "PvP stats are calculated from player vs player combat only.",
                    inline: false
                });
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error("❌ Error handling leaderboard command:", error);
            
            let errorMessage = "❌ An error occurred while fetching the leaderboard.";
            if (error.message === "Invalid category") {
                errorMessage = "❌ Invalid leaderboard category specified.";
            } else if (error.message.includes("API Error")) {
                errorMessage = "❌ Unable to connect to the game server API. Please try again later.";
            }

            if (interaction.deferred) {
                await interaction.editReply({ content: errorMessage });
            } else {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            }
        }
    }

    // Handle player stats command
    async handlePlayerStatsCommand(interaction) {
        try {
            const steamId = interaction.options.getString("steamid");
            
            if (!steamId || steamId.length < 17) {
                return interaction.reply({
                    content: "❌ Please provide a valid Steam ID (17 digits).",
                    ephemeral: true,
                });
            }

            await interaction.deferReply();

            const playerData = await this.fetchPlayerStats(steamId);

            if (!playerData) {
                return interaction.editReply({
                    content: "❌ Player not found or no stats available.",
                });
            }

            // Create player stats embed
            const embed = new EmbedBuilder()
                .setTitle(`📊 Player Stats: ${playerData.playerName}`)
                .setDescription(`Detailed statistics for Steam ID: \`${playerData.steamId}\``)
                .setColor(0x3498db)
                .setTimestamp()
                .setFooter({ text: "UnitedRust Player Statistics" });

            // Materials section
            if (playerData.materials) {
                const materials = playerData.materials;
                embed.addFields({
                    name: "🪨 Materials Gathered",
                    value: `**Stone:** ${this.formatNumber(materials.stones)}\n` +
                           `**Wood:** ${this.formatNumber(materials.wood)}\n` +
                           `**Sulfur Ore:** ${this.formatNumber(materials.sulfurOre)}\n` +
                           `**Metal Ore:** ${this.formatNumber(materials.metalOre)}`,
                    inline: true
                });
            }

            // PvP section
            if (playerData.pvp) {
                const pvp = playerData.pvp;
                embed.addFields({
                    name: "⚔️ PvP Statistics",
                    value: `**Kills:** ${this.formatNumber(pvp.kills)}\n` +
                           `**Deaths:** ${this.formatNumber(pvp.deaths)}\n` +
                           `**K/D Ratio:** ${parseFloat(pvp.kdRatio).toFixed(2)}\n` +
                           `**Accuracy:** ${pvp.accuracyPercent}%`,
                    inline: true
                });
            }

            // Time section
            if (playerData.time) {
                const time = playerData.time;
                embed.addFields({
                    name: "⏰ Time Statistics",
                    value: `**Total Playtime:** ${this.formatTime(time.totalLifetime)}\n` +
                           `**Since Wipe:** ${this.formatTime(time.sinceWipe)}\n` +
                           `**AFK Time:** ${this.formatTime(time.afkTime)}`,
                    inline: true
                });
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error("❌ Error handling player stats command:", error);
            
            let errorMessage = "❌ An error occurred while fetching player statistics.";
            if (error.message === "Player not found") {
                errorMessage = "❌ Player not found. Make sure the Steam ID is correct.";
            } else if (error.message.includes("API Error")) {
                errorMessage = "❌ Unable to connect to the game server API. Please try again later.";
            }

            if (interaction.deferred) {
                await interaction.editReply({ content: errorMessage });
            } else {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            }
        }
    }

    // Handle top players overview command
    async handleTopPlayersCommand(interaction) {
        try {
            await interaction.deferReply();

            // Fetch multiple leaderboards for overview
            const promises = [
                this.fetchLeaderboard("kills").catch(() => null),
                this.fetchLeaderboard("totalLifetime").catch(() => null),
                this.fetchLeaderboard("stones").catch(() => null),
                this.fetchLeaderboard("kdRatio").catch(() => null)
            ];

            const [killsData, playtimeData, stonesData, kdData] = await Promise.all(promises);

            const embed = new EmbedBuilder()
                .setTitle("🏆 UnitedRust Top Players Overview")
                .setDescription("Quick overview of top performers across different categories")
                .setColor(0xffd700) // Gold color
                .setTimestamp()
                .setFooter({ text: "UnitedRust Server Statistics" });

            // Add top killer
            if (killsData && killsData.length > 0) {
                const topKiller = killsData[0];
                embed.addFields({
                    name: "⚔️ Top Killer",
                    value: `**${topKiller.playerName}**\n${this.formatNumber(topKiller.value)} kills`,
                    inline: true
                });
            }

            // Add most active player
            if (playtimeData && playtimeData.length > 0) {
                const mostActive = playtimeData[0];
                embed.addFields({
                    name: "⏰ Most Active",
                    value: `**${mostActive.playerName}**\n${this.formatTime(mostActive.value)} played`,
                    inline: true
                });
            }

            // Add top gatherer
            if (stonesData && stonesData.length > 0) {
                const topGatherer = stonesData[0];
                embed.addFields({
                    name: "🪨 Top Stone Gatherer",
                    value: `**${topGatherer.playerName}**\n${this.formatNumber(topGatherer.value)} stone`,
                    inline: true
                });
            }

            // Add best K/D ratio
            if (kdData && kdData.length > 0) {
                const bestKD = kdData[0];
                embed.addFields({
                    name: "🎯 Best K/D Ratio",
                    value: `**${bestKD.playerName}**\n${parseFloat(bestKD.value).toFixed(2)} K/D`,
                    inline: true
                });
            }

            embed.addFields({
                name: "📋 Available Commands",
                value: "• `/lb [category]` - View specific leaderboard\n• `/playerstats [steamid]` - View individual player stats\n• `/topplayers` - This overview",
                inline: false
            });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error("❌ Error handling top players command:", error);
            
            const errorMessage = "❌ Unable to fetch top players data. Please try again later.";
            if (interaction.deferred) {
                await interaction.editReply({ content: errorMessage });
            } else {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            }
        }
    }

    // Get position emoji for leaderboard rankings
    getPositionEmoji(position) {
        const emojis = {
            1: "🥇",
            2: "🥈", 
            3: "🥉"
        };
        return emojis[position] || `**${position}.**`;
    }

    // Get color based on category type
    getColorForCategory(type) {
        const colors = {
            material: 0x8B4513, // Brown
            pvp: 0xFF0000,      // Red
            time: 0x00FF00      // Green
        };
        return colors[type] || 0x3498db; // Default blue
    }

    // Get all available categories for help
    getCategoriesList() {
        return Object.entries(this.categories).map(([key, info]) => {
            return `\`${key}\` - ${info.description}`;
        }).join('\n');
    }

    // Test API connection
    async testApiConnection() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/leaderboard/kills`);
            return response.ok;
        } catch (error) {
            console.error("❌ API connection test failed:", error);
            return false;
        }
    }

    // Get API status for debugging
    async getApiStatus() {
        try {
            const isConnected = await this.testApiConnection();
            return {
                status: isConnected ? "Connected" : "Disconnected",
                url: this.apiBaseUrl,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                status: "Error",
                url: this.apiBaseUrl,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
}

module.exports = LeaderboardSystem;