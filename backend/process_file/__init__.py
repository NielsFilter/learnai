import logging
import azure.functions as func
from . import ingestion_logic

def main(myblob: func.InputStream):
    logging.info(f"Python blob trigger function processed blob \n"
                 f"Name: {myblob.name} \n"
                 f"Blob Size: {myblob.length} bytes")

    try:
        # Expected path structure: docs/{project_id}/{filename}
        # myblob.name typically returns the full path including container, e.g., "docs/123/example.pdf"
        
        blob_name_full = myblob.name
        
        # Remove container name "docs/" if present at start
        if blob_name_full.startswith("docs/"):
            blob_path_relative = blob_name_full[5:]
        else:
            blob_path_relative = blob_name_full

        parts = blob_path_relative.split('/')
        
        if len(parts) < 2:
            logging.warning(f"Blob path '{blob_path_relative}' does not match expected structure 'project_id/filename'. Skipping.")
            return

        project_id = parts[0]
        # The filename might be nested or simple. We'll take the rest as the filename.
        # However, looking at the previous binding {name}, it likely expected a flat structure or just the rest.
        # Let's assume the rest of the path is the name.
        name = "/".join(parts[1:])
        
        logging.info(f"Parsed project_id: {project_id}, name: {name}")

        # Read the blob content
        file_content = myblob.read()
        
        # Process the document
        ingestion_logic.process_document(name, file_content, project_id)
        
    except Exception as e:
        logging.error(f"Error processing blob {myblob.name}: {e}")
        raise
