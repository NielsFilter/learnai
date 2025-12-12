import azure.functions as func
import logging
import json
import os
from pymongo import MongoClient
from ..shared.auth import authenticate_request

@authenticate_request
def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function processed a request for documents.')

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
