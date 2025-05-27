// Wipe Countdown System for UnitedRust Discord Bot
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

    // Calculate next wipe date
    getNextWipeDate() {
        const now = new Date();
        const currentDay = now.getUTCDay();
        const currentHour = now.getUTCHours();
        const currentMinute = now.getUTCMinutes();
        
        // Calculate days until next Thursday
        let daysUntilWipe = (this.wipeDay - currentDay + 7) % 7;
        
        // If it's Thursday but past wipe time, or if it's exactly Thursday at wipe time
        if (daysUntilWipe === 0) {
            if (currentHour > this.wipeHour || (currentHour === this.wipeHour && currentMinute >= this.wipeMinute)) {
                daysUntilWipe = 7; // Next Thursday
            }
        }
        
        const nextWipe = new Date(now);
        nextWipe.setUTCDate(now.getUTCDate() + daysUntilWipe);
        nextWipe.setUTCHours(this.wipeHour, this.wipeMinute, 0, 0);
        
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

    // Send wipe countdown announcement
    async sendWipeAnnouncement() {
        try {
            const channel = await this.client.channels.fetch(this.config.generalChannelId);
            const nextWipe = this.getNextWipeDate();
            const timeUntilWipe = this.getTimeUntilWipe();
            
            const embed = new EmbedBuilder()
                .setColor("#FF6B35") // Orange color
                .setTitle("🔄 UnitedRust Server Wipe Countdown")
                .setDescription(
                    "**Get ready, survivors!** The next server wipe is approaching fast!\n\n" +
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
                        value: "Every Thursday at 7:00 PM GMT",
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
                .setFooter({ text: "UnitedRust - Fresh Starts, New Adventures!" });

            await channel.send({ embeds: [embed] });
            console.log("✅ Wipe countdown announcement sent successfully");
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
            
            const embed = new EmbedBuilder()
                .setColor("#FF6B35")
                .setTitle("🔄 Server Wipe Information")
                .setDescription("Here's everything you need to know about the next server wipe!")
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
                        name: "📅 Wipe Schedule",
                        value: "Every Thursday at 7:00 PM GMT",
                        inline: false,
                    },
                    {
                        name: "ℹ️ What Gets Wiped",
                        value: "• All player bases and structures\n• Player inventories and items\n• Map progression and monuments\n• Team compositions (if applicable)",
                        inline: false,
                    }
                )
                .setTimestamp()
                .setFooter({ text: "UnitedRust Server Information" });

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
                content: "✅ Wipe countdown announcement has been sent!",
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
                console.log("🔄 Triggering morning wipe announcement...");
                this.sendWipeAnnouncement();
            },
            { timezone: "UTC" }
        );

        // Schedule wipe announcement at 8:00 PM GMT daily
        cron.schedule(
            "0 20 * * *",
            () => {
                console.log("🔄 Triggering evening wipe announcement...");
                this.sendWipeAnnouncement();
            },
            { timezone: "UTC" }
        );

        console.log("🔄 Wipe announcements scheduled successfully!");
        console.log("- Morning announcement: 08:00 GMT daily");
        console.log("- Evening announcement: 20:00 GMT daily");
    }

    // Send custom wipe announcement
    async sendCustomWipeAnnouncement(customDate = null, customMessage = null) {
        try {
            const channel = await this.client.channels.fetch(this.config.generalChannelId);
            const wipeDate = customDate || this.getNextWipeDate();
            const now = new Date();
            const timeDiff = wipeDate.getTime() - now.getTime();
            
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
                .setTitle("🔄 UnitedRust Server Wipe Countdown")
                .setDescription(
                    customMessage || 
                    "**Get ready, survivors!** The next server wipe is approaching fast!\n\n" +
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
                        value: "Every Thursday at 7:00 PM GMT",
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
                .setFooter({ text: "UnitedRust - Fresh Starts, New Adventures!" });

            await channel.send({ embeds: [embed] });
            console.log("✅ Custom wipe announcement sent successfully");
        } catch (error) {
            console.error("❌ Error sending custom wipe announcement:", error);
        }
    }
}

module.exports = WipeSystem;