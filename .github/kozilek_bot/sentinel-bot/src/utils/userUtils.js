// This utility file provides helper functions related to Discord users.

// Define the character limits as constants for clarity and easy maintenance.
const STANDARD_LIMIT = 2000;
const NITRO_LIMIT = 4000;

/**
 * Checks for visual or server-based perks that indicate a user has an active Nitro subscription.
 * @param {import('discord.js').User} user The Discord user object to check.
 * @param {import('discord.js').GuildMember | null} member The guild member object for the user.
 * @returns {boolean} True if signs of Nitro are present, otherwise false.
 */
function hasNitroPerks(user, member) {
  if (!user) return false;

  // 1. Check for an animated avatar. Avatar hashes for animated avatars start with 'a_'.
  if (user.avatar && user.avatar.startsWith('a_')) {
    return true;
  }

  // 2. Check if the user has a banner, a Nitro-exclusive feature.
  if (user.banner) {
    return true;
  }

  // 3. Check if the member is actively boosting the server (requires Nitro).
  if (member && member.premiumSinceTimestamp) {
    return true;
  }

  return false;
}

/**
 * Determines the maximum message character limit for a given user.
 * @param {import('discord.js').User} user The Discord user object.
 * @param {import('discord.js').GuildMember | null} member The guild member object for the user.
 * @returns {number} The user's maximum character limit (2000 or 4000).
 */
function getMaxCharacterLimit(user, member) {
  return hasNitroPerks(user, member) ? NITRO_LIMIT : STANDARD_LIMIT;
}

// Export the functions to be used in other files.
module.exports = {
  getMaxCharacterLimit,
  hasNitroPerks,
};
