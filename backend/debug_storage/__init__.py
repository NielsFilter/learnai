import logging
import azure.functions as func
import os
from azure.storage.blob import BlobServiceClient

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Debug Storage function processing request.')

    conn_str = os.getenv("BLOB_STORAGE_CONNECTION_STRING")
    if not conn_str:
        return func.HttpResponse(
            "ERROR: BLOB_STORAGE_CONNECTION_STRING is missing from App Settings.",
            status_code=500
        )

    results = {
        "status": "Check complete",
        "connection_string_found": True,
        "containers": [],
        "docs_blobs": []
    }

    try:
        blob_service_client = BlobServiceClient.from_connection_string(conn_str)
        
        # 1. List Containers
        containers = blob_service_client.list_containers()
        results["containers"] = [c.name for c in containers]

        # 2. List Blobs in 'docs'
        container_client = blob_service_client.get_container_client("docs")
        if container_client.exists():
            blobs = container_client.list_blobs()
            results["docs_blobs"] = [b.name for b in blobs]
        else:
             results["error"] = "Container 'docs' does not exist."

        return func.HttpResponse(
            str(results),
            status_code=200,
            mimetype="application/json"
        )

    except Exception as e:
        return func.HttpResponse(
            f"EXCEPTION: {str(e)}",
            status_code=500
        )
