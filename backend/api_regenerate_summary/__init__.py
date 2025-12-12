import azure.functions as func
import logging
import json
import os
from azure.storage.blob import BlobServiceClient
from azure.storage.blob import BlobServiceClient
from ..shared.auth import authenticate_request
from ..process_file.ingestion_logic import generate_summary, store_document_metadata, extract_text_from_pdf

@authenticate_request
def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function processed a request to regenerate summary.')

    # 2. Parse Request Body
    try:
        req_body = req.get_json()
    except ValueError:
        return func.HttpResponse("Invalid JSON", status_code=400)
    
    project_id = req_body.get('projectId')
    filename = req_body.get('filename')

    if not project_id or not filename:
        return func.HttpResponse("projectId and filename are required", status_code=400)

    # 3. Connect to Blob Storage and Get File Content
    connection_string = os.getenv("BLOB_STORAGE_CONNECTION_STRING")
    if not connection_string:
        return func.HttpResponse("Storage configuration error", status_code=500)

    try:
        blob_service_client = BlobServiceClient.from_connection_string(connection_string)
        container_name = "docs"
        blob_client = blob_service_client.get_blob_client(container=container_name, blob=f"{project_id}/{filename}")
        
        if not blob_client.exists():
             return func.HttpResponse("File not found in storage", status_code=404)

        download_stream = blob_client.download_blob()
        file_content = download_stream.readall()
        
        # 4. Extract Text
        text = ""
        if filename.lower().endswith('.txt'):
            try:
                text = file_content.decode('utf-8')
            except UnicodeDecodeError:
                text = file_content.decode('latin-1')
        else:
            # For PDF or others, use Document Intelligence
            # extract_text_from_pdf expects bytes
            text = extract_text_from_pdf(file_content)
        
        if not text.strip():
             return func.HttpResponse("Could not extract text from file", status_code=400)

        # 5. Generate Summary
        summary = generate_summary(text)
        
        # 6. Store/Update Metadata
        store_document_metadata(filename, summary, project_id)

        return func.HttpResponse(
            json.dumps({"summary": summary}),
            mimetype="application/json",
            status_code=200
        )

    except Exception as e:
        logging.error(f"Error regenerating summary: {e}")
        return func.HttpResponse(f"Internal Server Error: {str(e)}", status_code=500)
