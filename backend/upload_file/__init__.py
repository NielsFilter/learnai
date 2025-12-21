import logging
import azure.functions as func
import os
from azure.storage.blob import BlobServiceClient

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function processed a request.....')

    try:
        max_mb = int(os.getenv("MAX_FILE_SIZE_MB", 20))
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
        
        uploaded_files = []
        errors = []

        # Try to get file from files collection (standard multipart/form-data)
        if req.files:
            for f in req.files.values():
                try:
                    file = f
                    filename = f.filename
                    
                    # Check file size safely with chunked reading
                    file_content = bytearray()
                    chunk_size = 1024 * 1024 # 1MB chunks
                    
                    # Reset stream position just in case
                    if hasattr(file.stream, 'seek'):
                        file.stream.seek(0)

                    while True:
                        chunk = file.stream.read(chunk_size)
                        if not chunk:
                            break
                        file_content.extend(chunk)
                        if len(file_content) > max_bytes:
                             errors.append(f"File {filename} too large. Maximum size is {max_mb}MB.")
                             break
                    
                    if len(file_content) > max_bytes:
                        continue

                    # Connect to Blob Storage
                    connect_str = os.getenv('BLOB_STORAGE_CONNECTION_STRING')
                    blob_service_client = BlobServiceClient.from_connection_string(connect_str)
                    container_name = "docs"
                    
                    # Create container if it doesn't exist
                    container_client = blob_service_client.get_container_client(container_name)
                    if not container_client.exists():
                        container_client.create_container()

                    # Upload file
                    blob_client = container_client.get_blob_client(filename)
                    blob_client.upload_blob(bytes(file_content), overwrite=True)
                    uploaded_files.append(filename)

                except Exception as e:
                    errors.append(f"Error uploading {filename}: {str(e)}")

        if not uploaded_files and not errors:
             return func.HttpResponse(
                "Please pass files in the request body",
                status_code=400
            )

        if errors:
            return func.HttpResponse(
                f"Uploaded: {', '.join(uploaded_files)}. Errors: {'; '.join(errors)}",
                status_code=207 if uploaded_files else 400
            )

        return func.HttpResponse(f"Files {', '.join(uploaded_files)} uploaded successfully.", status_code=200)

    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        logging.error(f"Error uploading file: {e}")
        logging.error(tb)
        return func.HttpResponse(
            f"An error occurred: {str(e)}\n\nTraceback:\n{tb}",
            status_code=500
        )
