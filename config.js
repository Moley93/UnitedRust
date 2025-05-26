// Configuration module for UnitedRust Discord Bot
require('dotenv').config();

const config = {
    // Discord Bot Configuration
    token: process.env.DISCORD_TOKEN || process.env["DISCORD_TOKEN"] || "",
    clientId: process.env.CLIENT_ID || process.env["CLIENT_ID"] || "",
    guildId: process.env.GUILD_ID || process.env["GUILD_ID"] || "",

    // Raid curfew config
    generalChannelId: process.env.GENERAL_CHANNEL_ID || process.env["GENERAL_CHANNEL_ID"] || "",

    // Tickets config
    ticketCategoryId: process.env.TICKET_CATEGORY_ID || process.env["TICKET_CATEGORY_ID"] || "",
    moderatorRoleId: process.env.MODERATOR_ROLE_ID || process.env["MODERATOR_ROLE_ID"] || "",
    ticketChannelId: process.env.TICKET_CHANNEL_ID || process.env["TICKET_CHANNEL_ID"] || "",

    // Welcome system
    welcomeChannelId: process.env.WELCOME_CHANNEL_ID || process.env["WELCOME_CHANNEL_ID"] || "",

    // Role IDs - Updated to support multiple admin roles
    adminRoleIds: ["1370106309503877220", "1376238625276166204"], // Admin and Dev roles
    modRoleId: "1370145215536562195",

    // Server config
    port: process.env.PORT || 3000
};

// Auto-detect CLIENT_ID from token if not provided
if (!config.clientId && config.token) {
    try {
        const tokenPart = config.token.split(".")[0];
        const decoded = Buffer.from(tokenPart, "base64").toString();
        config.clientId = decoded;
        console.log("🔍 Auto-detected CLIENT_ID from token:", config.clientId);
    } catch (error) {
        console.log("⚠️ Could not auto-detect CLIENT_ID from token");
    }
}

// Validate critical configuration
function validateConfig() {
    const criticalErrors = [];
    
    if (!config.token || config.token === "your_bot_token_here") {
        criticalErrors.push("DISCORD_TOKEN is not configured");
    }
    if (!config.clientId || config.clientId === "your_bot_client_id_here") {
        criticalErrors.push("CLIENT_ID is not configured");
    }
    if (!config.guildId || config.guildId === "your_discord_server_id_here") {
        criticalErrors.push("GUILD_ID is not configured");
    }

    if (criticalErrors.length > 0) {
        console.error("❌ Critical configuration errors found:");
        criticalErrors.forEach((error) => console.error(`   - ${error}`));
        console.error("Please update your .env file or environment variables before starting the bot.");
        return false;
    }
    
    return true;
}

module.exports = {
    config,
    validateConfig
};