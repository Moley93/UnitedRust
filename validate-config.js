#!/usr/bin/env node
// Configuration Validator for UnitedRust Discord Bot
// Run with: node validate-config.js

const { config, validateConfig, getConfigSummary } = require('./config');

console.log("🔍 UnitedRust Bot Configuration Validator");
console.log("==========================================\n");

// Validate configuration
const isValid = validateConfig();

console.log("\n📊 Configuration Summary:");
console.log("=========================");

const summary = getConfigSummary();

// Core configuration
console.log("\n🔑 Core Configuration:");
console.log(`  Discord Token: ${summary.hasDiscordToken ? '✅ Configured' : '❌ Missing'}`);
console.log(`  Client ID: ${summary.hasClientId ? '✅ Configured' : '❌ Missing'}`);
console.log(`  Guild ID: ${summary.hasGuildId ? '✅ Configured' : '❌ Missing'}`);

// Channel configuration
console.log("\n📺 Channel Configuration:");
console.log(`  General Channel: ${summary.channels.general ? '✅ Configured' : '⚠️ Not set'}`);
console.log(`  Ticket Category: ${summary.channels.ticketCategory ? '✅ Configured' : '⚠️ Not set'}`);
console.log(`  Ticket Channel: ${summary.channels.ticketChannel ? '✅ Configured' : '⚠️ Not set'}`);
console.log(`  Welcome Channel: ${summary.channels.welcome ? '✅ Configured' : '⚠️ Not set (will use general)'}`);
console.log(`  Team Category: ${summary.channels.teamCategory ? '✅ Configured' : '⚠️ Not set'}`);

// Role configuration
console.log("\n👥 Role Configuration:");
console.log(`  Admin Roles: ${summary.roles.adminRoles} configured`);
console.log(`  Moderator Role: ${summary.roles.hasModerator ? '✅ Configured' : '⚠️ Not set'}`);
console.log(`  Mod Role: ${summary.roles.hasMod ? '✅ Configured' : '⚠️ Not set'}`);

// External integrations
console.log("\n🔗 External Integrations:");
console.log(`  Steam API: ${summary.external.hasSteamApi ? '✅ Configured' : '⚠️ Not set'}`);
console.log(`  Rust Server API: ${summary.external.hasRustServerApi ? '✅ Configured' : '⚠️ Not set'}`);
console.log(`  Database: ${summary.external.hasDatabase ? '✅ Configured' : '⚠️ Not set'}`);
console.log(`  Webhooks: ${summary.external.hasWebhook ? '✅ Configured' : '⚠️ Not set'}`);

// Server configuration
console.log("\n🖥️ Server Configuration:");
console.log(`  Port: ${summary.server.port}`);
console.log(`  Environment: ${summary.server.environment}`);
console.log(`  Log Level: ${summary.server.logLevel}`);

// Bot behavior settings
console.log("\n⚙️ Bot Behavior:");
console.log(`  Max Team Size: ${config.behavior.maxTeamSize}`);
console.log(`  Curfew Hours: ${config.behavior.curfewStartHour}:00 - ${config.behavior.curfewEndHour}:00 GMT`);
console.log(`  Giveaway Interval: Every ${config.behavior.giveawayIntervalHours} hours`);
console.log(`  Max Tickets per User: ${config.behavior.maxTicketsPerUser}`);

// Specific configuration details
console.log("\n🔍 Detailed Configuration:");
console.log("==========================");

if (config.roles.adminRoleIds.length > 0) {
    console.log("\n👑 Admin Role IDs:");
    config.roles.adminRoleIds.forEach((roleId, index) => {
        console.log(`  ${index + 1}. ${roleId}`);
    });
}

// Environment file check
const fs = require('fs');
const envExists = fs.existsSync('.env');
console.log(`\n📄 Environment File: ${envExists ? '✅ .env file found' : '⚠️ .env file not found'}`);

if (!envExists) {
    console.log("   💡 Tip: Copy .env.example to .env and configure your values");
}

// Final result
console.log("\n" + "=".repeat(50));
if (isValid) {
    console.log("✅ Configuration is valid! Your bot should start successfully.");
    
    if (process.argv.includes('--test-connections')) {
        console.log("\n🔗 Testing connections would go here...");
        console.log("   (This would test Discord API, database connections, etc.)");
    }
} else {
    console.log("❌ Configuration has critical errors! Please fix them before starting the bot.");
    process.exit(1);
}

console.log("\n💡 Tips:");
console.log("  - Run 'node validate-config.js --test-connections' to test external connections");
console.log("  - Check the .env.example file for all available configuration options");
console.log("  - Set LOG_LEVEL=debug for more detailed logging during development");

// Optional: Show environment variables that are not being used
if (process.argv.includes('--show-unused')) {
    console.log("\n🔍 Checking for unused environment variables...");
    const allEnvVars = Object.keys(process.env).filter(key => 
        key.includes('DISCORD') || 
        key.includes('CLIENT') || 
        key.includes('GUILD') || 
        key.includes('CHANNEL') || 
        key.includes('ROLE') || 
        key.includes('ADMIN') || 
        key.includes('MOD') || 
        key.includes('TEAM') || 
        key.includes('CURFEW') || 
        key.includes('GIVEAWAY') || 
        key.includes('TICKET')
    );
    
    // This is a simplified check - you might want to expand this based on your actual usage
    const usedVars = [
        'DISCORD_TOKEN', 'CLIENT_ID', 'GUILD_ID', 'GENERAL_CHANNEL_ID',
        'TICKET_CATEGORY_ID', 'TICKET_CHANNEL_ID', 'WELCOME_CHANNEL_ID',
        'TEAM_CATEGORY_ID', 'ADMIN_ROLE_ID_1', 'ADMIN_ROLE_ID_2',
        'MODERATOR_ROLE_ID', 'MOD_ROLE_ID'
    ];
    
    const unusedVars = allEnvVars.filter(envVar => !usedVars.includes(envVar));
    
    if (unusedVars.length > 0) {
        console.log("⚠️ Potentially unused environment variables found:");
        unusedVars.forEach(envVar => console.log(`  - ${envVar}`));
    } else {
        console.log("✅ No unused environment variables detected.");
    }
}