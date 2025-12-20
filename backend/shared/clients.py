import os
from openai import AzureOpenAI
from pymongo import MongoClient
from azure.storage.blob import BlobServiceClient
from azure.core.credentials import AzureKeyCredential
from azure.ai.documentintelligence import DocumentIntelligenceClient

def get_openai_client():
    return AzureOpenAI(
        api_key=os.getenv("AZURE_OPENAI_API_KEY"),
        api_version="2024-12-01-preview",
        azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT")
    )

def get_document_intelligence_client():
    endpoint = os.getenv("AZURE_FORM_RECOGNIZER_ENDPOINT")
    key = os.getenv("AZURE_FORM_RECOGNIZER_KEY")
    
    if not endpoint or not key:
        raise ValueError("AZURE_FORM_RECOGNIZER_ENDPOINT and AZURE_FORM_RECOGNIZER_KEY must be set")

    return DocumentIntelligenceClient(endpoint=endpoint, credential=AzureKeyCredential(key))

def get_mongo_client():
    connection_string = os.getenv("MONGO_DB_CONNECTION_STRING")
    if not connection_string:
        raise ValueError("MONGO_DB_CONNECTION_STRING is not set")
    return MongoClient(connection_string)

def get_mongo_db():
    client = get_mongo_client()
    return client["mnemoniq"]

def get_blob_service_client():
    connection_string = os.getenv("BLOB_STORAGE_CONNECTION_STRING")
    if not connection_string:
        raise ValueError("BLOB_STORAGE_CONNECTION_STRING must be set")
    return BlobServiceClient.from_connection_string(connection_string)
