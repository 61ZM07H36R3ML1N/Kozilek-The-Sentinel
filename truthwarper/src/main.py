import os
import google.genai as genai
from pymongo import MongoClient
from dotenv import load_dotenv
import time
from datetime import datetime

# --- Configuration ---
# Load environment variables from the .env file
load_dotenv()

# MongoDB Atlas details
MONGO_URI = os.getenv("MONGO_URI")
DATABASE_NAME = "titans_eye"
USERS_COLLECTION = "users"
RULES_COLLECTION = "rules"

# Gemini API details
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
MODEL_NAME = "gemini-1.5-pro-latest" # You can choose a different model

def get_db_client():
    """Establishes a connection to the MongoDB Atlas database."""
    try:
        client = MongoClient(MONGO_URI)
        return client[DATABASE_NAME]
    except Exception as e:
        print(f"Error connecting to MongoDB: {e}")
        return None

def initialize_gemini():
    """Initializes the Gemini client."""
    genai.configure(api_key=GEMINI_API_KEY)
    return genai.GenerativeModel(MODEL_NAME)

def analyze_and_generate_rule(model, flagged_response):
    """
    Uses the Gemini API to analyze a flagged user response and generate a new rule.
    
    Args:
        model: The initialized Gemini model.
        flagged_response (str): The user's text that was flagged.
        
    Returns:
        A dictionary representing a new rule to be added to the rules collection.
    """
    # The prompt is the core of your AI's logic. You will refine this over time.
    prompt = (
        f"Analyze the following user response from a failed age verification attempt "
        f"and generate a new rule in JSON format to counter this specific type of attempt. "
        f"The user response is: '{flagged_response}'.\n\n"
        f"The JSON rule should have the following fields: "
        f"name (string), type (string, e.g., 'keyword_blacklist'), "
        f"rule_data (object with rule-specific parameters), "
        f"score (integer), and description (string)."
    )
    
    try:
        response = model.generate_content(prompt)
        # Parse the JSON response from Gemini
        new_rule_json = response.candidates[0].content.parts[0].text
        # You would need to handle potential parsing errors here
        # For simplicity, we assume the response is valid JSON
        return eval(new_rule_json)
    except Exception as e:
        print(f"Error calling Gemini API: {e}")
        return None

def main_truthwarper_loop():
    """The main loop for the Truthwarper service."""
    db = get_db_client()
    if not db:
        return

    gemini_model = initialize_gemini()
    print("Truthwarper service is active and ready to learn.")

    # --- The Core Learning Loop ---
    while True:
        # 1. Fetch flagged data from the 'users' collection
        # We look for attempts that were 'flagged' by the Sentinel bot
        flagged_attempts = db[USERS_COLLECTION].aggregate([
            { "$unwind": "$verification_attempts" },
            { "$match": { "verification_attempts.result": "flagged" } }
        ])
        
        for attempt in flagged_attempts:
            user_response = attempt["verification_attempts"]["response_text"]
            
            # 2. Use Gemini to analyze the response and generate a new rule
            print(f"\nAnalyzing flagged response: '{user_response}'")
            new_rule = analyze_and_generate_rule(gemini_model, user_response)
            
            if new_rule:
                # 3. Insert the new rule into the 'rules' collection
                try:
                    db[RULES_COLLECTION].insert_one(new_rule)
                    print(f"Successfully generated and added new rule: {new_rule['name']}")
                    # Update the user's document to show the attempt was processed by the AI
                    # This prevents the AI from re-analyzing the same attempt repeatedly
                    db[USERS_COLLECTION].update_one(
                        { "_id": attempt["_id"], "verification_attempts.timestamp": attempt["verification_attempts"]["timestamp"] },
                        { "$set": { "verification_attempts.$.ai_processed": True } }
                    )
                except Exception as e:
                    print(f"Error inserting new rule into database: {e}")
        
        # Pause before the next learning cycle
        # This can be adjusted based on how frequently you want the AI to run
        print("\nLearning cycle complete. Sleeping for 1 hour...")
        time.sleep(3600) # Sleep for 1 hour

if __name__ == '__main__':
    main_truthwarper_loop()
