// Wipe Countdown System for UnitedRust Discord Bot - UPDATED FOR MONTHLY WIPES WITH QUARTERLY BP WIPES
const { EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const cron = require("node-cron");

class WipeSystem {
    constructor(client, config) {
        this.client = client;
        this.config = config;
        this.wipeDay = 4; // Thursday (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
        this.wipeHour = 19; // 7 PM GMT
        this.wipeMinute = 0; // 00 minutes
        this.mapVoteChannelId = "1371918369946734602"; // Map vote channel ID
    }

    // Calculate the first Thursday of a given month/year
    getFirstThursdayOfMonth(year, month) {
        // month is 0-indexed (0 = January, 1 = February, etc.)
        const firstDayOfMonth = new Date(year, month, 1);
        const firstDayWeekday = firstDayOfMonth.getUTCDay(); // 0 = Sunday, 1 = Monday, etc.
        
        // Calculate days to add to get to first Thursday
        // If first day is Thursday (4), then first Thursday is day 1
        // If first day is Friday (5), then first Thursday is day 7 (next week)
        // If first day is Saturday (6), then first Thursday is day 6
        // If first day is Sunday (0), then first Thursday is day 5
        // If first day is Monday (1), then first Thursday is day 4
        // If first day is Tuesday (2), then first Thursday is day 3
        // If first day is Wednesday (3), then first Thursday is day 2
        
        let daysToAdd;
        if (firstDayWeekday <= 4) {
            // If the first day is Sunday through Thursday
            daysToAdd = 4 - firstDayWeekday;
        } else {
            // If the first day is Friday or Saturday
            daysToAdd = 7 - firstDayWeekday + 4;
        }
        
        const firstThursday = new Date(year, month, 1 + daysToAdd);
        firstThursday.setUTCHours(this.wipeHour, this.wipeMinute, 0, 0);
        
        return firstThursday;
    }

    // Calculate next wipe date (first Thursday of next month)
    getNextWipeDate() {
        const now = new Date();
        const currentYear = now.getUTCFullYear();
        const currentMonth = now.getUTCMonth();
        
        // Get first Thursday of current month
        let nextWipe = this.getFirstThursdayOfMonth(currentYear, currentMonth);
        
        // If we've already passed this month's wipe, get next month's
        if (now >= nextWipe) {
            const nextMonth = currentMonth + 1;
            const nextYear = nextMonth > 11 ? currentYear + 1 : currentYear;
            const adjustedMonth = nextMonth > 11 ? 0 : nextMonth;
            
            nextWipe = this.getFirstThursdayOfMonth(nextYear, adjustedMonth);
        }
        
        return nextWipe;
    }

    // Check if the next wipe is a BP wipe (every 3 months: January, April, July, October)
    isNextWipeBPWipe() {
        const nextWipe = this.getNextWipeDate();
        const wipeMonth = nextWipe.getUTCMonth(); // 0-indexed
        
        // BP wipes happen in January (0), April (3), July (6), October (9)
        return [0, 3, 6, 9].includes(wipeMonth);
    }

    // Get next BP wipe date
    getNextBPWipeDate() {
        const now = new Date();
        const currentYear = now.getUTCFullYear();
        let currentMonth = now.getUTCMonth();
        
        // Find the next BP wipe month (January, April, July, October)
        const bpWipeMonths = [0, 3, 6, 9]; // January, April, July, October
        
        let nextBPWipeMonth = bpWipeMonths.find(month => {
            const wipeDate = this.getFirstThursdayOfMonth(currentYear, month);
            return wipeDate > now;
        });
        
        let nextBPWipeYear = currentYear;
        
        // If no BP wipe found this year, get January of next year
        if (nextBPWipeMonth === undefined) {
            nextBPWipeMonth = 0; // January
            nextBPWipeYear = currentYear + 1;
        }
        
        return this.getFirstThursdayOfMonth(nextBPWipeYear, nextBPWipeMonth);
    }

    // Get time remaining until next wipe
    getTimeUntilWipe() {
        const now = new Date();
        const nextWipe = this.getNextWipeDate();
        const timeDiff = nextWipe.getTime() - now.getTime();
        
        if (timeDiff <= 0) {
            return "Wipe is happening now!";
        }
        
        const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
        
        let timeString = "";
        if (days > 0) timeString += `${days}d `;
        if (hours > 0) timeString += `${hours}h `;
        if (minutes > 0) timeString += `${minutes}m`;
        
        return timeString.trim() || "Less than a minute";
    }

    // Get a user-friendly description of when wipes occur
    getWipeScheduleDescription() {
        return "First Thursday of every month at 7:00 PM GMT";
    }

    // Get a user-friendly description of when BP wipes occur
    getBPWipeScheduleDescription() {
        return "Blueprint wipes: Every 3 months (January, April, July, October)";
    }

    // Get the month name for display
    getMonthName(monthIndex) {
        const months = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
        ];
        return months[monthIndex];
    }

    // Send wipe countdown announcement
    async sendWipeAnnouncement() {
        try {
            const channel = await this.client.channels.fetch(this.config.generalChannelId);
            const nextWipe = this.getNextWipeDate();
            const timeUntilWipe = this.getTimeUntilWipe();
            const wipeMonth = this.getMonthName(nextWipe.getUTCMonth());
            const isBPWipe = this.isNextWipeBPWipe();
            const nextBPWipe = this.getNextBPWipeDate();
            
            // Determine wipe type and color
            const wipeType = isBPWipe ? "Map + Blueprint Wipe" : "Map Wipe Only";
            const wipeColor = isBPWipe ? "#FF0000" : "#FF6B35"; // Red for BP wipe, Orange for map only
            const wipeEmoji = isBPWipe ? "🔄💎" : "🔄";
            
            let wipeDescription;
            if (isBPWipe) {
                wipeDescription = `**ATTENTION SURVIVORS!** This is a **BLUEPRINT WIPE** month!\n\n` +
                    `The ${wipeMonth} server wipe will reset both the map AND all blueprints. ` +
                    `Time to make those final pushes and prepare for a completely fresh start!`;
            } else {
                wipeDescription = `**Get ready, survivors!** The ${wipeMonth} server wipe is approaching fast!\n\n` +
                    `This is a **map-only wipe** - your blueprints will be preserved! ` +
                    `Time to make those final pushes, secure your loot, and prepare for a fresh start on the island!`;
            }
            
            const embed = new EmbedBuilder()
                .setColor(wipeColor)
                .setTitle(`${wipeEmoji} UnitedRust Monthly Server Wipe Countdown`)
                .setDescription(wipeDescription)
                .addFields(
                    {
                        name: "⏰ Next Wipe Date",
                        value: `<t:${Math.floor(nextWipe.getTime() / 1000)}:F>`,
                        inline: true,
                    },
                    {
                        name: "⏳ Time Remaining",
                        value: timeUntilWipe,
                        inline: true,
                    },
                    {
                        name: "🔄 Wipe Type",
                        value: wipeType,
                        inline: true,
                    },
                    {
                        name: "🗓️ This Month's Wipe",
                        value: `${wipeMonth} ${nextWipe.getUTCDate()}, ${nextWipe.getUTCFullYear()}`,
                        inline: true,
                    },
                    {
                        name: "📅 Wipe Schedule",
                        value: this.getWipeScheduleDescription(),
                        inline: true,
                    },
                    {
                        name: "💎 Blueprint Wipes",
                        value: this.getBPWipeScheduleDescription(),
                        inline: true,
                    }
                );

            // Add different content based on wipe type
            if (isBPWipe) {
                embed.addFields(
                    {
                        name: "🎯 What Gets Wiped",
                        value: "• All player bases and structures\n• Player inventories and items\n• **ALL BLUEPRINTS** (fresh research needed)\n• Map progression and monuments",
                        inline: false,
                    },
                    {
                        name: "💡 Pro Tips for BP Wipe",
                        value: "• Take screenshots of your best builds\n• Note down your favorite base designs\n• **Plan your base location** for next wipe\n• Research priority items first after wipe\n• Check <#" + this.mapVoteChannelId + "> for the new map!",
                        inline: false,
                    }
                );
            } else {
                embed.addFields(
                    {
                        name: "🎯 What Gets Wiped",
                        value: "• All player bases and structures\n• Player inventories and items\n• Map progression and monuments\n• **Blueprints are PRESERVED** ✅",
                        inline: false,
                    },
                    {
                        name: "💡 Pro Tips",
                        value: "• Take screenshots of your best builds\n• Enjoy the final hours of this wipe\n• **Plan your base location** for next wipe\n• Your blueprints will carry over!\n• Check <#" + this.mapVoteChannelId + "> for the new map!",
                        inline: false,
                    }
                );
            }

            // Add next BP wipe info if this isn't a BP wipe
            if (!isBPWipe) {
                const nextBPWipeMonth = this.getMonthName(nextBPWipe.getUTCMonth());
                embed.addFields({
                    name: "💎 Next Blueprint Wipe",
                    value: `${nextBPWipeMonth} ${nextBPWipe.getUTCFullYear()} (${nextBPWipeMonth} ${nextBPWipe.getUTCDate()})`,
                    inline: false,
                });
            }

            embed.addFields({
                name: "🗺️ Map Vote",
                value: `Don't forget to vote for the next map in <#${this.mapVoteChannelId}>!`,
                inline: false,
            });

            embed.setThumbnail("https://via.placeholder.com/128x128/FF6B35/FFFFFF?text=🔄")
                .setTimestamp()
                .setFooter({ text: "UnitedRust - Monthly Fresh Starts, New Adventures!" });

            await channel.send({ embeds: [embed] });
            console.log(`✅ Monthly wipe countdown announcement sent successfully (${wipeMonth} ${wipeType})`);
        } catch (error) {
            console.error("❌ Error sending wipe announcement:", error);
        }
    }

    // Handle wipe command
    async handleWipeCommand(interaction) {
        try {
            const nextWipe = this.getNextWipeDate();
            const timeUntilWipe = this.getTimeUntilWipe();
            const now = new Date();
            const wipeMonth = this.getMonthName(nextWipe.getUTCMonth());
            const isBPWipe = this.isNextWipeBPWipe();
            const nextBPWipe = this.getNextBPWipeDate();
            
            const wipeType = isBPWipe ? "Map + Blueprint Wipe" : "Map Wipe Only";
            const wipeColor = isBPWipe ? "#FF0000" : "#FF6B35";
            
            const embed = new EmbedBuilder()
                .setColor(wipeColor)
                .setTitle("🔄 Monthly Server Wipe Information")
                .setDescription("Here's everything you need to know about the next monthly server wipe!")
                .addFields(
                    {
                        name: "⏰ Next Wipe",
                        value: `<t:${Math.floor(nextWipe.getTime() / 1000)}:F>`,
                        inline: true,
                    },
                    {
                        name: "⏳ Time Remaining",
                        value: timeUntilWipe,
                        inline: true,
                    },
                    {
                        name: "🔄 Wipe Type",
                        value: wipeType,
                        inline: true,
                    },
                    {
                        name: "🕐 Current Time (GMT)",
                        value: `<t:${Math.floor(now.getTime() / 1000)}:f>`,
                        inline: true,
                    },
                    {
                        name: "🗓️ This Month's Wipe",
                        value: `${wipeMonth} ${nextWipe.getUTCDate()}, ${nextWipe.getUTCFullYear()}`,
                        inline: true,
                    },
                    {
                        name: "📅 Wipe Schedule",
                        value: this.getWipeScheduleDescription(),
                        inline: true,
                    },
                    {
                        name: "💎 Blueprint Wipe Schedule",
                        value: this.getBPWipeScheduleDescription(),
                        inline: false,
                    }
                );

            // Add different information based on wipe type
            if (isBPWipe) {
                embed.addFields(
                    {
                        name: "ℹ️ What Gets Wiped (BP Wipe)",
                        value: "• All player bases and structures\n• Player inventories and items\n• **ALL BLUEPRINTS** (complete reset)\n• Map progression and monuments\n• Team compositions (if applicable)",
                        inline: false,
                    },
                    {
                        name: "🔄 Blueprint Wipe Benefits",
                        value: "• Complete fresh start for all players\n• Equal footing for everyone\n• New research progression challenges\n• Renewed early-game excitement",
                        inline: false,
                    }
                );
            } else {
                embed.addFields(
                    {
                        name: "ℹ️ What Gets Wiped (Map Only)",
                        value: "• All player bases and structures\n• Player inventories and items\n• Map progression and monuments\n• **Blueprints are PRESERVED** ✅\n• Team compositions (if applicable)",
                        inline: false,
                    },
                    {
                        name: "📊 Map Wipe Benefits",
                        value: "• Fresh building opportunities\n• Keep your blueprint progress\n• Faster progression with known BPs\n• Focus on base building and PvP",
                        inline: false,
                    },
                    {
                        name: "💎 Next Blueprint Wipe",
                        value: `<t:${Math.floor(nextBPWipe.getTime() / 1000)}:F>`,
                        inline: false,
                    }
                );
            }

            embed.addFields({
                name: "🗺️ Map Vote",
                value: `Vote for the next map in <#${this.mapVoteChannelId}>!`,
                inline: false,
            });

            embed.setTimestamp()
                .setFooter({ text: "UnitedRust Monthly Server Information" });

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error("❌ Error handling wipe command:", error);
            await interaction.reply({
                content: "❌ Error checking wipe information.",
                ephemeral: true,
            });
        }
    }

    // Handle manual wipe announcement command
    async handleSendWipeAnnouncementCommand(interaction) {
        try {
            const { member } = interaction;

            if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({
                    content: "❌ You need Administrator permissions to use this command.",
                    ephemeral: true,
                });
            }

            await this.sendWipeAnnouncement();
            await interaction.reply({
                content: "✅ Monthly wipe countdown announcement has been sent!",
                ephemeral: true,
            });
        } catch (error) {
            console.error("❌ Error handling send wipe announcement command:", error);
            await interaction.reply({
                content: "❌ Error sending wipe announcement.",
                ephemeral: true,
            });
        }
    }

    // Schedule wipe announcements - 8 AM and 8 PM GMT daily
    scheduleWipeAnnouncements() {
        // Schedule wipe announcement at 8:00 AM GMT daily
        cron.schedule(
            "0 8 * * *",
            () => {
                console.log("🔄 Triggering morning monthly wipe announcement...");
                this.sendWipeAnnouncement();
            },
            { timezone: "UTC" }
        );

        // Schedule wipe announcement at 8:00 PM GMT daily
        cron.schedule(
            "0 20 * * *",
            () => {
                console.log("🔄 Triggering evening monthly wipe announcement...");
                this.sendWipeAnnouncement();
            },
            { timezone: "UTC" }
        );

        console.log("🔄 Monthly wipe announcements scheduled successfully!");
        console.log("- Morning announcement: 08:00 GMT daily");
        console.log("- Evening announcement: 20:00 GMT daily");
        console.log("- Wipe schedule: First Thursday of every month at 19:00 GMT");
        console.log("- BP wipe schedule: Every 3 months (January, April, July, October)");
    }

    // Send custom wipe announcement
    async sendCustomWipeAnnouncement(customDate = null, customMessage = null) {
        try {
            const channel = await this.client.channels.fetch(this.config.generalChannelId);
            const wipeDate = customDate || this.getNextWipeDate();
            const now = new Date();
            const timeDiff = wipeDate.getTime() - now.getTime();
            const wipeMonth = this.getMonthName(wipeDate.getUTCMonth());
            const isBPWipe = customDate ? [0, 3, 6, 9].includes(wipeDate.getUTCMonth()) : this.isNextWipeBPWipe();
            
            let timeUntilWipe = "Wipe is happening now!";
            if (timeDiff > 0) {
                const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
                const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
                
                let timeString = "";
                if (days > 0) timeString += `${days}d `;
                if (hours > 0) timeString += `${hours}h `;
                if (minutes > 0) timeString += `${minutes}m`;
                
                timeUntilWipe = timeString.trim() || "Less than a minute";
            }
            
            const wipeType = isBPWipe ? "Map + Blueprint Wipe" : "Map Wipe Only";
            const wipeColor = isBPWipe ? "#FF0000" : "#FF6B35";
            const wipeEmoji = isBPWipe ? "🔄💎" : "🔄";
            
            let defaultMessage;
            if (isBPWipe) {
                defaultMessage = `**ATTENTION SURVIVORS!** This is a **BLUEPRINT WIPE** month!\n\n` +
                    `The ${wipeMonth} server wipe will reset both the map AND all blueprints. ` +
                    `Time to make those final pushes and prepare for a completely fresh start!`;
            } else {
                defaultMessage = `**Get ready, survivors!** The ${wipeMonth} server wipe is approaching fast!\n\n` +
                    `This is a **map-only wipe** - your blueprints will be preserved! ` +
                    `Time to make those final pushes, secure your loot, and prepare for a fresh start on the island!`;
            }
            
            const embed = new EmbedBuilder()
                .setColor(wipeColor)
                .setTitle(`${wipeEmoji} UnitedRust Monthly Server Wipe Countdown`)
                .setDescription(customMessage || defaultMessage)
                .addFields(
                    {
                        name: "⏰ Next Wipe Date",
                        value: `<t:${Math.floor(wipeDate.getTime() / 1000)}:F>`,
                        inline: true,
                    },
                    {
                        name: "⏳ Time Remaining",
                        value: timeUntilWipe,
                        inline: true,
                    },
                    {
                        name: "🔄 Wipe Type",
                        value: wipeType,
                        inline: true,
                    },
                    {
                        name: "🗓️ This Month's Wipe",
                        value: `${wipeMonth} ${wipeDate.getUTCDate()}, ${wipeDate.getUTCFullYear()}`,
                        inline: true,
                    },
                    {
                        name: "📅 Wipe Schedule",
                        value: this.getWipeScheduleDescription(),
                        inline: true,
                    },
                    {
                        name: "💎 Blueprint Wipes",
                        value: this.getBPWipeScheduleDescription(),
                        inline: true,
                    },
                    {
                        name: "🎯 What to Expect",
                        value: isBPWipe ? 
                            "• Fresh server start\n• All bases and progress reset\n• **Complete blueprint reset**\n• Updated server features" :
                            "• Fresh server start\n• All bases and progress reset\n• **Blueprints preserved**\n• Updated server features",
                        inline: false,
                    },
                    {
                        name: "🗺️ Map Vote",
                        value: `Don't forget to vote for the next map in <#${this.mapVoteChannelId}>!`,
                        inline: false,
                    }
                )
                .setThumbnail("https://via.placeholder.com/128x128/FF6B35/FFFFFF?text=🔄")
                .setTimestamp()
                .setFooter({ text: "UnitedRust - Monthly Fresh Starts, New Adventures!" });

            await channel.send({ embeds: [embed] });
            console.log(`✅ Custom monthly wipe announcement sent successfully (${wipeMonth} ${wipeType})`);
        } catch (error) {
            console.error("❌ Error sending custom wipe announcement:", error);
        }
    }

    // Utility method to get next few wipe dates (for testing/admin purposes)
    getUpcomingWipeDates(count = 6) {
        const wipeDates = [];
        const now = new Date();
        let currentYear = now.getUTCFullYear();
        let currentMonth = now.getUTCMonth();
        
        for (let i = 0; i < count; i++) {
            const wipeDate = this.getFirstThursdayOfMonth(currentYear, currentMonth);
            
            // Only include future dates
            if (wipeDate > now) {
                const isBPWipe = [0, 3, 6, 9].includes(currentMonth); // January, April, July, October
                wipeDates.push({
                    date: wipeDate,
                    month: this.getMonthName(currentMonth),
                    year: currentYear,
                    day: wipeDate.getUTCDate(),
                    isBPWipe: isBPWipe,
                    wipeType: isBPWipe ? "Map + Blueprint Wipe" : "Map Wipe Only"
                });
            }
            
            // Move to next month
            currentMonth++;
            if (currentMonth > 11) {
                currentMonth = 0;
                currentYear++;
            }
        }
        
        return wipeDates.slice(0, count);
    }
}

module.exports = WipeSystem;