import logging
import azure.functions as func
import os
from azure.storage.blob import BlobServiceClient

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function processed a request.')

    try:
        # Get metadata from headers
        filename = req.headers.get("X-Filename")
        project_id = req.headers.get("X-Project-Id")
        
        # If it's application/octet-stream, req.files will be empty
        # We get the raw bytes from get_body()
        if not req.files:
            file_content = req.get_body() # This reads the entire body into memory
            if not file_content:
                 return func.HttpResponse("No file content found", status_code=400)
            
            # Use the filename from the header you sent in React
            actual_filename = filename if filename else "uploaded_file"
        else:
            # Fallback for multipart if needed
            file = list(req.files.values())[0]
            file_content = file.read()
            actual_filename = file.filename

        # ... your Blob Storage upload logic ...
        connect_str = os.getenv('BLOB_STORAGE_CONNECTION_STRING')
        blob_service_client = BlobServiceClient.from_connection_string(connect_str)
        blob_client = blob_service_client.get_blob_client(container="docs", blob=actual_filename)
        blob_client.upload_blob(file_content, overwrite=True)

        return func.HttpResponse(f"File {actual_filename} uploaded.", status_code=200)

    except Exception as e:
        logging.error(f"Error: {e}")
        return func.HttpResponse(str(e), status_code=500)