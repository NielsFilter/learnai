import azure.functions as func
import logging
import json
import os
from pymongo import MongoClient
from bson import ObjectId
from datetime import datetime
from datetime import datetime
from shared.auth import authenticate_request

@authenticate_request
def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function processed a request.')
    
    uid = req.user['uid']

    # 2. Connect to DB
    connection_string = os.getenv("MONGO_DB_CONNECTION_STRING")
    if not connection_string:
         return func.HttpResponse("Database configuration error", status_code=500)
    
    client = MongoClient(connection_string)
    db = client["mnemoniq"]
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
            "status": "created",
            "processingCount": 0,
            "createdAt": datetime.utcnow().isoformat()
        }
        
        result = projects_collection.insert_one(new_project)
        new_project['_id'] = str(result.inserted_id)
        
        return func.HttpResponse(
            json.dumps(new_project),
            mimetype="application/json",
            status_code=201
        )

    elif req.method == 'DELETE':
        # Delete project
        project_id = req.params.get('id')
        if not project_id:
             return func.HttpResponse("Project ID is required", status_code=400)
        
        try:
            oid = ObjectId(project_id)
        except:
             return func.HttpResponse("Invalid Project ID", status_code=400)

        # check ownership
        project = projects_collection.find_one({"_id": oid, "ownerId": uid})
        if not project:
             return func.HttpResponse("Project not found or unauthorized", status_code=404)
        
        # 1. Delete from Blob Storage
        try:
            from shared.clients import get_blob_service_client
            blob_service_client = get_blob_service_client()
            container_client = blob_service_client.get_container_client("docs")
            
            # Blobs are stored as "docs/project_id/filename". Prefix is "project_id/"
            prefix = f"{project_id}/"
            # List blobs starting with project_id/
            blobs = container_client.list_blobs(name_starts_with=prefix)
            for blob in blobs:
                container_client.delete_blob(blob.name)
        except Exception as e:
            logging.error(f"Error deleting blobs: {e}")
        
        # 2. Delete Vector Details (docs collection)
        docs_collection = db["docs"]
        docs_collection.delete_many({"metadata.projectId": project_id})
        
        # 3. Delete Document Metadata (documents collection)
        documents_collection = db["documents"]
        documents_collection.delete_many({"projectId": project_id})

        # 4. Delete Chat History
        db.chat_history.delete_many({"projectId": project_id})

        # 5. Delete Project
        projects_collection.delete_one({"_id": oid})

        return func.HttpResponse(status_code=204)

    return func.HttpResponse("Method not allowed", status_code=405)
