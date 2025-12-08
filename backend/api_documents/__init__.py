import azure.functions as func
import logging
import json
import os
from pymongo import MongoClient
from ..shared.auth import verify_token

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function processed a request for documents.')

    # 1. Verify Token
    auth_header = req.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return func.HttpResponse("Unauthorized", status_code=401)
    
    token = auth_header.split(' ')[1]
    try:
        verify_token(token)
    except ValueError:
        return func.HttpResponse("Invalid Token", status_code=401)

    # 2. Get Project ID
    project_id = req.params.get('projectId')
    if not project_id:
        return func.HttpResponse("Project ID is required", status_code=400)

    # 3. Connect to DB
    connection_string = os.getenv("MONGO_DB_CONNECTION_STRING")
    if not connection_string:
         return func.HttpResponse("Database configuration error", status_code=500)
    
    client = MongoClient(connection_string)
    db = client["learnai"]
    documents_collection = db["documents"]

    # 4. Fetch Documents
    try:
        documents = list(documents_collection.find({"projectId": project_id}))
        
        # Convert ObjectId to str if present (though we are not using _id for anything specific yet)
        for doc in documents:
            if '_id' in doc:
                doc['_id'] = str(doc['_id'])
        
        return func.HttpResponse(
            json.dumps(documents),
            mimetype="application/json",
            status_code=200
        )
    except Exception as e:
        logging.error(f"Error fetching documents: {e}")
        return func.HttpResponse("Internal Server Error", status_code=500)
