import azure.functions as func
import logging
import os
from azure.storage.blob import BlobServiceClient
from ..shared.auth import authenticate_request
from ..shared.clients import get_mongo_db
from bson.objectid import ObjectId

@authenticate_request
def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function processed an upload request.')
    
    uid = req.user['uid']

    # 2. Parse Multipart Form Data
    # Azure Functions Python worker has limited support for multipart/form-data parsing directly in req.files
    # But we can try to use req.files if available or parse manually.
    # Actually, req.files is not available in the current Python worker model for HTTP trigger easily without a library like python-multipart or using the stream.
    # However, for simplicity, let's assume the client sends the file as binary body and projectId in query or header?
    # Or use a library.
    # A common workaround is to send the file content in body and filename/projectId in headers.
    
    project_id = req.headers.get('X-Project-Id')
    filename = req.headers.get('X-Filename')
    
    if not project_id or not filename:
        return func.HttpResponse("X-Project-Id and X-Filename headers are required", status_code=400)

    # Verify project ownership
    db = get_mongo_db()
    project = db.projects.find_one({"_id": ObjectId(project_id), "ownerId": uid})
    if not project:
        return func.HttpResponse("Project not found or access denied", status_code=404)

    # 3. Upload to Blob Storage
    connection_string = os.getenv("BLOB_STORAGE_CONNECTION_STRING")
    if not connection_string:
        return func.HttpResponse("Storage configuration error", status_code=500)

    try:
        blob_service_client = BlobServiceClient.from_connection_string(connection_string)
        container_name = "docs" # Must match the container in process_file trigger
        
        # Create container if not exists
        try:
            blob_service_client.create_container(container_name)
        except:
            pass # Container might exist

        blob_client = blob_service_client.get_blob_client(container=container_name, blob=f"{project_id}/{filename}")
        
        # Upload data
        file_content = req.get_body()
        blob_client.upload_blob(file_content, overwrite=True)
        
        return func.HttpResponse("File uploaded successfully", status_code=200)

    except Exception as e:
        logging.error(f"Error uploading file: {e}")
        return func.HttpResponse(f"Error uploading file: {str(e)}", status_code=500)
