import azure.functions as func
import logging
import json
import os
from pymongo import MongoClient
from datetime import datetime
from ..shared.auth import verify_token

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function processed a request.')

    # 1. Verify Token
    auth_header = req.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return func.HttpResponse("Unauthorized", status_code=401)
    
    token = auth_header.split(' ')[1]
    try:
        user = verify_token(token)
        uid = user['uid']
    except ValueError:
        return func.HttpResponse("Invalid Token", status_code=401)

    # 2. Connect to DB
    connection_string = os.getenv("MONGO_DB_CONNECTION_STRING")
    if not connection_string:
         return func.HttpResponse("Database configuration error", status_code=500)
    
    client = MongoClient(connection_string)
    db = client["learnai"]
    projects_collection = db["projects"]

    # 3. Handle Requests
    if req.method == 'GET':
        # List projects for user
        projects = list(projects_collection.find({"ownerId": uid}))
        # Convert ObjectId to str
        for p in projects:
            p['_id'] = str(p['_id'])
        
        return func.HttpResponse(
            json.dumps(projects),
            mimetype="application/json",
            status_code=200
        )

    elif req.method == 'POST':
        # Create new project
        try:
            req_body = req.get_json()
        except ValueError:
            return func.HttpResponse("Invalid JSON", status_code=400)
        
        name = req_body.get('name')
        subject = req_body.get('subject')
        
        if not name or not subject:
            return func.HttpResponse("Name and Subject are required", status_code=400)
        
        new_project = {
            "name": name,
            "subject": subject,
            "ownerId": uid,
            "createdAt": datetime.utcnow().isoformat()
        }
        
        result = projects_collection.insert_one(new_project)
        new_project['_id'] = str(result.inserted_id)
        
        return func.HttpResponse(
            json.dumps(new_project),
            mimetype="application/json",
            status_code=201
        )

    return func.HttpResponse("Method not allowed", status_code=405)
