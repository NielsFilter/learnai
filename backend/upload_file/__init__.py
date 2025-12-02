import logging
import azure.functions as func
import os
from azure.storage.blob import BlobServiceClient

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function processed a request.')

    try:
        max_mb = int(os.getenv("MAX_FILE_SIZE_MB", 4))
        max_bytes = max_mb * 1024 * 1024

        # 1. Early check using Content-Length header
        content_length = req.headers.get("Content-Length")
        if content_length:
            try:
                if int(content_length) > max_bytes:
                     return func.HttpResponse(
                        f"Request body too large. Maximum size is {max_mb}MB.",
                        status_code=413
                    )
            except ValueError:
                pass

        # Check if the request contains a file
        # Note: Azure Functions HTTP trigger handling of multipart/form-data can be tricky.
        # We'll assume the file content is sent in the body or as a form data.
        # For simplicity in this example, we'll try to read from form data.
        
        file = None
        filename = None

        # Try to get file from files collection (standard multipart/form-data)
        if req.files:
            for f in req.files.values():
                file = f
                filename = f.filename
                break
        
        if not file:
             return func.HttpResponse(
                "Please pass a file in the request body",
                status_code=400
            )

        # Check file size safely with chunked reading
        file_content = bytearray()
        chunk_size = 1024 * 1024 # 1MB chunks

        while True:
            chunk = file.stream.read(chunk_size)
            if not chunk:
                break
            file_content.extend(chunk)
            if len(file_content) > max_bytes:
                 return func.HttpResponse(
                    f"File too large. Maximum size is {max_mb}MB.",
                    status_code=413
                )

        # Connect to Blob Storage
        connect_str = os.getenv('BLOB_STORAGE_CONNECTION_STRING') #TODO: Managed identity...
        blob_service_client = BlobServiceClient.from_connection_string(connect_str)
        container_name = "documents"
        
        # Create container if it doesn't exist
        container_client = blob_service_client.get_container_client(container_name)
        if not container_client.exists():
            container_client.create_container()

        # Upload file
        blob_client = container_client.get_blob_client(filename)
        blob_client.upload_blob(file_content, overwrite=True)

        return func.HttpResponse(f"File {filename} uploaded successfully.", status_code=200)

    except Exception as e:
        logging.error(f"Error uploading file: {e}")
        return func.HttpResponse(
            f"An error occurred: {str(e)}",
            status_code=500
        )
