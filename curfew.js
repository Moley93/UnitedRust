// Raid Curfew System for UnitedRust Discord Bot
const { EmbedBuilder } = require("discord.js");
const cron = require("node-cron");

class CurfewSystem {
    constructor(client, config) {
        this.client = client;
        this.config = config;
    }

    // Function to get current GMT time
    getCurrentGMT() {
        const now = new Date();
        return new Date(now.getTime() + 1 * 60 * 60 * 1000);
    }

    // Function to check if raiding is currently allowed
    isRaidingAllowed() {
        const gmtTime = this.getCurrentGMT();
        const gmtHour = gmtTime.getUTCHours();
        return gmtHour >= 8 && gmtHour < 24;
    }

    // Function to get time until raiding is allowed
    getTimeUntilRaidingAllowed() {
        const gmtTime = this.getCurrentGMT();
        const gmtHour = gmtTime.getUTCHours();
        const gmtMinute = gmtTime.getUTCMinutes();

        if (this.isRaidingAllowed()) {
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
    async sendCurfewStartReminder() {
        try {
            const channel = await this.client.channels.fetch(this.config.generalChannelId);

            const embed = new EmbedBuilder()
                .setColor("#FF0000")
                .setTitle("🚫 Raid Curfew Starting Soon!")
                .setDescription(
                    "**Raid Curfew Reminder**\n\nRemember, we do not allow raiding between the hours of 00:00GMT and 08:00GMT. We actively monitor this and raiding during these times may result in an instant ban! We have implemented this rule for the good of the entire community."
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
                    }
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
    async sendCurfewEndReminder() {
        try {
            const channel = await this.client.channels.fetch(this.config.generalChannelId);

            const embed = new EmbedBuilder()
                .setColor("#00FF00")
                .setTitle("✅ Raid Curfew Ending Soon!")
                .setDescription(
                    "**Curfew End Reminder**\n\nThe raid curfew will be ending in 30 minutes! You will be able to start raiding again soon."
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
                    }
                )
                .setTimestamp()
                .setFooter({ text: "UnitedRust Server" });

            await channel.send({ embeds: [embed] });
            console.log("✅ Curfew end reminder sent successfully");
        } catch (error) {
            console.error("❌ Error sending curfew end reminder:", error);
        }
    }

    // Handle curfew command
    async handleCurfewCommand(interaction) {
        try {
            const statusMessage = this.getTimeUntilRaidingAllowed();
            const gmtTime = this.getCurrentGMT();
            const currentTimeGMT = gmtTime.toISOString().replace("T", " ").slice(0, 19) + " GMT";

            const curfewEmbed = new EmbedBuilder()
                .setColor(this.isRaidingAllowed() ? "#00FF00" : "#FF0000")
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
                    }
                )
                .setTimestamp()
                .setFooter({ text: "UnitedRust Server" });

            await interaction.reply({ embeds: [curfewEmbed] });
        } catch (error) {
            console.error("❌ Error handling curfew command:", error);
            await interaction.reply({
                content: "❌ Error checking curfew status.",
                ephemeral: true,
            });
        }
    }

    // Schedule curfew reminders
    scheduleCurfewReminders() {
        // Schedule curfew start reminder (23:30 UTC = 23:30 GMT)
        cron.schedule(
            "30 23 * * *",
            () => {
                console.log("⏰ Triggering curfew start reminder...");
                this.sendCurfewStartReminder();
            },
            { timezone: "UTC" }
        );

        // Schedule curfew end reminder (06:30 UTC = 07:30 GMT)
        cron.schedule(
            "30 6 * * *",
            () => {
                console.log("⏰ Triggering curfew end reminder...");
                this.sendCurfewEndReminder();
            },
            { timezone: "UTC" }
        );

        console.log("🕒 Curfew reminders scheduled successfully!");
        console.log("- Curfew start reminder: 23:30 UTC (00:30 GMT) daily");
        console.log("- Curfew end reminder: 06:30 UTC (07:30 GMT) daily");
    }
}

module.exports = CurfewSystem;