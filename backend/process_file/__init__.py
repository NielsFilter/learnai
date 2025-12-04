import logging
import azure.functions as func
from . import ingestion_logic

def main(myblob: func.InputStream):
    logging.info(f"Python blob trigger function processed blob \n"
                 f"Name: {myblob.name} \n"
                 f"Blob Size: {myblob.length} bytes")

    try:
        # The name comes as "docs/project_id/filename.pdf"
        parts = myblob.name.split('/')
        if len(parts) >= 3:
            project_id = parts[1]
            filename = parts[-1]
        else:
            # Fallback for legacy or root files
            project_id = "global"
            filename = parts[-1]
        
        # Read the blob content
        file_content = myblob.read()
        
        # Process the document
        ingestion_logic.process_document(filename, file_content, project_id)
        
    except Exception as e:
        logging.error(f"Error processing blob {myblob.name}: {e}")
        raise
