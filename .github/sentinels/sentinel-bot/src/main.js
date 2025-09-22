const { Client, GatewayIntentBits, Message, Partials } = require('discord.js');
const { MongoClient } = require('mongodb');
const { config } = require('dotenv');

// Load environment variables from the .env file
config();

// --- Configuration from .env ---
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const MONGO_URI = process.env.MONGO_URI;
const DATABASE_NAME = 'titans_eye';
const USERS_COLLECTION = 'users';
const RULES_COLLECTION = 'rules';

// --- Discord Client Setup ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

// --- Database Connection ---
const mongoClient = new MongoClient(MONGO_URI);
let db;

async function connectToDatabase() {
  try {
    await mongoClient.connect();
    db = mongoClient.db(DATABASE_NAME);
    console.log('Successfully connected to MongoDB Atlas.');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
  }
}

// --- Rule-Based Verification Logic ---
let activeRules = [];
const verificationChannelId = 'YOUR_VERIFICATION_CHANNEL_ID_HERE'; // Replace with your channel ID
const verifiedRoleId = 'YOUR_VERIFIED_ROLE_ID_HERE'; // Replace with your role ID

async function loadRules() {
  if (!db) return;
  try {
    const rulesCollection = db.collection(RULES_COLLECTION);
    activeRules = await rulesCollection.find({}).toArray();
    console.log(`Loaded ${activeRules.length} active rules from the database.`);
  } catch (error) {
    console.error('Error loading rules:', error);
  }
}

async function runVerification(message) {
  const user = message.author;
  const responseText = message.content;
  const isNitro = user.premiumSince !== null;

  let suspicionScore = 0;
  const failedRules = [];
  const passedRules = [];

  // Loop through all active rules from the database
  for (const rule of activeRules) {
    let rulePassed = true;
    let ruleData;

    switch (rule.type) {
      case 'keyword_blacklist':
        ruleData = rule.rule_data.keywords;
        if (
          ruleData.some(keyword => responseText.toLowerCase().includes(keyword))
        ) {
          rulePassed = false;
          suspicionScore += rule.score;
        }
        break;
      case 'length_check':
        ruleData = isNitro
          ? rule.rule_data.nitro_user
          : rule.rule_data.standard_user;
        if (
          responseText.length < ruleData.min_length ||
          responseText.length > ruleData.max_length
        ) {
          rulePassed = false;
          suspicionScore += rule.score;
        }
        break;
      case 'date_check':
        // Implement more complex date checking logic here
        const minAge = rule.rule_data.min_age;
        // For demonstration, we'll check for a basic keyword
        if (
          rule.rule_data.keywords.some(keyword =>
            responseText.toLowerCase().includes(keyword),
          )
        ) {
          // You would implement a real date parsing and age calculation here
          // This is a simplified example
          rulePassed = false;
          suspicionScore += rule.score;
        }
        break;
      // You can add more rules as your AI generates them
      default:
        break;
    }

    if (rulePassed) {
      passedRules.push(rule.name);
    } else {
      failedRules.push(rule.name);
    }
  }

  // --- Decision Logic ---
  let result;
  if (suspicionScore === 0) {
    result = 'passed';
  } else if (suspicionScore > 0 && suspicionScore < 100) {
    result = 'flagged';
  } else {
    result = 'denied';
  }

  // Save the attempt to the database
  const usersCollection = db.collection(USERS_COLLECTION);
  const newAttempt = {
    timestamp: new Date(),
    response_text: responseText,
    suspicion_score: suspicionScore,
    passed_rules: passedRules,
    failed_rules: failedRules,
    result: result,
  };

  // Update the user's document
  await usersCollection.updateOne(
    { _id: user.id },
    {
      $set: {
        username: user.tag,
        verification_status: result === 'passed' ? 'verified' : result,
        last_interaction: new Date(),
        account_type: isNitro ? 'nitro' : 'standard',
      },
      $push: { verification_attempts: newAttempt },
    },
    { upsert: true }, // Creates the document if it doesn't exist
  );

  // Provide feedback to the user
  if (result === 'passed') {
    message.reply(
      'Verification successful. You have been granted the verified role!',
    );
    const member = await message.guild.members.fetch(user.id);
    const role = message.guild.roles.cache.get(verifiedRoleId);
    if (role) {
      member.roles.add(role).catch(console.error);
    }
  } else {
    message.reply('Verification failed. Please try again.');
  }
}

// --- Event Handlers ---
client.on('ready', async () => {
  console.log(`Logged in as ${client.user.tag}!`);
  await connectToDatabase();
  await loadRules();
});

client.on('guildMemberAdd', async member => {
  // Send a welcome message and initiate verification
  await member.send(
    'Welcome! Please verify your age by responding to this message. What is your date of birth?',
  );
});

client.on('messageCreate', async message => {
  // Ignore messages from the bot itself
  if (message.author.bot) return;

  // Only respond to messages in the verification channel or DMs
  if (
    message.channel.id === verificationChannelId ||
    message.channel.type === 1
  ) {
    // 1 is DM channel type
    runVerification(message);
  }
});

// Start the bot
client.login(DISCORD_TOKEN);
