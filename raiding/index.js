const {
    Client,
    GatewayIntentBits,
    SlashCommandBuilder,
    REST,
    Routes,
    EmbedBuilder,
} = require("discord.js");
const cron = require("node-cron");

// Bot configuration
const TOKEN =
    "";
const CLIENT_ID = "";
const GUILD_ID = ""; // Your Discord server ID
const GENERAL_CHANNEL_ID = "";

// Create Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

// Slash command definition
const commands = [
    new SlashCommandBuilder()
        .setName("curfew")
        .setDescription(
            "Check if raiding is currently allowed or when it will be allowed again",
        ),
];

// Function to get current GMT time
function getCurrentGMT() {
    const now = new Date();
    // Add 1 hour to UTC to get GMT (since server is UTC and GMT is UTC+1 currently)
    return new Date(now.getTime() + (1 * 60 * 60 * 1000));
}

// Function to check if raiding is currently allowed
function isRaidingAllowed() {
    const gmtTime = getCurrentGMT();
    const gmtHour = gmtTime.getUTCHours();

    // Raiding not allowed between 00:00 GMT and 08:00 GMT
    return gmtHour >= 8 && gmtHour < 24;
}

// Function to get time until raiding is allowed
function getTimeUntilRaidingAllowed() {
    const gmtTime = getCurrentGMT();
    const gmtHour = gmtTime.getUTCHours();
    const gmtMinute = gmtTime.getUTCMinutes();

    if (isRaidingAllowed()) {
        // Calculate time until next curfew (00:00 GMT)
        let hoursUntilCurfew = 24 - gmtHour;
        let minutesUntilCurfew = 60 - gmtMinute;
        
        if (minutesUntilCurfew === 60) {
            minutesUntilCurfew = 0;
        } else {
            hoursUntilCurfew--;
        }

        // Handle case where we're exactly at midnight
        if (hoursUntilCurfew === 24) {
            hoursUntilCurfew = 0;
        }

        return `Raiding is currently **ALLOWED**! Next curfew starts in ${hoursUntilCurfew}h ${minutesUntilCurfew}m`;
    } else {
        // Calculate time until curfew ends (08:00 GMT)
        let hoursUntilEnd = 8 - gmtHour;
        let minutesUntilEnd = 60 - gmtMinute;
        
        if (minutesUntilEnd === 60) {
            minutesUntilEnd = 0;
        } else {
            hoursUntilEnd--;
        }

        // Handle negative hours (shouldn't happen with correct logic)
        if (hoursUntilEnd < 0) {
            hoursUntilEnd += 24;
        }
        
        return `Raiding is currently **NOT ALLOWED**! Curfew ends in ${hoursUntilEnd}h ${minutesUntilEnd}m`;
    }
}

// Function to send curfew start reminder
async function sendCurfewStartReminder() {
    try {
        const channel = await client.channels.fetch(GENERAL_CHANNEL_ID);

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
        console.log("Curfew start reminder sent successfully");
    } catch (error) {
        console.error("Error sending curfew start reminder:", error);
    }
}

// Function to send curfew end reminder
async function sendCurfewEndReminder() {
    try {
        const channel = await client.channels.fetch(GENERAL_CHANNEL_ID);

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
        console.log("Curfew end reminder sent successfully");
    } catch (error) {
        console.error("Error sending curfew end reminder:", error);
    }
}

// Register slash commands
async function registerCommands() {
    try {
        const rest = new REST({ version: "10" }).setToken(TOKEN);

        console.log("Started refreshing application (/) commands.");

        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
            body: commands,
        });

        console.log("Successfully reloaded application (/) commands.");
    } catch (error) {
        console.error("Error registering commands:", error);
    }
}

// Bot ready event
client.once("ready", async () => {
    console.log(`${client.user.tag} is online and ready!`);

    // Register slash commands
    await registerCommands();

    // Schedule curfew start reminder (23:30 UTC = 00:30 GMT - 30 min before 01:00 GMT midnight)
    // This sends at 23:30 UTC which is 00:30 GMT, 30 minutes before curfew starts at 01:00 GMT
    cron.schedule(
        "30 23 * * *",
        () => {
            console.log("Triggering curfew start reminder...");
            sendCurfewStartReminder();
        },
        {
            timezone: "UTC",
        },
    );

    // Schedule curfew end reminder (06:30 UTC = 07:30 GMT - 30 min before 08:00 GMT)
    cron.schedule(
        "30 6 * * *",
        () => {
            console.log("Triggering curfew end reminder...");
            sendCurfewEndReminder();
        },
        {
            timezone: "UTC",
        },
    );

    console.log("Cron jobs scheduled successfully!");
    console.log("- Curfew start reminder: 23:30 UTC (00:30 GMT) daily");
    console.log("- Curfew end reminder: 06:30 UTC (07:30 GMT) daily");
});

// Handle slash command interactions
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === "curfew") {
        try {
            const statusMessage = getTimeUntilRaidingAllowed();
            const gmtTime = getCurrentGMT();
            const currentTimeGMT = gmtTime.toISOString().replace("T", " ").slice(0, 19) + " GMT";

            const embed = new EmbedBuilder()
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

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error("Error handling curfew command:", error);
            await interaction.reply({
                content:
                    "Sorry, there was an error checking the curfew status. Please try again later.",
                ephemeral: true,
            });
        }
    }
});

// Error handling
client.on("error", (error) => {
    console.error("Discord client error:", error);
});

process.on("unhandledRejection", (error) => {
    console.error("Unhandled promise rejection:", error);
});

// Login to Discord
client.login(TOKEN);
