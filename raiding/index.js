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
    "MTM3NTk3Nzc2NDQzNTUyNTc5NA.GT4H6D.j240J4dZLCq2REs3J7k4RApDKQ6XU4o4pOIcw0";
const CLIENT_ID = "1375977764435525794";
const GUILD_ID = "1375970038418247770"; // Your Discord server ID
const GENERAL_CHANNEL_ID = "1375970039357902984";

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

// Function to check if raiding is currently allowed
function isRaidingAllowed() {
    const now = new Date();
    const utcHour = now.getUTCHours();
    const utcMinute = now.getUTCMinutes();

    // Raiding not allowed between 11:50 GMT and 11:52 GMT
    if (utcHour === 11 && utcMinute >= 50) {
        return false;
    }
    if (utcHour === 11 && utcMinute < 52) {
        return utcMinute < 50;
    }

    return true;
}

// Function to get time until raiding is allowed
function getTimeUntilRaidingAllowed() {
    const now = new Date();
    const utcHour = now.getUTCHours();
    const utcMinute = now.getUTCMinutes();

    if (isRaidingAllowed()) {
        // Calculate time until next curfew (23:00 GMT)
        let hoursUntilCurfew, minutesUntilCurfew;

        if (utcHour < 11 || (utcHour === 23 && utcMinute < 00)) {
            // Same day
            hoursUntilCurfew = 11 - utcHour;
            minutesUntilCurfew = 50 - utcMinute;
            if (minutesUntilCurfew <= 0) {
                hoursUntilCurfew--;
                minutesUntilCurfew += 60;
            }
        } else {
            // Next day
            hoursUntilCurfew = 24 - utcHour + 11;
            minutesUntilCurfew = 50 - utcMinute;
            if (minutesUntilCurfew <= 0) {
                hoursUntilCurfew--;
                minutesUntilCurfew += 60;
            }
        }

        return `Raiding is currently **ALLOWED**! Next curfew starts in ${hoursUntilCurfew}h ${minutesUntilCurfew}m`;
    } else {
        // Calculate time until curfew ends (00:00 GMT)
        const minutesUntilEnd = 52 - utcMinute;
        return `Raiding is currently **NOT ALLOWED**! Curfew ends in ${minutesUntilEnd} minutes`;
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

    // Schedule curfew start reminder (11:20 GMT daily - 30 min before 11:50)
    cron.schedule(
        "34 23 * * *",
        () => {
            console.log("Triggering curfew start reminder...");
            sendCurfewStartReminder();
        },
        {
            timezone: "GMT",
        },
    );

    // Schedule curfew end reminder (11:22 GMT daily - 30 min before 11:52)
    cron.schedule(
        "35 23 * * *",
        () => {
            console.log("Triggering curfew end reminder...");
            sendCurfewEndReminder();
        },
        {
            timezone: "GMT",
        },
    );

    console.log("Cron jobs scheduled successfully!");
    console.log("- Curfew start reminder: 00:04 GMT daily");
    console.log("- Curfew end reminder: 00:05 GMT daily");
});

// Handle slash command interactions
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === "curfew") {
        try {
            const statusMessage = getTimeUntilRaidingAllowed();
            const currentTime =
                new Date().toISOString().replace("T", " ").slice(0, 19) +
                " GMT";

            const embed = new EmbedBuilder()
                .setColor(isRaidingAllowed() ? "#00FF00" : "#FF0000")
                .setTitle("🏴‍☠️ Raid Curfew Status")
                .setDescription(statusMessage)
                .addFields(
                    {
                        name: "🕐 Current Time (GMT)",
                        value: currentTime,
                        inline: true,
                    },
                    {
                        name: "🚫 Curfew Hours",
                        value: "00:04 GMT - 00:05 GMT",
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
