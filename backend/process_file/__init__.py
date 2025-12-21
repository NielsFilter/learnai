import logging
import azure.functions as func
from . import ingestion_logic

def main(myblob: func.InputStream, project_id: str, name: str):
    logging.info(f"Python blob trigger function processed blob \n"
                 f"Name: {myblob.name} \n"
                 f"Blob Size: {myblob.length} bytes")

    try:
        # project_id and name are extracted from the path "docs/{project_id}/{name}"
        # using the binding pattern in function.json
        
        # Read the blob content
        file_content = myblob.read()
        
        # Process the document
        ingestion_logic.process_document(name, file_content, project_id)
        
    except Exception as e:
        logging.error(f"Error processing blob {myblob.name}: {e}")
        raise
