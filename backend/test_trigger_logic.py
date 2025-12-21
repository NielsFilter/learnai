
import logging
import sys
from unittest.mock import MagicMock

# Mock azure.functions
sys.modules["azure.functions"] = MagicMock()
import azure.functions as func

# Mock ingestion_logic
sys.modules["process_file.ingestion_logic"] = MagicMock()
from process_file import main, ingestion_logic

def test_trigger():
    # Setup mock blob
    mock_blob = MagicMock()
    mock_blob.name = "docs/test-project/my/nested/file.pdf"
    mock_blob.read.return_value = b"fake content"
    mock_blob.length = 123

    # Call main
    print("Testing trigger with path: docs/test-project/my/nested/file.pdf")
    try:
        main(mock_blob)
    except Exception as e:
        print(f"FAILED: {e}")
        return

    # Verify ingestion_logic called correctly
    # Expected: project_id="test-project", name="my/nested/file.pdf"
    
    ingestion_logic.process_document.assert_called_once()
    args = ingestion_logic.process_document.call_args
    print(f"Called with args: {args}")
    
    name, content, project_id = args[0]
    
    if project_id == "test-project" and name == "my/nested/file.pdf":
        print("SUCCESS: Project ID and Name parsed correctly.")
    else:
        print(f"FAILURE: Expected 'test-project' and 'my/nested/file.pdf', got '{project_id}' and '{name}'")

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    test_trigger()
