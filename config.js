// Configuration module for UnitedRust Discord Bot
require('dotenv').config();

const config = {
    // Discord Bot Configuration - Primary tokens
    token: process.env.DISCORD_TOKEN || process.env["DISCORD_TOKEN"] || "",
    clientId: process.env.CLIENT_ID || process.env["CLIENT_ID"] || "",
    guildId: process.env.GUILD_ID || process.env["GUILD_ID"] || "",

    // Channel Configuration
    generalChannelId: process.env.GENERAL_CHANNEL_ID || process.env["GENERAL_CHANNEL_ID"] || "",
    ticketCategoryId: process.env.TICKET_CATEGORY_ID || process.env["TICKET_CATEGORY_ID"] || "",
    ticketChannelId: process.env.TICKET_CHANNEL_ID || process.env["TICKET_CHANNEL_ID"] || "",
    welcomeChannelId: process.env.WELCOME_CHANNEL_ID || process.env["WELCOME_CHANNEL_ID"] || "",
    teamCategoryId: process.env.TEAM_CATEGORY_ID || process.env["TEAM_CATEGORY_ID"] || "",

    // Role Configuration - All role IDs centralized here
    roles: {
        // Admin roles (multiple supported)
        adminRoleIds: [
            process.env.ADMIN_ROLE_ID_1 || "1370106309503877220", // Primary Admin role
            process.env.ADMIN_ROLE_ID_2 || "1376238625276166204", // Dev role
            // Add more admin roles by adding ADMIN_ROLE_ID_3, etc. in .env
        ],
        // Moderator roles
        moderatorRoleId: process.env.MODERATOR_ROLE_ID || process.env["MODERATOR_ROLE_ID"] || "1370145215536562195",
        modRoleId: process.env.MOD_ROLE_ID || process.env["MOD_ROLE_ID"] || "1370145215536562195",
        
        // Additional role types that might be needed
        memberRoleId: process.env.MEMBER_ROLE_ID || process.env["MEMBER_ROLE_ID"] || "",
        vipRoleId: process.env.VIP_ROLE_ID || process.env["VIP_ROLE_ID"] || "",
        donatorRoleId: process.env.DONATOR_ROLE_ID || process.env["DONATOR_ROLE_ID"] || "",
    },

    // Bot Behavior Configuration
    behavior: {
        // Team system settings
        maxTeamSize: parseInt(process.env.MAX_TEAM_SIZE) || 6,
        allowTeamChanges: process.env.ALLOW_TEAM_CHANGES !== "false", // Default true
        teamChangesCooldown: parseInt(process.env.TEAM_CHANGES_COOLDOWN) || 24, // hours
        
        // Curfew system settings
        curfewStartHour: parseInt(process.env.CURFEW_START_HOUR) || 0, // GMT hour (0 = midnight)
        curfewEndHour: parseInt(process.env.CURFEW_END_HOUR) || 8, // GMT hour (8 = 8 AM)
        curfewReminderMinutes: parseInt(process.env.CURFEW_REMINDER_MINUTES) || 30,
        
        // Giveaway system settings - UPDATED to 6 hours
        giveawayIntervalHours: parseInt(process.env.GIVEAWAY_INTERVAL_HOURS) || 6,
        
        // Wipe system settings - NEW
        wipeDay: parseInt(process.env.WIPE_DAY) || 4, // 4 = Thursday (0 = Sunday, 1 = Monday, etc.)
        wipeHour: parseInt(process.env.WIPE_HOUR) || 19, // 19 = 7 PM GMT
        wipeAnnouncementHours: process.env.WIPE_ANNOUNCEMENT_HOURS ? 
            process.env.WIPE_ANNOUNCEMENT_HOURS.split(',').map(h => parseInt(h.trim())) : 
            [8, 20], // 8 AM and 8 PM GMT
        
        // Ticket system settings
        maxTicketsPerUser: parseInt(process.env.MAX_TICKETS_PER_USER) || 1,
        ticketAutoCloseHours: parseInt(process.env.TICKET_AUTO_CLOSE_HOURS) || 0, // 0 = disabled
        
        // Moderation settings
        autoDeletePurgeNotification: process.env.AUTO_DELETE_PURGE_NOTIFICATION !== "false", // Default true
        purgeNotificationSeconds: parseInt(process.env.PURGE_NOTIFICATION_SECONDS) || 5,
        logModerationActions: process.env.LOG_MODERATION_ACTIONS !== "false", // Default true
    },

    // External API Keys and Tokens (if you add integrations later)
    external: {
        // Steam API key (for future Steam integration)
        steamApiKey: process.env.STEAM_API_KEY || process.env["STEAM_API_KEY"] || "",
        
        // Rust game server API (if you add server stats)
        rustServerApiKey: process.env.RUST_SERVER_API_KEY || process.env["RUST_SERVER_API_KEY"] || "",
        rustServerApiUrl: process.env.RUST_SERVER_API_URL || process.env["RUST_SERVER_API_URL"] || "",
        
        // Database connection (if you add database later)
        databaseUrl: process.env.DATABASE_URL || process.env["DATABASE_URL"] || "",
        databasePassword: process.env.DATABASE_PASSWORD || process.env["DATABASE_PASSWORD"] || "",
        
        // Other potential integrations
        webhookUrl: process.env.WEBHOOK_URL || process.env["WEBHOOK_URL"] || "",
        backupWebhookUrl: process.env.BACKUP_WEBHOOK_URL || process.env["BACKUP_WEBHOOK_URL"] || "",
    },

    // Server Configuration
    server: {
        port: parseInt(process.env.PORT) || 3000,
        environment: process.env.NODE_ENV || "development",
        logLevel: process.env.LOG_LEVEL || "info",
        
        // Health check settings
        healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL) || 300, // seconds
        
        // File storage settings
        dataDirectory: process.env.DATA_DIRECTORY || "./data",
        backupDirectory: process.env.BACKUP_DIRECTORY || "./backups",
        enableAutoBackup: process.env.ENABLE_AUTO_BACKUP !== "false", // Default true
        backupIntervalHours: parseInt(process.env.BACKUP_INTERVAL_HOURS) || 24,
    },

    // Compatibility: Keep old structure for existing code
    // These map to the new structure above for backward compatibility
    get adminRoleIds() { return this.roles.adminRoleIds; },
    get moderatorRoleId() { return this.roles.moderatorRoleId; },
    get modRoleId() { return this.roles.modRoleId; },
    get port() { return this.server.port; },
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

// Build admin role IDs array dynamically from environment variables
function buildAdminRoleIds() {
    const adminRoles = [];
    
    // Add predefined admin roles
    if (process.env.ADMIN_ROLE_ID_1) adminRoles.push(process.env.ADMIN_ROLE_ID_1);
    if (process.env.ADMIN_ROLE_ID_2) adminRoles.push(process.env.ADMIN_ROLE_ID_2);
    if (process.env.ADMIN_ROLE_ID_3) adminRoles.push(process.env.ADMIN_ROLE_ID_3);
    if (process.env.ADMIN_ROLE_ID_4) adminRoles.push(process.env.ADMIN_ROLE_ID_4);
    if (process.env.ADMIN_ROLE_ID_5) adminRoles.push(process.env.ADMIN_ROLE_ID_5);
    
    // If no admin roles found in env, use defaults
    if (adminRoles.length === 0) {
        adminRoles.push("1370106309503877220", "1376238625276166204");
    }
    
    return adminRoles;
}

// Update admin roles with dynamic loading
config.roles.adminRoleIds = buildAdminRoleIds();

// Validate critical configuration
function validateConfig() {
    const criticalErrors = [];
    const warnings = [];
    
    // Critical validations
    if (!config.token || config.token === "your_bot_token_here") {
        criticalErrors.push("DISCORD_TOKEN is not configured");
    }
    if (!config.clientId || config.clientId === "your_bot_client_id_here") {
        criticalErrors.push("CLIENT_ID is not configured");
    }
    if (!config.guildId || config.guildId === "your_discord_server_id_here") {
        criticalErrors.push("GUILD_ID is not configured");
    }

    // Warning validations
    if (!config.generalChannelId) {
        warnings.push("GENERAL_CHANNEL_ID is not configured - some features may not work");
    }
    if (!config.ticketCategoryId) {
        warnings.push("TICKET_CATEGORY_ID is not configured - ticket system may not work");
    }
    if (!config.roles.moderatorRoleId) {
        warnings.push("MODERATOR_ROLE_ID is not configured - moderation features may be limited");
    }

    // Display results
    if (criticalErrors.length > 0) {
        console.error("❌ Critical configuration errors found:");
        criticalErrors.forEach((error) => console.error(`   - ${error}`));
        console.error("Please update your .env file or environment variables before starting the bot.");
        return false;
    }
    
    if (warnings.length > 0) {
        console.warn("⚠️ Configuration warnings:");
        warnings.forEach((warning) => console.warn(`   - ${warning}`));
    }
    
    console.log("✅ Configuration validation passed");
    return true;
}

// Helper function to get all configured tokens (for debugging - don't log sensitive values)
function getConfigSummary() {
    return {
        hasDiscordToken: !!config.token,
        hasClientId: !!config.clientId,
        hasGuildId: !!config.guildId,
        channels: {
            general: !!config.generalChannelId,
            ticketCategory: !!config.ticketCategoryId,
            ticketChannel: !!config.ticketChannelId,
            welcome: !!config.welcomeChannelId,
            teamCategory: !!config.teamCategoryId,
        },
        roles: {
            adminRoles: config.roles.adminRoleIds.length,
            hasModerator: !!config.roles.moderatorRoleId,
            hasMod: !!config.roles.modRoleId,
        },
        external: {
            hasSteamApi: !!config.external.steamApiKey,
            hasRustServerApi: !!config.external.rustServerApiKey,
            hasDatabase: !!config.external.databaseUrl,
            hasWebhook: !!config.external.webhookUrl,
        },
        server: {
            port: config.server.port,
            environment: config.server.environment,
            logLevel: config.server.logLevel,
        },
        behavior: {
            giveawayInterval: config.behavior.giveawayIntervalHours,
            wipeDay: config.behavior.wipeDay,
            wipeHour: config.behavior.wipeHour,
            wipeAnnouncementHours: config.behavior.wipeAnnouncementHours,
        }
    };
}

// Create data directories if they don't exist
function initializeDirectories() {
    const fs = require('fs');
    const path = require('path');
    
    try {
        if (!fs.existsSync(config.server.dataDirectory)) {
            fs.mkdirSync(config.server.dataDirectory, { recursive: true });
            console.log(`📁 Created data directory: ${config.server.dataDirectory}`);
        }
        
        if (config.server.enableAutoBackup && !fs.existsSync(config.server.backupDirectory)) {
            fs.mkdirSync(config.server.backupDirectory, { recursive: true });
            console.log(`📁 Created backup directory: ${config.server.backupDirectory}`);
        }
    } catch (error) {
        console.error("❌ Error creating directories:", error);
    }
}

// Initialize directories on load
initializeDirectories();

module.exports = {
    config,
    validateConfig,
    getConfigSummary,
    
    // Helper functions for specific configurations
    getAdminRoleIds: () => config.roles.adminRoleIds,
    getModeratorRoleId: () => config.roles.moderatorRoleId,
    getCurfewHours: () => ({ start: config.behavior.curfewStartHour, end: config.behavior.curfewEndHour }),
    getMaxTeamSize: () => config.behavior.maxTeamSize,
    getGiveawayInterval: () => config.behavior.giveawayIntervalHours, // NEW
    getWipeSettings: () => ({ // NEW
        day: config.behavior.wipeDay,
        hour: config.behavior.wipeHour,
        announcementHours: config.behavior.wipeAnnouncementHours
    }),
    
    // Environment helpers
    isDevelopment: () => config.server.environment === "development",
    isProduction: () => config.server.environment === "production",
    
    // Token validation helpers
    hasRequiredTokens: () => !!(config.token && config.clientId && config.guildId),
    hasOptionalIntegrations: () => !!(config.external.steamApiKey || config.external.rustServerApiKey),
};