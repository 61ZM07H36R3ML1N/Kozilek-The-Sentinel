// This is the main entry point for the Kozilek Discord bot.
// It is located at the root of the 'kozilek_bot' directory.

const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, Events, GatewayIntentBits } = require('discord.js');
const dotenv = require('dotenv');

// --- 1. CONFIGURE ENVIRONMENT VARIABLES ---
// Load secrets from the .env file at the project's root directory.
// The path goes up one level from /kozilek_bot/ to the project root.
dotenv.config({ path: path.resolve(__dirname, '../.env') });
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;

if (!DISCORD_TOKEN) {
  throw new Error('FATAL: DISCORD_TOKEN is not defined in the .env file.');
}

// --- 2. INITIALIZE DISCORD CLIENT ---
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

// --- 3. DYNAMIC COMMAND HANDLING ---
client.commands = new Collection();

// --- NEW: DYNAMIC EVENT HANDLING ---
const eventsPath = path.join(__dirname, 'src', 'events');
const eventFiles = fs
  .readdirSync(eventsPath)
  .filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  const event = require(filePath);
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
  console.log(`[INFO] Loaded event: ${event.name}`);
}

// Define the path to your commands directory, which is now inside 'src'.
const commandsPath = path.join(__dirname, 'src', 'commands');

// Check if the commands directory exists before trying to read it.
if (!fs.existsSync(commandsPath)) {
  console.error(`[ERROR] Commands directory not found at: ${commandsPath}`);
  console.error(
    "[ERROR] Please make sure your command files are in 'kozilek_bot/src/commands/'",
  );
  process.exit(1); // Exit the process if the commands folder is missing
}

// Recursively find all .js files in the commands directory.
function findCommandFiles(dir) {
  let commandFiles = [];
  const files = fs.readdirSync(dir, { withFileTypes: true });
  for (const file of files) {
    const filePath = path.join(dir, file.name);
    if (file.isDirectory()) {
      commandFiles = commandFiles.concat(findCommandFiles(filePath));
    } else if (file.name.endsWith('.js')) {
      commandFiles.push(filePath);
    }
  }
  return commandFiles;
}

const commandFiles = findCommandFiles(commandsPath);

for (const filePath of commandFiles) {
  const command = require(filePath);
  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
    console.log(`[INFO] Loaded command: ${command.data.name}`);
  } else {
    console.log(
      `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`,
    );
  }
}

// --- 4. EVENT HANDLING ---

// Log a confirmation message when the bot is ready.
client.once(Events.ClientReady, readyClient => {
  console.log(`✅ Ready! Logged in as ${readyClient.user.tag}`);
});

// Listen for and execute slash commands.
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = interaction.client.commands.get(interaction.commandName);

  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    const errorMessage = {
      content: 'There was an error while executing this command!',
      ephemeral: true,
    };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorMessage);
    } else {
      await interaction.reply(errorMessage);
    }
  }
});

// --- 5. LOGIN TO DISCORD ---
client.login(DISCORD_TOKEN);
