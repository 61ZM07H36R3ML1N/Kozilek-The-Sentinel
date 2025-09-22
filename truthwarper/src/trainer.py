import os
import json
from datetime import datetime
from pymongo import MongoClient
import pandas as pd
import google.genai as genai
from dotenv import load_dotenv

# Load environment variables from the .env file
load_dotenv()

# Gemini API details
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
MODEL_NAME = "gemini-1.5-pro-latest"

# MongoDB Atlas details
MONGO_URI = os.getenv("MONGO_URI")
DATABASE_NAME = "titans_eye"
USERS_COLLECTION = "users"
RULES_COLLECTION = "rules"

def initialize_gemini():
    """Initializes the Gemini client."""
    genai.configure(api_key=GEMINI_API_KEY)
    return genai.GenerativeModel(MODEL_NAME)

def get_db_client():
    """Establishes a connection to the MongoDB Atlas database."""
    try:
        client = MongoClient(MONGO_URI)
        return client[DATABASE_NAME]
    except Exception as e:
        print(f"Error connecting to MongoDB: {e}")
        return None

def fetch_flagged_data():
    """
    Fetches all previously flagged user verification attempts from the database.
    
    Returns:
        A list of dictionaries containing the flagged attempts.
    """
    db = get_db_client()
    if not db:
        return []
    
    flagged_attempts = list(db[USERS_COLLECTION].aggregate([
        { "$unwind": "$verification_attempts" },
        { "$match": { "verification_attempts.result": "flagged", "verification_attempts.ai_processed": { "$ne": True } } }
    ]))
    
    return flagged_attempts

def generate_rule_from_ai(model, flagged_data_df):
    """
    Uses the Gemini API to analyze a DataFrame of flagged data and generate a new rule.
    
    Args:
        model: The initialized Gemini model.
        flagged_data_df (pd.DataFrame): A DataFrame of flagged user responses.
        
    Returns:
        A dictionary representing a new rule to be added to the rules collection.
    """
    # Create a string representation of the flagged data for the prompt
    data_string = flagged_data_df.to_json(orient='records')
    
    # The prompt is the core of your AI's logic.
    prompt = (
        f"You are the Truthwarper, an AI designed to analyze bypass attempts on an age verification system. "
        f"Your task is to analyze the following user data from failed verification attempts, "
        f"identify a new pattern or technique being used, and generate a new defense rule in valid JSON format. "
        f"The data is a JSON array of user attempts: {data_string}\n\n"
        f"Based on this data, create a new rule that could flag similar attempts in the future. "
        f"The JSON rule must have the following fields: "
        f"name (string, e.g., 'AI-Generated Sarcasm Check'), "
        f"type (string, e.g., 'keyword_blacklist', 'length_check', 'nlp_sentiment'), "
        f"rule_data (object with rule-specific parameters, e.g., an array of keywords), "
        f"score (integer from 1-100, based on risk), "
        f"and description (string explaining the rule)."
    )
    
    try:
        response = model.generate_content(prompt)
        # Parse the JSON response from Gemini
        new_rule_json = response.candidates[0].content.parts[0].text
        # Use json.loads for safer parsing
        new_rule = json.loads(new_rule_json)
        return new_rule
    except Exception as e:
        print(f"Error calling Gemini API: {e}")
        return None

def mark_attempts_as_processed(db, attempts):
    """
    Marks the given attempts as 'ai_processed' in the database.
    
    Args:
        db: The database client.
        attempts (list): A list of flagged attempt documents.
    """
    for attempt in attempts:
        try:
            db[USERS_COLLECTION].update_one(
                { "_id": attempt["_id"], "verification_attempts.timestamp": attempt["verification_attempts"]["timestamp"] },
                { "$set": { "verification_attempts.$.ai_processed": True } }
            )
        except Exception as e:
            print(f"Error marking attempt as processed: {e}")

def run_trainer_cycle():
    """The main entry point for the AI trainer."""
    db = get_db_client()
    if not db:
        return
    
    gemini_model = initialize_gemini()
    print("AI trainer is active. Starting learning cycle...")
    
    flagged_attempts = fetch_flagged_data()
    if not flagged_attempts:
        print("No new flagged attempts to analyze.")
        return
        
    print(f"Found {len(flagged_attempts)} new flagged attempts.")
    
    # Use pandas to structure the data for a better prompt
    flagged_data_df = pd.DataFrame([
        {
            "user_id": a["_id"],
            "response": a["verification_attempts"]["response_text"],
            "failed_rules": a["verification_attempts"]["failed_rules"],
            "suspicion_score": a["verification_attempts"]["suspicion_score"]
        } for a in flagged_attempts
    ])
    
    # Generate the rule using Gemini
    new_rule = generate_rule_from_ai(gemini_model, flagged_data_df)
    
    if new_rule:
        # Insert the new rule into the 'rules' collection
        try:
            db[RULES_COLLECTION].insert_one(new_rule)
            print(f"Successfully generated and added new rule: {new_rule['name']}")
            # Mark the attempts as processed
            mark_attempts_as_processed(db, flagged_attempts)
        except Exception as e:
            print(f"Error inserting new rule into database: {e}")