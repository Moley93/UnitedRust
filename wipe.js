// Wipe Countdown System for UnitedRust Discord Bot - UPDATED FOR MONTHLY WIPES
const { EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const cron = require("node-cron");

class WipeSystem {
    constructor(client, config) {
        this.client = client;
        this.config = config;
        this.wipeDay = 4; // Thursday (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
        this.wipeHour = 19; // 7 PM GMT
        this.wipeMinute = 0; // 00 minutes
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
            
            const embed = new EmbedBuilder()
                .setColor("#FF6B35") // Orange color
                .setTitle("🔄 UnitedRust Monthly Server Wipe Countdown")
                .setDescription(
                    `**Get ready, survivors!** The ${wipeMonth} server wipe is approaching fast!\n\n` +
                    "Time to make those final pushes, secure your loot, and prepare for a fresh start on the island!"
                )
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
                        name: "📅 Wipe Schedule",
                        value: this.getWipeScheduleDescription(),
                        inline: true,
                    },
                    {
                        name: "🗓️ This Month's Wipe",
                        value: `${wipeMonth} ${nextWipe.getUTCDate()}, ${nextWipe.getUTCFullYear()}`,
                        inline: true,
                    },
                    {
                        name: "🎯 What to Expect",
                        value: "• Fresh server start\n• All bases and progress reset\n• New opportunities for everyone\n• Updated server features",
                        inline: false,
                    },
                    {
                        name: "💡 Pro Tips",
                        value: "• Take screenshots of your best builds\n• Enjoy the final hours of this wipe\n• Plan your spawn location for next wipe\n• Check Discord for any wipe day updates",
                        inline: false,
                    }
                )
                .setThumbnail("https://via.placeholder.com/128x128/FF6B35/FFFFFF?text=🔄")
                .setTimestamp()
                .setFooter({ text: "UnitedRust - Monthly Fresh Starts, New Adventures!" });

            await channel.send({ embeds: [embed] });
            console.log(`✅ Monthly wipe countdown announcement sent successfully (${wipeMonth} wipe)`);
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
            
            const embed = new EmbedBuilder()
                .setColor("#FF6B35")
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
                        inline: false,
                    },
                    {
                        name: "ℹ️ What Gets Wiped",
                        value: "• All player bases and structures\n• Player inventories and items\n• Map progression and monuments\n• Team compositions (if applicable)",
                        inline: false,
                    },
                    {
                        name: "📊 Monthly Wipe Benefits",
                        value: "• More time to build and establish\n• Better long-term planning opportunities\n• Reduced server lag from accumulated builds\n• Fresh monthly challenges and goals",
                        inline: false,
                    }
                )
                .setTimestamp()
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
    }

    // Send custom wipe announcement
    async sendCustomWipeAnnouncement(customDate = null, customMessage = null) {
        try {
            const channel = await this.client.channels.fetch(this.config.generalChannelId);
            const wipeDate = customDate || this.getNextWipeDate();
            const now = new Date();
            const timeDiff = wipeDate.getTime() - now.getTime();
            const wipeMonth = this.getMonthName(wipeDate.getUTCMonth());
            
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
            
            const embed = new EmbedBuilder()
                .setColor("#FF6B35")
                .setTitle("🔄 UnitedRust Monthly Server Wipe Countdown")
                .setDescription(
                    customMessage || 
                    `**Get ready, survivors!** The ${wipeMonth} server wipe is approaching fast!\n\n` +
                    "Time to make those final pushes, secure your loot, and prepare for a fresh start on the island!"
                )
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
                        name: "📅 Wipe Schedule",
                        value: this.getWipeScheduleDescription(),
                        inline: true,
                    },
                    {
                        name: "🗓️ This Month's Wipe",
                        value: `${wipeMonth} ${wipeDate.getUTCDate()}, ${wipeDate.getUTCFullYear()}`,
                        inline: true,
                    },
                    {
                        name: "🎯 What to Expect",
                        value: "• Fresh server start\n• All bases and progress reset\n• New opportunities for everyone\n• Updated server features",
                        inline: false,
                    }
                )
                .setThumbnail("https://via.placeholder.com/128x128/FF6B35/FFFFFF?text=🔄")
                .setTimestamp()
                .setFooter({ text: "UnitedRust - Monthly Fresh Starts, New Adventures!" });

            await channel.send({ embeds: [embed] });
            console.log(`✅ Custom monthly wipe announcement sent successfully (${wipeMonth} wipe)`);
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
                wipeDates.push({
                    date: wipeDate,
                    month: this.getMonthName(currentMonth),
                    year: currentYear,
                    day: wipeDate.getUTCDate()
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