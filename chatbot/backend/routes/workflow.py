from flask import Blueprint, request, jsonify
from chatbot.backend.services.workflow_service import WorkflowService
import logging

# Configure logging for the blueprint
# It's good practice to use __name__ for the logger name.
# The actual log output will depend on the Flask app's logging configuration.
logger = logging.getLogger(__name__)

# Defines a Blueprint for workflow-related operations.
# The `url_prefix` will prepend '/workflow' to all routes defined in this blueprint.
workflow_bp = Blueprint('workflow_bp', __name__, url_prefix='/workflow')

@workflow_bp.route('/execute', methods=['POST'])
def execute_workflow_route():
    """
    API endpoint to execute a workflow.
    The workflow definition is expected in the JSON body of the request.
    """
    try:
        # Get the JSON data from the request.
        # If the content type is not 'application/json', this will result in a 400 error automatically (werkzeug behavior).
        # If the JSON is malformed, request.get_json() will raise an error caught below.
        workflow_definition = request.get_json()
        if workflow_definition is None: # get_json() returns None if parsing fails with silent=True, or if data is not present
            logger.warning("Request did not contain valid JSON data or was empty.")
            return jsonify({"error": "Invalid or missing JSON payload"}), 400
    except Exception as e: # Catch broader exceptions during JSON parsing, though Werkzeug usually handles content-type
        logger.error(f"Error parsing JSON payload: {e}", exc_info=True)
        return jsonify({"error": "Failed to parse JSON payload", "details": str(e)}), 400

    # Instantiate the WorkflowService for each request.
    # This means workflows are loaded and executed on-the-fly based on the request.
    workflow_service = WorkflowService()

    try:
        # The workflow definition itself must contain the 'name' of the workflow.
        workflow_name = workflow_definition.get("name")
        if not workflow_name:
            logger.error("Workflow definition in payload must have a 'name' attribute.")
            return jsonify({"error": "Workflow definition must include a 'name' attribute"}), 400

        # Load the workflow definition into the service.
        workflow_service.load_workflow(workflow_definition)
        logger.info(f"Workflow '{workflow_name}' loaded for execution.")

        # Execute the workflow.
        results = workflow_service.execute_workflow(workflow_name)
        logger.info(f"Workflow '{workflow_name}' executed successfully via API. Returning results.")
        return jsonify(results), 200

    except ValueError as ve:
        # ValueErrors are typically raised by WorkflowService for known issues
        # (e.g., workflow not found, issues with step definitions, unresolved references if critical).
        logger.error(f"ValueError during workflow processing for '{workflow_definition.get('name', 'unknown')}': {ve}", exc_info=True)
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        # Catch-all for other unexpected errors during workflow service operations.
        logger.critical(f"An unexpected error occurred during workflow execution for '{workflow_definition.get('name', 'unknown')}': {e}", exc_info=True)
        return jsonify({"error": "An unexpected server error occurred", "details": str(e)}), 500

# --- Instructions for registering this Blueprint in your main Flask app (e.g., app.py or app_new.py) ---
#
# To use this blueprint, you need to import it and register it with your Flask application instance.
#
# 1.  **Import the Blueprint**:
#     Add the following import statement at the top of your main Flask app file:
#
#     ```python
#     from chatbot.backend.routes.workflow import workflow_bp
#     ```
#
# 2.  **Register the Blueprint**:
#     After you have created your Flask app instance (e.g., `app = Flask(__name__)`),
#     register the blueprint like this:
#
#     ```python
#     app.register_blueprint(workflow_bp)
#     ```
#
# 3.  **Ensure Python Packaging (`__init__.py` files)**:
#     For the import `from chatbot.backend.services.workflow_service import WorkflowService`
#     and the blueprint import itself to work, ensure you have `__init__.py` files
#     in the `chatbot`, `chatbot/backend`, `chatbot/backend/routes`, and
#     `chatbot/backend/services` directories. These files can be empty.
#     This makes Python treat these directories as packages.
#
#     Directory structure example:
#     ```
#     your_project_root/
#     ├── app.py  (or your main Flask app file)
#     └── chatbot/
#         ├── __init__.py
#         └── backend/
#             ├── __init__.py
#             ├── routes/
#             │   ├── __init__.py
#             │   └── workflow.py  (this file)
#             └── services/
#                 ├── __init__.py
#                 └── workflow_service.py
#     ```
#
# 4.  **Run your Flask app**:
#     Make sure your Flask application is run from a context where the `chatbot` package
#     is discoverable (e.g., run from `your_project_root/`).
#
# 5.  **Logging (Recommended)**:
#     This blueprint uses `logging.getLogger(__name__)`. To see these log messages,
#     ensure logging is configured in your Flask app. Example basic configuration:
#
#     ```python
#     import logging
#     logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
#     # For more detailed debug logs from this blueprint and service:
#     # logging.getLogger('chatbot').setLevel(logging.DEBUG)
#     ```
#
# --- Example: How to Test This Endpoint ---
#
# Once the Flask app is running with the blueprint registered, you can send a POST request
# to `/workflow/execute`. (Note: `/workflow` is the `url_prefix`).
#
# Using `curl`:
# ```bash
# curl -X POST http://127.0.0.1:5000/workflow/execute \
#      -H "Content-Type: application/json" \
#      -d '{
#            "name": "my_api_workflow",
#            "steps": [
#              {
#                "name": "step_one_generate",
#                "type": "data_generation",
#                "inputs": {"source": "api_request_data"}
#              },
#              {
#                "name": "step_two_echo",
#                "type": "echo",
#                "inputs": {
#                  "message": "{{steps.step_one_generate.outputs.generated_data}}"
#                }
#              }
#            ]
#          }'
# ```
#
# Expected successful response (HTTP 200):
# ```json
# {
#   "step_one_generate": {
#     "generated_data": "Generated data based on api_request_data"
#   },
#   "step_two_echo": {
#     "echoed_message": "Generated data based on api_request_data"
#   }
# }
# ```
#
# If you send a request without a "name" in the workflow definition:
# Expected error response (HTTP 400):
# ```json
# {
#   "error": "Workflow definition must include a 'name' attribute"
# }
# ```
#
# If the JSON is malformed:
# Expected error response (HTTP 400):
# ```json
# {
#   "error": "Failed to parse JSON payload"
# }
# ```
#
# (The exact error message for malformed JSON might vary slightly based on Flask/Werkzeug version).
#
# This setup provides a functional API endpoint for dynamically executing workflows.
#
# --- End of Instructions ---
#
