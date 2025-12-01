# LearnAI Azure Functions Backend

This project contains the Azure Functions backend for the LearnAI application, handling file uploads and processing for RAG (Retrieval-Augmented Generation) ingestion.

## Project Structure

- **`upload_file/`**: HTTP Trigger function to upload files to Azure Blob Storage.
- **`process_file/`**: Blob Trigger function that triggers when a file is uploaded to the `documents` container, processing the file for ingestion.
- **`shared/`**: Shared code and logic used by multiple functions.

## Prerequisites

- Python 3.12
- Azure Functions Core Tools
- Azure CLI

## Local Development

1.  **Create a virtual environment:**
    ```bash
    python -m venv .venv
    source .venv/bin/activate  # On Windows: .venv\Scripts\activate
    ```

2.  **Install dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

3.  **Configure Local Settings:**
    Ensure you have a `local.settings.json` file with the following structure (do not commit this file):
    ```json
    {
      "IsEncrypted": false,
      "Values": {
        "AzureWebJobsStorage": "UseDevelopmentStorage=true",
        "FUNCTIONS_WORKER_RUNTIME": "python",
        "AzureWebJobsSecretStorageType": "files",
        "BLOB_CONNECTION_STRING": "<Your Azure Storage Connection String>"
      }
    }
    ```

4.  **Run the functions locally:**
    ```bash
    func start
    ```

## Deployment

This project is configured to deploy to Azure Functions via GitHub Actions.

- **Workflow File**: `.github/workflows/azure-functions-app.yml`
- **Azure Configuration**:
    - App Name: `func-learn-ai`
    - Python Version: `3.12`

### Secrets Required in GitHub

- `AZURE_FUNCTIONAPP_PUBLISH_PROFILE`: The publish profile XML for the Azure Function App.

## Architecture

1.  **Upload**: User calls `upload_file` -> File saved to Blob Storage (`documents` container).
2.  **Process**: `process_file` triggers on new blob -> Reads file -> Runs ingestion logic -> Stores embeddings/data.
