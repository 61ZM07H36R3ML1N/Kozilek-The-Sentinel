# This script creates a Flask web server to host the Truthwarper model.
# It exposes a /predict endpoint that the Discord bot can call.

import os
import pickle
import numpy as np
from flask import Flask, request, jsonify
from dotenv import load_dotenv
import tensorflow as tf

# --- 1. INITIALIZATION AND MODEL LOADING ---

# Load environment variables from a .env file in the 'sentinel-engine' root
# The path navigates up two levels from /api/ to the project root.
dotenv_path = os.path.join(os.path.dirname(__file__), '..', '..', '.env')
load_dotenv(dotenv_path=dotenv_path)

# Initialize the Flask application
app = Flask(__name__)

# --- Global variables to hold the loaded model and vectorizer ---
model = None
vectorizer = None

# Define paths to the saved model and vectorizer artifacts.
# Assumes they are stored in a 'saved_models' directory at the root of 'sentinel-engine'.
MODEL_PATH = os.path.join(os.path.dirname(__file__), '..', '..', 'saved_models', 'truthwarper_model.h5')
VECTORIZER_PATH = os.path.join(os.path.dirname(__file__), '..', '..', 'saved_models', 'vectorizer.pkl')

def load_model_artifacts():
    """Load the trained model and the TextVectorization layer's vocabulary."""
    global model, vectorizer
    try:
        # Load the trained Keras model
        print(f"[INFO] Loading model from: {MODEL_PATH}")
        model = tf.keras.models.load_model(MODEL_PATH)

        # The TextVectorization layer cannot be saved and loaded directly in a simple way
        # with its vocabulary. A common practice is to save its config/weights or
        # the vocabulary itself separately using pickle.
        print(f"[INFO] Loading vectorizer vocabulary from: {VECTORIZER_PATH}")
        with open(VECTORIZER_PATH, 'rb') as f:
            # We load the config and create a new layer from it
            vectorizer_config = pickle.load(f)
            # We need to use from_config to re-instantiate the layer
            vectorizer = tf.keras.layers.TextVectorization.from_config(vectorizer_config['config'])
            # The weights (the vocabulary) must be set separately
            vectorizer.set_weights(vectorizer_config['weights'])
            
        print("[INFO] Model and vectorizer loaded successfully.")
    except FileNotFoundError as e:
        print(f"[ERROR] Could not find a required file: {e}. Make sure the model and vectorizer have been saved correctly.")
        exit(1) # Exit if essential files are missing
    except Exception as e:
        print(f"[ERROR] An error occurred during model loading: {e}")
        exit(1)


# --- 2. DEFINE THE API ENDPOINT ---

@app.route("/predict", methods=["POST"])
def predict():
    """Receives message text and returns a prediction from the model."""
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400

    data = request.get_json()
    message_text = data.get("message_text")

    if not message_text:
        return jsonify({"error": "Missing 'message_text' in request body"}), 400

    try:
        # Preprocess the input text using the loaded vectorizer
        # The input needs to be a list or tensor of strings
        vectorized_text = vectorizer([message_text])
        
        # Make a prediction. The model outputs a probability.
        prediction_prob = model.predict(vectorized_text)[0][0]
        
        # Convert the probability to a binary prediction (0 or 1)
        prediction = 1 if prediction_prob > 0.5 else 0

        # Create the response object
        response = {
            "prediction": int(prediction),
            "confidence": float(prediction_prob)
        }
        return jsonify(response)

    except Exception as e:
        print(f"[ERROR] Error during prediction: {e}")
        return jsonify({"error": "Internal server error"}), 500


# --- 3. RUN THE FLASK APP ---

if __name__ == "__main__":
    # Load the model artifacts when the script starts
    load_model_artifacts()
    
    # Get host and port from environment variables, with defaults
    HOST = os.getenv("SENTINEL_ENGINE_HOST", "127.0.0.1")
    PORT = int(os.getenv("SENTINEL_ENGINE_PORT", 5000))
    
    print(f"[INFO] Starting Sentinel Engine server at http://{HOST}:{PORT}")
    # Run the app. In a production environment, you would use a WSGI server like Gunicorn.
    app.run(host=HOST, port=PORT, debug=False)


### How to Run This Server

# 1. **Save Your Model:** After you've trained your model in your `trainer.py`, you need to save it and the vectorizer.
#    * **Saving the model:** model.save('sentinel-engine/saved_models/truthwarper_model.h5')
#    * **Saving the vectorizer:**
#    ```python
#    # In your trainer after adapting the vectorizer
#    import pickle
# vectorizer_config = {'config': vectorizer.get_config(), 'weights': vectorizer.get_weights()}
# with open('sentinel-engine/saved_models/vectorizer.pkl', 'wb') as f:
#     pickle.dump(vectorizer_config, f)

# 2. **Set Environment Variables:** Add the host and port to your root `.env` file.
# ```env
# # For the Python API Server
# SENTINEL_ENGINE_HOST=127.0.0.1
# SENTINEL_ENGINE_PORT=5000
# ```

# 3. **Install Dependencies:** From inside the `sentinel-engine/` directory, run:
# ```bash
# pip install -r requirements.txt
# ```

# 4. **Start the Server:** From inside the `sentinel-engine/` directory, run:
# ```bash
# python src/api/server.py