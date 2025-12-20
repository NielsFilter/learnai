import os
import firebase_admin
from firebase_admin import credentials, auth
import logging

# Initialize Firebase Admin
# We expect FIREBASE_SERVICE_ACCOUNT_KEY to be the JSON content of the service account key.
# Alternatively, FIREBASE_PROJECT_ID can be provided for limited functionality/identity-based auth.

def initialize_firebase():
    try:
        firebase_admin.get_app()
    except ValueError:
        # App not initialized
        
        # Try Key Content (JSON string from environment variable)
        key_content = os.getenv("FIREBASE_SERVICE_ACCOUNT_KEY")
        if key_content:
            import json
            try:
                # Basic cleanup in case of accidental escaping
                cleaned_content = key_content.strip()
                cred_dict = json.loads(cleaned_content)
                
                project_id = cred_dict.get('project_id')
                cred = credentials.Certificate(cred_dict)
                logging.info(f"Firebase initialized with environment variable key for project: {project_id}")
                firebase_admin.initialize_app(cred)
                return
            except Exception as e:
                logging.error(f"Failed to initialize Firebase with FIREBASE_SERVICE_ACCOUNT_KEY: {e}")

        # Fallback to Project ID if provided (useful for managed identity or partial configs)
        project_id = os.getenv("FIREBASE_PROJECT_ID") or os.getenv("GOOGLE_CLOUD_PROJECT")
        if project_id:
            logging.info(f"Firebase initializing with project ID: {project_id}")
            firebase_admin.initialize_app(options={'projectId': project_id})
        else:
            logging.warning("No Firebase credentials or project ID found in environment variables.")
            firebase_admin.initialize_app()

def verify_token(id_token: str):
    initialize_firebase()
    try:
        decoded_token = auth.verify_id_token(id_token, clock_skew_seconds=5)
        return decoded_token
    except Exception as e:
        logging.error(f"Token verification failed: {e}")
        raise ValueError("Invalid token")

import functools
import azure.functions as func

def authenticate_request(f):
    @functools.wraps(f)
    def wrapper(req: func.HttpRequest, *args, **kwargs):
        # 1. Verify Token
        auth_header = req.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return func.HttpResponse("Unauthorized", status_code=401)
        
        token = auth_header.split(' ')[1]
        try:
            user = verify_token(token)
            # Attach user to the request object so the wrapped function can access it
            # Note: Python objects are dynamic, so this usually works unless __slots__ prevents it.
            # Azure Functions HttpRequest doesn't restrict this.
            req.user = user
        except ValueError:
            return func.HttpResponse("Invalid Token", status_code=401)
            
        return f(req, *args, **kwargs)
    return wrapper
