// This command allows a moderator to send a piece of text to the
// sentinel-engine for analysis and receive a verification prediction.

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const axios = require('axios'); // To make HTTP requests to the Python API
const dotenv = require('dotenv');
const path = require('path');

// Configure dotenv to load the .env file from the project's root directory
// __dirname is the current directory: /.../kozilek_bot/src/commands/moderation
// We need to go up three levels to reach the project root.
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// Get the API URL from the environment variables
const SENTINEL_API_URL = process.env.SENTINEL_API_URL;
if (!SENTINEL_API_URL) {
  console.error(
    'Error: SENTINEL_API_URL is not defined in the .env file. The verify command will fail.',
  );
}

module.exports = {
  // 1. COMMAND METADATA
  data: new SlashCommandBuilder()
    .setName('verify')
    .setDescription(
      'Sends text to the Sentinel Engine for age verification analysis.',
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers) // Only users with "Timeout Members" permission can use this
    .setDMPermission(false) // This command cannot be used in DMs
    .addStringOption(option =>
      option
        .setName('text')
        .setDescription(
          'The text content to be analyzed by the Sentinel Engine.',
        )
        .setRequired(true)
        .setMinLength(10)
        .setMaxLength(1000),
    ),

  // 2. COMMAND EXECUTION LOGIC
  async execute(interaction) {
    // Defer the reply to give the API time to respond without the interaction timing out.
    // Ephemeral means only the user who ran the command will see the response.
    await interaction.deferReply({ ephemeral: true });

    // Check if the API URL was loaded correctly
    if (!SENTINEL_API_URL) {
      await interaction.editReply({
        content:
          '❌ **Configuration Error:** The Sentinel API URL has not been configured correctly. Please contact the bot administrator.',
      });
      return;
    }

    const textToAnalyze = interaction.options.getString('text');

    try {
      // 3. API COMMUNICATION
      // Send the text to your Python API endpoint.
      // The API is expected to receive a JSON payload with a "message_text" key.
      console.log(`Sending text to Sentinel Engine: "${textToAnalyze}"`);
      const response = await axios.post(SENTINEL_API_URL, {
        message_text: textToAnalyze,
      });

      // Assuming the API returns a JSON response like:
      // { "prediction": 0, "confidence": 0.85 }
      // prediction: 0 = Not Underage, 1 = Underage
      // confidence: A float from 0.0 to 1.0
      const { prediction, confidence } = response.data;

      // 4. FORMAT AND SEND THE RESPONSE
      const confidencePercent = (confidence * 100).toFixed(2);
      let resultMessage = '';

      if (prediction === 1) {
        resultMessage = `🚨 **Flagged as Potential Minor**\nConfidence: \`${confidencePercent}%\``;
      } else {
        resultMessage = `✅ **Likely Not a Minor**\nConfidence: \`${confidencePercent}%\``;
      }

      await interaction.editReply({
        content: `**Sentinel Engine Analysis Result:**\n${resultMessage}\n\n**Analyzed Text:**\n> ${textToAnalyze}`,
      });
    } catch (error) {
      // 5. ERROR HANDLING
      console.error(
        'Error communicating with the Sentinel Engine API:',
        error.message,
      );

      let errorMessage =
        'An unexpected error occurred while contacting the Sentinel Engine.';
      if (error.code === 'ECONNREFUSED') {
        errorMessage =
          '❌ **API Offline:** Could not connect to the Sentinel Engine. The service may be down.';
      } else if (error.response) {
        errorMessage = `❌ **API Error:** The Sentinel Engine responded with an error (Status: ${error.response.status}).`;
      }

      await interaction.editReply({ content: errorMessage });
    }
  },
};
