// Rules System for UnitedRust Discord Bot
const { EmbedBuilder } = require("discord.js");
const fs = require("fs");
const path = require("path");

class RulesSystem {
    constructor() {
        this.discordRules = null;
        this.serverRules = null;
        this.loadRulesFromFiles();
    }

    // Load command files
    loadRulesFromFiles() {
        try {
            const commandsPath = path.join(__dirname, "commands");
            
            if (fs.existsSync(path.join(commandsPath, "discordrules.txt"))) {
                this.discordRules = fs.readFileSync(
                    path.join(commandsPath, "discordrules.txt"),
                    "utf8"
                );
            }
            
            if (fs.existsSync(path.join(commandsPath, "serverrules.txt"))) {
                this.serverRules = fs.readFileSync(
                    path.join(commandsPath, "serverrules.txt"),
                    "utf8"
                );
            }

            console.log("✅ Rules files loaded successfully");
        } catch (error) {
            console.error("❌ Error loading rules files:", error);
        }
    }

    // Handle Discord rules command
    async handleDiscordRulesCommand(interaction) {
        try {
            // First embed - Introduction and General Rules Part 1
            const generalRulesEmbed1 = new EmbedBuilder()
                .setTitle("📋 UnitedRust Discord Server Rules")
                .setColor(0x5865f2)
                .setDescription(
                    "Please read and follow these rules to maintain a positive community environment."
                )
                .addFields(
                    {
                        name: "**1. Respect Staff**",
                        value: "Respect the staff team and their decisions, their word is final and if you have an issue put a ticket in.",
                        inline: false,
                    },
                    {
                        name: "**2. No Harmful Content**",
                        value: "Absolutely no: NSFW Content/Racism/Sexism/Discrimination/Bigotry/Doxxing and or Harassment. Be respectful towards members and remember banter is fine but be mindful that what you say may not be perceived as a joke by others.",
                        inline: false,
                    },
                    {
                        name: "**3. Use Appropriate Channels**",
                        value: "Utilise appropriate channels for your messages (eg: self promotion in the self promo channel)",
                        inline: false,
                    }
                );

            // Second embed - General Rules Part 2
            const generalRulesEmbed2 = new EmbedBuilder()
                .setTitle("📋 Discord Rules (Continued)")
                .setColor(0x5865f2)
                .addFields(
                    {
                        name: "**3a. Self-Promotion Guidelines**",
                        value: "In the self-promotion channel you may only link your content such as (Videos, Streams, Art etc). You may not upload malicious files into the channel, or post malicious links (IP-Loggers, screamers etc) or videos of you cheating blatantly. This is an instant ban.",
                        inline: false,
                    },
                    {
                        name: "**4. Language Filters**",
                        value: "Do not intentionally attempt to get around the language filters that we have set.",
                        inline: false,
                    },
                    {
                        name: "**5. Staff Mentions**",
                        value: "Mentioning @Admin / @OWNER for silly things will result in instant mute.",
                        inline: false,
                    },
                    {
                        name: "**6. No Drama**",
                        value: "Do NOT stir drama in chat/s with staff or other members of DC. Don't bring your in-ticket issues into chat if you are unhappy with the outcome. Don't type same thing, going in circles with staff. Do NOT be disrespectful to staff. If you have issue with staff contact Manager/s or Owner. Failure to do so will get you muted.",
                        inline: false,
                    }
                );

            // Third embed - Voice Chat Rules
            const voiceRulesEmbed = new EmbedBuilder()
                .setTitle("🎤 Voice Chat Rules")
                .setColor(0x57f287)
                .addFields(
                    {
                        name: "**1. No Mic Spam**",
                        value: "Keep your microphone usage respectful and avoid spamming.",
                        inline: false,
                    },
                    {
                        name: "**2. No Harmful Content**",
                        value: "Absolutely no: Racism/Sexism/Discrimination/Bigotry/Doxxing and or Harassment within the voice channels.",
                        inline: false,
                    },
                    {
                        name: "**3. No NSFW Streaming**",
                        value: "No Streaming NSFW Content or anything illegal.",
                        inline: false,
                    }
                )
                .setFooter({
                    text: "Remember: These rules help maintain a positive community environment for everyone. Violations will result in appropriate punishments ranging from warnings to permanent bans.",
                });

            // Send all embeds as separate messages
            await interaction.reply({ embeds: [generalRulesEmbed1] });
            await interaction.followUp({ embeds: [generalRulesEmbed2] });
            await interaction.followUp({ embeds: [voiceRulesEmbed] });

        } catch (error) {
            console.error("❌ Error loading Discord rules:", error);
            await interaction.reply({
                content: "❌ Error loading Discord rules. Please contact an administrator.",
                ephemeral: true,
            });
        }
    }

    // Handle Server rules command
    async handleServerRulesCommand(interaction) {
        try {
            // First embed - Introduction and Raid Policy
            const serverRulesEmbed1 = new EmbedBuilder()
                .setTitle("🎮 UnitedRust Server Rules")
                .setDescription("**Play Fair. Play Hard. Zero Tolerance for Cheating**")
                .setColor(0xe67e22)
                .addFields(
                    {
                        name: "🕐 **RAID POLICY & OFFLINE PROTECTION**",
                        value: "**No-Raid Hours:** 00:00GMT - 08:00GMT\n\nStrictly enforced with active monitoring. No raiding, door camping, or aggressive PvP during these hours. Violations result in immediate punishment - no warnings given.\n\n**Exception:** Self-defense is permitted if you are attacked first.",
                        inline: false,
                    },
                    {
                        name: "🚫 **ANTI-CHEAT & EXPLOITS**",
                        value: "**Zero Tolerance Policy** - No cheats, hacks, scripts, macro programs, or automation tools. Game exploits and bug abuse are prohibited.\n\n**Punishment:** Instant permanent ban for player and entire team. No appeals for cheat bans.",
                        inline: false,
                    }
                )
                .setTimestamp();

            // Second embed - Team Rules and Chat Rules
            const serverRulesEmbed2 = new EmbedBuilder()
                .setTitle("👥 Team & Communication Rules")
                .setColor(0x3498db)
                .addFields(
                    {
                        name: "👥 **GROUP & TEAM REGULATIONS**",
                        value: "**Maximum:** 6 players per team, strictly enforced\n**No Alliances:** Cannot work with other teams\n**Team Changes:** One per wipe cycle only\n**Process:** Must open Discord ticket before switching\n**Cooldown:** 24-hour waiting period",
                        inline: false,
                    },
                    {
                        name: "💬 **CHAT RULES & COMMUNICATION**",
                        value: "**Global Chat:** English only, friendly banter encouraged\n**Strictly Forbidden:** Personal harassment, spam, racist/discriminatory language, trolling, doxxing\n**Team Chat:** Any language permitted, not monitored unless reported",
                        inline: false,
                    }
                );

            // Third embed - Raiding Rules
            const serverRulesEmbed3 = new EmbedBuilder()
                .setTitle("⚔️ Raiding Rules & Guidelines")
                .setColor(0xf39c12)
                .addFields(
                    {
                        name: "⚔️ **PERMITTED RAIDING**",
                        value: "**Timing:** Only between 08:01GMT and 23:59GMT\n**Team Composition:** Only raid with registered teammates\n**Time Limit:** Must complete within 4 hours maximum",
                        inline: false,
                    },
                    {
                        name: "🚫 **PROHIBITED BEHAVIORS**",
                        value: "**Base Blocking:** Cannot place external TCs to prevent expansion\n**Complete Sealing:** Cannot fully wall off bases\n**Base Takeovers:** Cannot claim someone else's active base\n**Grief Despawning:** Cannot destroy loot solely to deny it",
                        inline: false,
                    },
                    {
                        name: "📋 **RAID COMPLETION REQUIREMENTS**",
                        value: "All external TCs placed during raid must have locks removed or unlocked. Raided party must be able to access/remove external TCs after completion.",
                        inline: false,
                    }
                );

            // Fourth embed - Account Requirements and Punishment
            const serverRulesEmbed4 = new EmbedBuilder()
                .setTitle("📋 Account & Punishment System")
                .setColor(0x9b59b6)
                .addFields(
                    {
                        name: "📋 **ACCOUNT REQUIREMENTS**",
                        value: "**Steam Profile:** Must be public at all times\n**Ban History:** No VAC/game bans under 500 days\n**Rust Bans:** No more than 1 previous admin ban\n**VPNs:** Prohibited (contact staff for exceptions)",
                        inline: false,
                    },
                    {
                        name: "⚖️ **PUNISHMENT SYSTEM**",
                        value: "**First Offense:** 15-day temporary ban\n**Second Offense:** Permanent ban\n**Cheating/Exploiting:** Immediate permanent ban for entire team\n**Chat Violations:** Progressive muting system (1h → 24h → 7d ban → permanent)",
                        inline: false,
                    }
                );

            // Fifth embed - Reporting and Final Information
            const serverRulesEmbed5 = new EmbedBuilder()
                .setTitle("🎯 Reporting & Support")
                .setColor(0x1abc9c)
                .addFields(
                    {
                        name: "🎯 **REPORTING SYSTEM**",
                        value: "**In-Game:** Use `/report [playername] [reason]`\n**Discord:** Open support tickets for complex issues\n**Response Time:** Staff investigate within 24 hours\n**Evidence:** Screenshots/video help investigations",
                        inline: false,
                    },
                    {
                        name: "👮 **STAFF AUTHORITY**",
                        value: "All staff decisions are final. Use Discord tickets for concerns. Treat staff with respect - harassment results in escalated punishment.",
                        inline: false,
                    },
                    {
                        name: "👨‍👩‍👧‍👦 **TEAM ACCOUNTABILITY**",
                        value: "Teams are responsible for ALL members' actions. One rule breaker can result in entire team punishment. Choose teammates carefully!",
                        inline: false,
                    }
                )
                .setFooter({
                    text: "Ignorance of rules is not an excuse. Play fair, respect others, and enjoy! | Last Updated: May 25, 2025",
                });

            // Send all embeds as separate messages
            await interaction.reply({ embeds: [serverRulesEmbed1] });
            await interaction.followUp({ embeds: [serverRulesEmbed2] });
            await interaction.followUp({ embeds: [serverRulesEmbed3] });
            await interaction.followUp({ embeds: [serverRulesEmbed4] });
            await interaction.followUp({ embeds: [serverRulesEmbed5] });

        } catch (error) {
            console.error("❌ Error loading server rules:", error);
            await interaction.reply({
                content: "❌ Error loading server rules. Please contact an administrator.",
                ephemeral: true,
            });
        }
    }

    // Create a simple rules embed (for quick reference)
    createSimpleDiscordRulesEmbed() {
        return new EmbedBuilder()
            .setTitle("📋 Quick Discord Rules")
            .setColor(0x5865f2)
            .setDescription(
                "**Essential Discord Rules:**\n\n" +
                "• Respect staff and their decisions\n" +
                "• No NSFW, racism, harassment, or discrimination\n" +
                "• Use appropriate channels for your messages\n" +
                "• Don't bypass language filters\n" +
                "• Don't mention @Admin/@OWNER unnecessarily\n" +
                "• No drama or disrespect towards staff/members\n" +
                "• Keep voice channels respectful\n\n" +
                "Use `/discordrules` for complete rules!"
            )
            .setTimestamp()
            .setFooter({ text: "UnitedRust Discord Rules" });
    }

    // Create a simple server rules embed (for quick reference)
    createSimpleServerRulesEmbed() {
        return new EmbedBuilder()
            .setTitle("🎮 Quick Server Rules")
            .setColor(0xe67e22)
            .setDescription(
                "**Essential Server Rules:**\n\n" +
                "• **No Raiding:** 00:00GMT - 08:00GMT\n" +
                "• **Zero Tolerance:** No cheats, hacks, or exploits\n" +
                "• **Max Team Size:** 6 players only\n" +
                "• **No Griefing:** Don't block rebuilding or seal bases\n" +
                "• **English Only:** Global chat must be in English\n" +
                "• **Steam Profile:** Must be public\n" +
                "• **Respect Staff:** Their decisions are final\n\n" +
                "Use `/serverrules` for complete rules!"
            )
            .setTimestamp()
            .setFooter({ text: "UnitedRust Server Rules" });
    }

    // Get rules summary for welcome messages or help
    getRulesSummary() {
        return {
            discord: "Use `/discordrules` to view Discord server rules",
            server: "Use `/serverrules` to view Rust server rules",
            quick: "Remember: No raiding 00:00-08:00 GMT, max 6 players per team, no cheating!"
        };
    }
}

module.exports = RulesSystem;