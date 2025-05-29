// Rust Leaderboard System for UnitedRust Discord Bot - File System Version
const { EmbedBuilder } = require("discord.js");
const fs = require("fs");
const path = require("path");

class LeaderboardSystem {
    constructor(client, config) {
        this.client = client;
        this.config = config;
        // Updated to use file system instead of API
        this.dataDirectory = "/opt/Leaderboard/data/StatLeaderboardAPI/";
        
        // Category mappings with display names, descriptions, and file mappings
        this.categories = {
            // Materials
            stones: {
                name: "Stone Gathered",
                emoji: "🪨",
                description: "Most stone gathered",
                unit: "",
                type: "material",
                filename: "leaderboard_stones.json"
            },
            wood: {
                name: "Wood Gathered",
                emoji: "🪵",
                description: "Most wood gathered",
                unit: "",
                type: "material",
                filename: "leaderboard_wood.json"
            },
            sulfurOre: {
                name: "Sulfur Ore",
                emoji: "💎",
                description: "Most sulfur ore gathered",
                unit: "",
                type: "material",
                filename: "leaderboard_sulfurOre.json"
            },
            metalOre: {
                name: "Metal Ore",
                emoji: "⛏️",
                description: "Most metal ore gathered",
                unit: "",
                type: "material",
                filename: "leaderboard_metalOre.json"
            },
            
            // PvP Stats
            kills: {
                name: "PvP Kills",
                emoji: "⚔️",
                description: "Most PvP kills",
                unit: "",
                type: "pvp",
                filename: "leaderboard_kills.json"
            },
            deaths: {
                name: "Deaths",
                emoji: "💀",
                description: "Most deaths",
                unit: "",
                type: "pvp",
                filename: "leaderboard_deaths.json"
            },
            kdRatio: {
                name: "K/D Ratio",
                emoji: "🎯",
                description: "Highest kill/death ratio",
                unit: "",
                type: "pvp",
                filename: "leaderboard_kdRatio.json"
            },
            accuracy: {
                name: "PvP Accuracy",
                emoji: "🏹",
                description: "Highest PvP hit accuracy",
                unit: "%",
                type: "pvp",
                filename: "leaderboard_accuracy.json"
            },
            
            // Time Stats
            totalLifetime: {
                name: "Total Playtime",
                emoji: "⏰",
                description: "Total playtime across all wipes",
                unit: "time",
                type: "time",
                filename: "leaderboard_totalLifetime.json"
            },
            sinceWipe: {
                name: "Wipe Playtime",
                emoji: "🔄",
                description: "Playtime since last wipe",
                unit: "time",
                type: "time",
                filename: "leaderboard_sinceWipe.json"
            },
            afkTime: {
                name: "AFK Time",
                emoji: "😴",
                description: "Most AFK time logged",
                unit: "time",
                type: "time",
                filename: "leaderboard_afkTime.json"
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

    // Check if data directory exists and is accessible
    checkDataDirectoryAccess() {
        try {
            if (!fs.existsSync(this.dataDirectory)) {
                console.error(`❌ Leaderboard data directory not found: ${this.dataDirectory}`);
                return false;
            }

            // Test read access
            fs.accessSync(this.dataDirectory, fs.constants.R_OK);
            console.log(`✅ Leaderboard data directory accessible: ${this.dataDirectory}`);
            return true;
        } catch (error) {
            console.error(`❌ Cannot access leaderboard data directory: ${error.message}`);
            return false;
        }
    }

    // Read leaderboard data from JSON file
    async fetchLeaderboard(category) {
        try {
            const categoryInfo = this.categories[category];
            if (!categoryInfo) {
                throw new Error("Invalid category");
            }

            const filePath = path.join(this.dataDirectory, categoryInfo.filename);
            
            // Check if file exists
            if (!fs.existsSync(filePath)) {
                console.error(`❌ Leaderboard file not found: ${filePath}`);
                throw new Error("Leaderboard data file not found");
            }

            // Read file content
            const fileContent = fs.readFileSync(filePath, 'utf8');
            
            if (!fileContent.trim()) {
                console.warn(`⚠️ Leaderboard file is empty: ${filePath}`);
                return [];
            }

            // Parse JSON data
            const data = JSON.parse(fileContent);
            
            // Handle different possible data structures
            let leaderboardData = [];
            
            if (Array.isArray(data)) {
                leaderboardData = data;
            } else if (data.leaderboard && Array.isArray(data.leaderboard)) {
                leaderboardData = data.leaderboard;
            } else if (data.data && Array.isArray(data.data)) {
                leaderboardData = data.data;
            } else {
                console.warn(`⚠️ Unexpected data structure in ${filePath}:`, Object.keys(data));
                // Try to extract any array from the data
                const arrayData = Object.values(data).find(value => Array.isArray(value));
                if (arrayData) {
                    leaderboardData = arrayData;
                }
            }

            // Ensure we have the required fields and sort by value (descending)
            const processedData = leaderboardData
                .filter(entry => entry && (entry.playerName || entry.name) && (entry.value !== undefined))
                .map(entry => ({
                    playerName: entry.playerName || entry.name || 'Unknown Player',
                    value: entry.value || 0,
                    steamId: entry.steamId || entry.id || null
                }))
                .sort((a, b) => b.value - a.value);

            console.log(`✅ Loaded ${processedData.length} entries from ${categoryInfo.filename}`);
            return processedData;

        } catch (error) {
            console.error(`❌ Error reading leaderboard for ${category}:`, error);
            throw error;
        }
    }

    // Find player's position in a specific leaderboard
    async findPlayerPosition(steamId, category) {
        try {
            const leaderboardData = await this.fetchLeaderboard(category);
            const playerIndex = leaderboardData.findIndex(entry => entry.steamId === steamId);
            
            if (playerIndex === -1) {
                return {
                    found: false,
                    position: null,
                    value: null,
                    totalPlayers: leaderboardData.length
                };
            }

            return {
                found: true,
                position: playerIndex + 1,
                value: leaderboardData[playerIndex].value,
                totalPlayers: leaderboardData.length,
                playerName: leaderboardData[playerIndex].playerName
            };
        } catch (error) {
            console.error(`❌ Error finding player position in ${category}:`, error);
            return {
                found: false,
                position: null,
                value: null,
                totalPlayers: 0,
                error: error.message
            };
        }
    }

    // Search for players by name (partial matching)
    async searchPlayersByName(searchName) {
        try {
            const searchLower = searchName.toLowerCase();
            const foundPlayers = new Map(); // Use Map to avoid duplicates by steamId
            
            // Search through all categories to find matching player names
            for (const [categoryKey, categoryInfo] of Object.entries(this.categories)) {
                try {
                    const leaderboardData = await this.fetchLeaderboard(categoryKey);
                    
                    leaderboardData.forEach(entry => {
                        if (entry.playerName && entry.playerName.toLowerCase().includes(searchLower)) {
                            if (!foundPlayers.has(entry.steamId)) {
                                foundPlayers.set(entry.steamId, {
                                    steamId: entry.steamId,
                                    playerName: entry.playerName
                                });
                            }
                        }
                    });
                } catch (error) {
                    console.warn(`⚠️ Error searching in ${categoryKey}:`, error.message);
                }
            }
            
            return Array.from(foundPlayers.values());
        } catch (error) {
            console.error(`❌ Error searching for players:`, error);
            return [];
        }
    }

    // Fetch individual player stats (aggregate from all files)
    async fetchPlayerStats(steamId) {
        try {
            const playerStats = {
                steamId: steamId,
                playerName: 'Unknown Player',
                materials: {},
                pvp: {},
                time: {}
            };

            let playerFound = false;

            // Read data from all category files to build comprehensive stats
            for (const [categoryKey, categoryInfo] of Object.entries(this.categories)) {
                try {
                    const filePath = path.join(this.dataDirectory, categoryInfo.filename);
                    
                    if (!fs.existsSync(filePath)) {
                        continue;
                    }

                    const fileContent = fs.readFileSync(filePath, 'utf8');
                    if (!fileContent.trim()) continue;

                    const data = JSON.parse(fileContent);
                    let leaderboardData = [];
                    
                    if (Array.isArray(data)) {
                        leaderboardData = data;
                    } else if (data.leaderboard && Array.isArray(data.leaderboard)) {
                        leaderboardData = data.leaderboard;
                    } else if (data.data && Array.isArray(data.data)) {
                        leaderboardData = data.data;
                    } else {
                        const arrayData = Object.values(data).find(value => Array.isArray(value));
                        if (arrayData) leaderboardData = arrayData;
                    }

                    // Find player in this category's data
                    const playerEntry = leaderboardData.find(entry => 
                        entry && (entry.steamId === steamId || entry.id === steamId)
                    );

                    if (playerEntry) {
                        playerFound = true;
                        
                        // Update player name if we don't have it yet
                        if (playerStats.playerName === 'Unknown Player' && (playerEntry.playerName || playerEntry.name)) {
                            playerStats.playerName = playerEntry.playerName || playerEntry.name;
                        }

                        // Categorize the stat
                        const value = playerEntry.value || 0;
                        
                        if (categoryInfo.type === 'material') {
                            playerStats.materials[categoryKey] = value;
                        } else if (categoryInfo.type === 'pvp') {
                            if (categoryKey === 'accuracy') {
                                playerStats.pvp.accuracyPercent = value;
                            } else {
                                playerStats.pvp[categoryKey] = value;
                            }
                        } else if (categoryInfo.type === 'time') {
                            playerStats.time[categoryKey] = value;
                        }
                    }
                } catch (fileError) {
                    console.warn(`⚠️ Error reading ${categoryInfo.filename}:`, fileError.message);
                    continue;
                }
            }

            if (!playerFound) {
                throw new Error("Player not found");
            }

            return playerStats;

        } catch (error) {
            console.error(`❌ Error fetching player stats for ${steamId}:`, error);
            throw error;
        }
    }

    // NEW: Handle top 3 from all categories command
    async handleTop3AllCommand(interaction) {
        try {
            // Check data directory access first
            if (!this.checkDataDirectoryAccess()) {
                return interaction.reply({
                    content: "❌ Leaderboard system is currently unavailable. Data directory not accessible.",
                    ephemeral: true,
                });
            }

            await interaction.deferReply();

            const embed = new EmbedBuilder()
                .setTitle("🏆 Top 3 Players in All Categories")
                .setDescription("Here are the top 3 players in each leaderboard category!")
                .setColor(0xffd700) // Gold color
                .setTimestamp()
                .setFooter({ text: "UnitedRust Leaderboard - Top 3 Overview" });

            // Fetch top 3 for each category
            const categoryPromises = Object.entries(this.categories).map(async ([categoryKey, categoryInfo]) => {
                try {
                    const leaderboardData = await this.fetchLeaderboard(categoryKey);
                    const top3 = leaderboardData.slice(0, 3);
                    
                    if (top3.length === 0) {
                        return {
                            categoryKey,
                            categoryInfo,
                            data: "No data available"
                        };
                    }

                    const top3Text = top3.map((player, index) => {
                        const position = this.getPositionEmoji(index + 1);
                        const value = this.formatValue(player.value, categoryKey);
                        return `${position} ${player.playerName} - ${value}`;
                    }).join('\n');

                    return {
                        categoryKey,
                        categoryInfo,
                        data: top3Text
                    };
                } catch (error) {
                    console.warn(`⚠️ Error fetching top 3 for ${categoryKey}:`, error.message);
                    return {
                        categoryKey,
                        categoryInfo,
                        data: "Data unavailable"
                    };
                }
            });

            const results = await Promise.all(categoryPromises);

            // Group results by type and add fields
            const materialCategories = results.filter(r => this.categories[r.categoryKey].type === 'material');
            const pvpCategories = results.filter(r => this.categories[r.categoryKey].type === 'pvp');
            const timeCategories = results.filter(r => this.categories[r.categoryKey].type === 'time');

            // Add material categories
            if (materialCategories.length > 0) {
                materialCategories.forEach(result => {
                    embed.addFields({
                        name: `${result.categoryInfo.emoji} ${result.categoryInfo.name}`,
                        value: result.data,
                        inline: true
                    });
                });
            }

            // Add PvP categories
            if (pvpCategories.length > 0) {
                pvpCategories.forEach(result => {
                    embed.addFields({
                        name: `${result.categoryInfo.emoji} ${result.categoryInfo.name}`,
                        value: result.data,
                        inline: true
                    });
                });
            }

            // Add time categories
            if (timeCategories.length > 0) {
                timeCategories.forEach(result => {
                    embed.addFields({
                        name: `${result.categoryInfo.emoji} ${result.categoryInfo.name}`,
                        value: result.data,
                        inline: true
                    });
                });
            }

            embed.addFields({
                name: "📋 Need More Details?",
                value: "• Use `/lb [category]` for full leaderboards\n• Use `/playerrank [steamid]` to see a player's ranks\n• Use `/findplayer [name]` to search by name",
                inline: false
            });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error("❌ Error handling top3all command:", error);
            
            const errorMessage = "❌ An error occurred while fetching the top 3 data.";
            if (interaction.deferred) {
                await interaction.editReply({ content: errorMessage });
            } else {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            }
        }
    }

    // NEW: Handle player rank command
    async handlePlayerRankCommand(interaction) {
        try {
            // Check data directory access first
            if (!this.checkDataDirectoryAccess()) {
                return interaction.reply({
                    content: "❌ Leaderboard system is currently unavailable. Data directory not accessible.",
                    ephemeral: true,
                });
            }

            const steamId = interaction.options.getString("steamid");
            
            if (!steamId || steamId.length < 17) {
                return interaction.reply({
                    content: "❌ Please provide a valid Steam ID (17 digits).",
                    ephemeral: true,
                });
            }

            await interaction.deferReply();

            // Get player's position in all categories
            const positionPromises = Object.entries(this.categories).map(async ([categoryKey, categoryInfo]) => {
                const position = await this.findPlayerPosition(steamId, categoryKey);
                return {
                    categoryKey,
                    categoryInfo,
                    position
                };
            });

            const results = await Promise.all(positionPromises);
            
            // Check if player was found in any category
            const playerFound = results.some(r => r.position.found);
            if (!playerFound) {
                return interaction.editReply({
                    content: "❌ Player not found in any leaderboard category. Make sure the Steam ID is correct.",
                });
            }

            // Get player name from first found result
            const playerName = results.find(r => r.position.found)?.position.playerName || 'Unknown Player';

            const embed = new EmbedBuilder()
                .setTitle(`📊 Player Rankings: ${playerName}`)
                .setDescription(`Ranking positions across all leaderboard categories for Steam ID: \`${steamId}\``)
                .setColor(0x3498db)
                .setTimestamp()
                .setFooter({ text: "UnitedRust Player Rankings" });

            // Group results by type
            const materialResults = results.filter(r => this.categories[r.categoryKey].type === 'material');
            const pvpResults = results.filter(r => this.categories[r.categoryKey].type === 'pvp');
            const timeResults = results.filter(r => this.categories[r.categoryKey].type === 'time');

            // Helper function to format position text
            const formatPosition = (result) => {
                if (!result.position.found) {
                    return "Not ranked";
                }
                
                const value = this.formatValue(result.position.value, result.categoryKey);
                const rank = result.position.position;
                const total = result.position.totalPlayers;
                const percentile = Math.round((1 - (rank - 1) / total) * 100);
                
                return `**#${rank}** of ${total} (${percentile}th percentile)\n${value}`;
            };

            // Add material rankings
            if (materialResults.length > 0) {
                const materialText = materialResults.map(result => {
                    return `${result.categoryInfo.emoji} **${result.categoryInfo.name}:** ${formatPosition(result)}`;
                }).join('\n\n');
                
                embed.addFields({
                    name: "🪨 Material Gathering Rankings",
                    value: materialText,
                    inline: false
                });
            }

            // Add PvP rankings
            if (pvpResults.length > 0) {
                const pvpText = pvpResults.map(result => {
                    return `${result.categoryInfo.emoji} **${result.categoryInfo.name}:** ${formatPosition(result)}`;
                }).join('\n\n');
                
                embed.addFields({
                    name: "⚔️ PvP Rankings",
                    value: pvpText,
                    inline: false
                });
            }

            // Add time rankings
            if (timeResults.length > 0) {
                const timeText = timeResults.map(result => {
                    return `${result.categoryInfo.emoji} **${result.categoryInfo.name}:** ${formatPosition(result)}`;
                }).join('\n\n');
                
                embed.addFields({
                    name: "⏰ Time Rankings",
                    value: timeText,
                    inline: false
                });
            }

            // Add overall summary
            const totalRanked = results.filter(r => r.position.found).length;
            const totalCategories = results.length;
            const topRanks = results.filter(r => r.position.found && r.position.position <= 3).length;
            
            embed.addFields({
                name: "📈 Overall Summary",
                value: `• Ranked in **${totalRanked}/${totalCategories}** categories\n• **${topRanks}** top-3 positions\n• Use \`/playerstats ${steamId}\` for detailed stats`,
                inline: false
            });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error("❌ Error handling playerrank command:", error);
            
            let errorMessage = "❌ An error occurred while fetching player rankings.";
            if (error.message === "Player not found") {
                errorMessage = "❌ Player not found. Make sure the Steam ID is correct.";
            }

            if (interaction.deferred) {
                await interaction.editReply({ content: errorMessage });
            } else {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            }
        }
    }

    // NEW: Handle find player command
    async handleFindPlayerCommand(interaction) {
        try {
            // Check data directory access first
            if (!this.checkDataDirectoryAccess()) {
                return interaction.reply({
                    content: "❌ Leaderboard system is currently unavailable. Data directory not accessible.",
                    ephemeral: true,
                });
            }

            const searchName = interaction.options.getString("playername");
            
            if (!searchName || searchName.length < 2) {
                return interaction.reply({
                    content: "❌ Please provide at least 2 characters to search for.",
                    ephemeral: true,
                });
            }

            await interaction.deferReply();

            // Search for players
            const foundPlayers = await this.searchPlayersByName(searchName);
            
            if (foundPlayers.length === 0) {
                return interaction.editReply({
                    content: `❌ No players found matching "${searchName}". Try a different search term.`,
                });
            }

            if (foundPlayers.length === 1) {
                // If only one player found, show their rankings directly
                const player = foundPlayers[0];
                
                // Get player's position in all categories
                const positionPromises = Object.entries(this.categories).map(async ([categoryKey, categoryInfo]) => {
                    const position = await this.findPlayerPosition(player.steamId, categoryKey);
                    return {
                        categoryKey,
                        categoryInfo,
                        position
                    };
                });

                const results = await Promise.all(positionPromises);

                const embed = new EmbedBuilder()
                    .setTitle(`📊 Player Rankings: ${player.playerName}`)
                    .setDescription(`Found player matching "${searchName}" - showing all rankings\nSteam ID: \`${player.steamId}\``)
                    .setColor(0x00ff00)
                    .setTimestamp()
                    .setFooter({ text: "UnitedRust Player Search Results" });

                // Helper function to format position text
                const formatPosition = (result) => {
                    if (!result.position.found) {
                        return "Not ranked";
                    }
                    
                    const value = this.formatValue(result.position.value, result.categoryKey);
                    const rank = result.position.position;
                    const total = result.position.totalPlayers;
                    
                    return `#${rank} of ${total} - ${value}`;
                };

                // Show top rankings only (top 10 in any category)
                const significantRankings = results.filter(r => r.position.found && r.position.position <= 10);
                
                if (significantRankings.length > 0) {
                    const rankingText = significantRankings
                        .sort((a, b) => a.position.position - b.position.position)
                        .map(result => {
                            return `${result.categoryInfo.emoji} **${result.categoryInfo.name}:** ${formatPosition(result)}`;
                        }).join('\n');
                    
                    embed.addFields({
                        name: "🏆 Top 10 Rankings",
                        value: rankingText,
                        inline: false
                    });
                }

                // Add summary
                const totalRanked = results.filter(r => r.position.found).length;
                const topRanks = results.filter(r => r.position.found && r.position.position <= 3).length;
                
                embed.addFields({
                    name: "📈 Summary",
                    value: `• Ranked in **${totalRanked}** categories\n• **${topRanks}** top-3 positions\n• Use \`/playerrank ${player.steamId}\` for all rankings`,
                    inline: false
                });

                await interaction.editReply({ embeds: [embed] });

            } else {
                // Multiple players found, show selection list
                const embed = new EmbedBuilder()
                    .setTitle(`👥 Multiple Players Found (${foundPlayers.length})`)
                    .setDescription(`Found multiple players matching "${searchName}". Use \`/playerrank\` with their Steam ID to see rankings:`)
                    .setColor(0xff9500)
                    .setTimestamp()
                    .setFooter({ text: "UnitedRust Player Search Results" });

                // Limit to first 10 results to avoid embed limits
                const displayPlayers = foundPlayers.slice(0, 10);
                
                const playerList = displayPlayers.map((player, index) => {
                    return `**${index + 1}.** ${player.playerName}\n└ Steam ID: \`${player.steamId}\``;
                }).join('\n\n');

                embed.addFields({
                    name: "🔍 Search Results",
                    value: playerList,
                    inline: false
                });

                if (foundPlayers.length > 10) {
                    embed.addFields({
                        name: "ℹ️ More Results",
                        value: `Showing first 10 of ${foundPlayers.length} results. Try a more specific search term.`,
                        inline: false
                    });
                }

                embed.addFields({
                    name: "📋 Next Steps",
                    value: "• Copy a Steam ID and use `/playerrank [steamid]` to see full rankings\n• Use `/playerstats [steamid]` for detailed statistics\n• Try a more specific search term to narrow results",
                    inline: false
                });

                await interaction.editReply({ embeds: [embed] });
            }

        } catch (error) {
            console.error("❌ Error handling findplayer command:", error);
            
            const errorMessage = "❌ An error occurred while searching for players.";
            if (interaction.deferred) {
                await interaction.editReply({ content: errorMessage });
            } else {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            }
        }
    }

    // Handle leaderboard command
    async handleLeaderboardCommand(interaction) {
        try {
            // Check data directory access first
            if (!this.checkDataDirectoryAccess()) {
                return interaction.reply({
                    content: "❌ Leaderboard system is currently unavailable. Data directory not accessible.",
                    ephemeral: true,
                });
            }

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
                .setDescription(`${categoryInfo.description} - Top ${Math.min(leaderboardData.length, 15)} players`)
                .setColor(this.getColorForCategory(categoryInfo.type))
                .setTimestamp()
                .setFooter({ text: "UnitedRust Leaderboard System" });

            // Add leaderboard entries (limit to 15 to avoid embed limits)
            const displayData = leaderboardData.slice(0, 15);
            const leaderboardText = displayData.map((player, index) => {
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
            } else if (error.message.includes("not found")) {
                errorMessage = "❌ Leaderboard data file not found. Please contact an administrator.";
            } else if (error.message.includes("access")) {
                errorMessage = "❌ Cannot access leaderboard data files. Please contact an administrator.";
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
            // Check data directory access first
            if (!this.checkDataDirectoryAccess()) {
                return interaction.reply({
                    content: "❌ Leaderboard system is currently unavailable. Data directory not accessible.",
                    ephemeral: true,
                });
            }

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
            if (playerData.materials && Object.keys(playerData.materials).length > 0) {
                const materials = playerData.materials;
                let materialsText = "";
                if (materials.stones !== undefined) materialsText += `**Stone:** ${this.formatNumber(materials.stones)}\n`;
                if (materials.wood !== undefined) materialsText += `**Wood:** ${this.formatNumber(materials.wood)}\n`;
                if (materials.sulfurOre !== undefined) materialsText += `**Sulfur Ore:** ${this.formatNumber(materials.sulfurOre)}\n`;
                if (materials.metalOre !== undefined) materialsText += `**Metal Ore:** ${this.formatNumber(materials.metalOre)}\n`;
                
                if (materialsText) {
                    embed.addFields({
                        name: "🪨 Materials Gathered",
                        value: materialsText.trim(),
                        inline: true
                    });
                }
            }

            // PvP section
            if (playerData.pvp && Object.keys(playerData.pvp).length > 0) {
                const pvp = playerData.pvp;
                let pvpText = "";
                if (pvp.kills !== undefined) pvpText += `**Kills:** ${this.formatNumber(pvp.kills)}\n`;
                if (pvp.deaths !== undefined) pvpText += `**Deaths:** ${this.formatNumber(pvp.deaths)}\n`;
                if (pvp.kdRatio !== undefined) pvpText += `**K/D Ratio:** ${parseFloat(pvp.kdRatio).toFixed(2)}\n`;
                if (pvp.accuracyPercent !== undefined) pvpText += `**Accuracy:** ${pvp.accuracyPercent}%\n`;
                
                if (pvpText) {
                    embed.addFields({
                        name: "⚔️ PvP Statistics",
                        value: pvpText.trim(),
                        inline: true
                    });
                }
            }

            // Time section
            if (playerData.time && Object.keys(playerData.time).length > 0) {
                const time = playerData.time;
                let timeText = "";
                if (time.totalLifetime !== undefined) timeText += `**Total Playtime:** ${this.formatTime(time.totalLifetime)}\n`;
                if (time.sinceWipe !== undefined) timeText += `**Since Wipe:** ${this.formatTime(time.sinceWipe)}\n`;
                if (time.afkTime !== undefined) timeText += `**AFK Time:** ${this.formatTime(time.afkTime)}\n`;
                
                if (timeText) {
                    embed.addFields({
                        name: "⏰ Time Statistics",
                        value: timeText.trim(),
                        inline: true
                    });
                }
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error("❌ Error handling player stats command:", error);
            
            let errorMessage = "❌ An error occurred while fetching player statistics.";
            if (error.message === "Player not found") {
                errorMessage = "❌ Player not found. Make sure the Steam ID is correct.";
            } else if (error.message.includes("access")) {
                errorMessage = "❌ Cannot access leaderboard data files. Please contact an administrator.";
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
            // Check data directory access first
            if (!this.checkDataDirectoryAccess()) {
                return interaction.reply({
                    content: "❌ Leaderboard system is currently unavailable. Data directory not accessible.",
                    ephemeral: true,
                });
            }

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
                value: "• `/lb [category]` - View specific leaderboard\n• `/playerstats [steamid]` - View individual player stats\n• `/top3all` - View top 3 in all categories\n• `/playerrank [steamid]` - View player's rankings\n• `/findplayer [name]` - Search players by name",
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

    // Test file system access
    async testFileSystemAccess() {
        try {
            const accessible = this.checkDataDirectoryAccess();
            if (accessible) {
                // Try to read one file to test
                const testFile = path.join(this.dataDirectory, 'leaderboard_kills.json');
                if (fs.existsSync(testFile)) {
                    fs.readFileSync(testFile, 'utf8');
                    return true;
                }
            }
            return false;
        } catch (error) {
            console.error("❌ File system access test failed:", error);
            return false;
        }
    }

    // Get system status for debugging
    async getApiStatus() {
        try {
            const isAccessible = await this.testFileSystemAccess();
            return {
                status: isAccessible ? "Connected" : "Disconnected",
                url: this.dataDirectory,
                type: "File System",
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                status: "Error",
                url: this.dataDirectory,
                type: "File System",
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    // List available data files (for debugging)
    listAvailableFiles() {
        try {
            if (!fs.existsSync(this.dataDirectory)) {
                return [];
            }

            const files = fs.readdirSync(this.dataDirectory)
                .filter(file => file.startsWith('leaderboard_') && file.endsWith('.json'))
                .map(file => {
                    const filePath = path.join(this.dataDirectory, file);
                    const stats = fs.statSync(filePath);
                    return {
                        filename: file,
                        size: stats.size,
                        modified: stats.mtime
                    };
                });

            return files;
        } catch (error) {
            console.error("❌ Error listing data files:", error);
            return [];
        }
    }
}

module.exports = LeaderboardSystem;