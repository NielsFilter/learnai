import azure.functions as func
import logging
import json
import os
from bson.objectid import ObjectId
from shared.auth import authenticate_request
from shared.clients import get_mongo_db, get_blob_service_client

@authenticate_request
def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function processed a documents request.')
    
    uid = req.user['uid']
    method = req.method
    db = get_mongo_db()

    if method == 'GET':
        # List documents for a project
        project_id = req.params.get('projectId')
        if not project_id:
            return func.HttpResponse("projectId is required", status_code=400)
            
        # Verify access
        project = db.projects.find_one({"_id": ObjectId(project_id), "ownerId": uid})
        if not project:
            return func.HttpResponse("Project not found", status_code=404)
            
        docs = list(db.documents.find({"projectId": project_id}))
        for d in docs:
            d['_id'] = str(d['_id'])
        
        return func.HttpResponse(
            json.dumps(docs),
            mimetype="application/json",
            status_code=200
        )

    elif method == 'DELETE':
        # Delete a specific document
        project_id = req.params.get('projectId')
        filename = req.params.get('filename')
        
        if not project_id or not filename:
            return func.HttpResponse("projectId and filename are required", status_code=400)
            
        # Verify access
        project = db.projects.find_one({"_id": ObjectId(project_id), "ownerId": uid})
        if not project:
            return func.HttpResponse("Project not found", status_code=404)
            
        # Check constraint: Cannot delete the last document - REMOVED
        # doc_count = db.documents.count_documents({"projectId": project_id})
        # if doc_count <= 1:
        #     return func.HttpResponse(
        #         json.dumps({"error": "Cannot delete the last document. A project must have at least one document."}),
        #         status_code=400,
        #         mimetype="application/json"
        #     )
            
        try:
            # 1. Delete from Blob Storage
            blob_service_client = get_blob_service_client()
            container_client = blob_service_client.get_container_client("docs")
            blob_name = f"{project_id}/{filename}"
            
            try:
                container_client.delete_blob(blob_name)
            except Exception as e:
                logging.warning(f"Blob delete failed (might be missing): {e}")

            # 2. Delete vectors (docs collection)
            # Vectors are stored with metadata.projectId AND metadata.source (filename)
            # Need to ensure we match exactly.
            # In process_file/ingestion_logic.py: doc['metadata']['source'] = filename
            
            delete_result = db.docs.delete_many({
                "metadata.projectId": project_id,
                "metadata.source": filename
            })
            logging.info(f"Deleted {delete_result.deleted_count} vectors for {filename}")

            # 3. Delete metadata (documents collection)
            db.documents.delete_one({"projectId": project_id, "filename": filename})
            
            return func.HttpResponse(status_code=204)

        except Exception as e:
            logging.error(f"Error deleting document: {e}")
            return func.HttpResponse(f"Error deleting document: {str(e)}", status_code=500)

    return func.HttpResponse("Method not allowed", status_code=405)
