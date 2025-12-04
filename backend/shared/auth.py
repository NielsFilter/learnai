import os
import firebase_admin
from firebase_admin import credentials, auth
import logging

# Initialize Firebase Admin
# We expect FIREBASE_SERVICE_ACCOUNT_KEY to be a path to the json file or the json content itself
# For simplicity in this environment, we'll assume it's initialized or use default credentials if deployed to Azure with identity
# But for local dev, we might need a service account key.
# For now, let's assume the user will provide the service account key path in env vars.

def initialize_firebase():
    try:
        firebase_admin.get_app()
    except ValueError:
        # App not initialized
        cred_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_KEY_PATH")
        if cred_path and os.path.exists(cred_path):
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
        else:
            # Try default credentials (works on Azure if Identity is set up, or if GOOGLE_APPLICATION_CREDENTIALS is set)
            logging.warning("FIREBASE_SERVICE_ACCOUNT_KEY_PATH not set or not found. Trying default credentials.")
            firebase_admin.initialize_app()

def verify_token(id_token: str):
    initialize_firebase()
    try:
        decoded_token = auth.verify_id_token(id_token)
        return decoded_token
    except Exception as e:
        logging.error(f"Token verification failed: {e}")
        raise ValueError("Invalid token")
