"""
Main application file for the chatbot API.
"""
import logging
import os
import asyncio
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

import config
from services.gemini_service import GeminiService
from services.nvidia_service import NvidiaService
from services.mcp_service import MCPService
from services.chat_service import ChatService
from services.agent_service import AgentService
from routes.chat import chat_bp, init_routes as init_chat_routes
from routes.mcp import mcp_bp, init_routes as init_mcp_routes
from routes.health import health_bp, init_routes as init_health_routes
from routes.workflow import workflow_bp

# Helper function to run async functions
def run_async(coro):
    """Run an async function and return its result."""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()

# Configure logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Create Flask app
app = Flask(__name__)
# Enable CORS for all routes
CORS(app, supports_credentials=True, origins="*", allow_headers=["Content-Type", "Authorization", "Accept"])

# Initialize services
gemini_service = GeminiService(api_key=config.GEMINI_API_KEY)
nvidia_service = NvidiaService(api_key=config.NVIDIA_API_KEY)
mcp_service = MCPService()
agent_service = AgentService()

# Connect to MCP server and fetch available tools
logger.info("Connecting to MCP server...")
mcp_connected = run_async(mcp_service.connect())
if mcp_connected:
    # Get available tools
    available_tools = run_async(mcp_service.list_available_tools())
    logger.info(f"Fetched {len(available_tools)} tools from MCP server")

    # Update Gemini service with available tools
    gemini_service.set_available_tools(available_tools)
    logger.info("Updated Gemini service with available tools")
else:
    logger.warning("Failed to connect to MCP server")

# Initialize chat service
chat_service = ChatService(gemini_service, nvidia_service, mcp_service)

# Initialize routes
init_chat_routes(chat_service)
init_mcp_routes(mcp_service)
init_health_routes(mcp_service)

# Register blueprints
app.register_blueprint(chat_bp)
app.register_blueprint(mcp_bp)
app.register_blueprint(health_bp)
app.register_blueprint(workflow_bp)

# File upload directory
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

@app.route('/api/upload', methods=['POST'])
def upload_file():
    """
    File upload endpoint.
    """
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400

    file = request.files['file']

    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    if file:
        filename = os.path.basename(file.filename)
        file_path = os.path.join(UPLOAD_FOLDER, filename)
        file.save(file_path)

        return jsonify({
            "success": True,
            "filename": filename,
            "path": file_path
        })

    return jsonify({"error": "File upload failed"}), 400

@app.route('/api/uploads/<filename>', methods=['GET'])
def get_file(filename):
    """
    File download endpoint.
    """
    return send_from_directory(UPLOAD_FOLDER, filename)

if __name__ == '__main__':
    if not config.GEMINI_API_KEY:
        logger.warning("WARNING: GEMINI_API_KEY is not set. The chatbot will not work properly.")

    app.run(
        host=config.HOST,
        port=config.PORT,
        debug=config.DEBUG
    )
