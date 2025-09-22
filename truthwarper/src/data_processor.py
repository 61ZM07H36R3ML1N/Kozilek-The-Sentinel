# data_processor.py

import os
from datetime import datetime
import pandas as pd
from pymongo import MongoClient

# --- Configuration ---
# Your MongoDB Atlas connection string.
# It's best practice to store this as an environment variable for security.
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
DATABASE_NAME = "titans_eye"
COLLECTION_NAME = "users"

def get_db_client():
    """Establishes a connection to the MongoDB database."""
    try:
        client = MongoClient(MONGO_URI)
        return client[DATABASE_NAME]
    except Exception as e:
        print(f"Error connecting to MongoDB: {e}")
        return None

def fetch_raw_user_data(db_client):
    """
    Fetches all user data from the 'users' collection.
    
    Args:
        db_client: The MongoDB database client.
        
    Returns:
        A list of documents from the 'users' collection.
    """
    if db_client:
        users_collection = db_client[COLLECTION_NAME]
        # Find all documents in the collection
        return list(users_collection.find({}))
    return []

def process_data_for_ai(raw_data):
    """
    Cleans and formats the raw user data for the AI model.
    This is where you'll extract features for the Truthwarper.
    
    Args:
        raw_data: A list of documents from the 'users' collection.
        
    Returns:
        A pandas DataFrame with processed data.
    """
    processed_records = []
    
    for user_doc in raw_data:
        for attempt in user_doc.get("verification_attempts", []):
            # Extract key features for the AI
            record = {
                "user_id": user_doc["_id"],
                "response_text": attempt["response_text"],
                "suspicion_score": attempt["suspicion_score"],
                "result": attempt["result"],
                "timestamp": attempt["timestamp"],
                "passed_rules": attempt.get("passed_rules", []),
                "failed_rules": attempt.get("failed_rules", [])
            }
            # Add other features like text length and AI analysis scores (if available)
            record["text_length"] = len(record["response_text"])
            
            # Additional processing logic can go here (e.g., NLP features, tokenization)
            
            processed_records.append(record)

    # Convert the list of records to a pandas DataFrame for easier manipulation
    df = pd.DataFrame(processed_records)
    
    # Example of further data cleaning:
    # df = df.dropna()
    # df = pd.get_dummies(df, columns=['result'])
    
    return df

if __name__ == '__main__':
    print("Starting data processing for Truthwarper...")
    
    # 1. Connect to the database
    db = get_db_client()
    if db:
        # 2. Fetch the raw data
        raw_users = fetch_raw_user_data(db)
        print(f"Fetched {len(raw_users)} user documents.")
        
        # 3. Process the data for the AI model
        processed_df = process_data_for_ai(raw_users)
        print("\nProcessed data sample:")
        print(processed_df.head())
        
        # Now this DataFrame can be used by the trainer.py script
        # to train the Truthwarper model.