// This event handler listens for every new message in the server and sends
// the content to the Sentinel Engine for real-time analysis.

const { Events, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');

// --- 1. CONFIGURE ENVIRONMENT VARIABLES ---
// Load secrets from the .env file at the project's root directory.
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const SENTINEL_API_URL = process.env.SENTINEL_API_URL;
const MOD_LOG_CHANNEL_ID = process.env.MOD_LOG_CHANNEL_ID; // The channel ID for sending alerts

if (!SENTINEL_API_URL) {
  console.warn(
    'Warning: SENTINEL_API_URL is not defined. Real-time message analysis is disabled.',
  );
}
if (!MOD_LOG_CHANNEL_ID) {
  console.warn(
    'Warning: MOD_LOG_CHANNEL_ID is not defined. Moderator alerts are disabled.',
  );
}

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    // --- 2. PRE-ANALYSIS CHECKS ---

    // Ignore messages from bots to prevent feedback loops.
    if (message.author.bot) return;

    // Ignore messages from users with moderator permissions (e.g., Manage Messages).
    if (
      message.member &&
      message.member.permissions.has(PermissionFlagsBits.ManageMessages)
    )
      return;

    // Ignore messages if the API or log channel is not configured.
    if (!SENTINEL_API_URL || !MOD_LOG_CHANNEL_ID) return;

    const textToAnalyze = message.content;

    // Ignore empty messages (e.g., only attachments or embeds).
    if (!textToAnalyze || textToAnalyze.trim().length < 10) return; // Optional: set a minimum length

    try {
      // --- 3. SEND TO SENTINEL ENGINE ---
      const response = await axios.post(SENTINEL_API_URL, {
        message_text: textToAnalyze,
      });

      // Assuming the API returns a response like:
      // { "prediction": 1, "confidence": 0.92 }
      const { prediction, confidence } = response.data;

      // --- 4. HANDLE FLAGGED MESSAGES ---
      // Only take action if the prediction is '1' (potential minor) AND
      // the confidence is above a certain threshold (e.g., 80%).
      const CONFIDENCE_THRESHOLD = 0.8;

      if (prediction === 1 && confidence >= CONFIDENCE_THRESHOLD) {
        console.log(
          `[FLAGGED] User ${message.author.tag} sent a message flagged with ${
            confidence * 100
          }% confidence.`,
        );

        // Fetch the channel to send the log to.
        const logChannel = await message.client.channels.fetch(
          MOD_LOG_CHANNEL_ID,
        );

        if (logChannel) {
          const confidencePercent = (confidence * 100).toFixed(2);

          // Use an embed for a cleaner log message.
          const alertEmbed = new EmbedBuilder()
            .setColor(0xff0000) // Red
            .setTitle('🚨 Sentinel Engine Alert')
            .setAuthor({
              name: message.author.tag,
              iconURL: message.author.displayAvatarURL(),
            })
            .setDescription(
              `A message has been flagged as potentially originating from a minor.`,
            )
            .addFields(
              {
                name: 'User',
                value: `${message.author} (\`${message.author.id}\`)`,
                inline: true,
              },
              {
                name: 'Confidence',
                value: `\`${confidencePercent}%\``,
                inline: true,
              },
              { name: 'Channel', value: message.channel.toString() },
              { name: 'Original Message', value: `> ${textToAnalyze}` },
              {
                name: 'Jump to Message',
                value: `[Click Here](${message.url})`,
              },
            )
            .setTimestamp()
            .setFooter({ text: 'Kozilek The Sentinel' });

          await logChannel.send({ embeds: [alertEmbed] });
        }
      }
    } catch (error) {
      // Log errors but don't crash the bot or notify the user.
      // This ensures the bot remains stable even if the API is down.
      if (error.code !== 'ECONNREFUSED') {
        // Don't spam logs if API is just offline
        console.error(
          'Error during real-time message analysis:',
          error.message,
        );
      }
    }
  },
};
