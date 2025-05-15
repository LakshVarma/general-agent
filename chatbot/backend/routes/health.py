"""
Health check routes for the chatbot API.
"""
import logging
from flask import Blueprint, jsonify

from services.mcp_service import MCPService
import config

# Configure logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Create a blueprint for health routes
health_bp = Blueprint('health', __name__)

# MCP service will be set by the app
mcp_service = None

def init_routes(service: MCPService):
    """
    Initialize the health routes with the MCP service.

    Args:
        service: The MCP service to use.
    """
    global mcp_service
    mcp_service = service

@health_bp.route('/api/health', methods=['GET'])
def health_check():
    """
    Health check endpoint.
    """
    mcp_services = list(mcp_service.tools_service.tool_categories.keys()) if hasattr(mcp_service.tools_service, 'tool_categories') else []

    return jsonify({
        "status": "ok",
        "gemini_api_configured": bool(config.GEMINI_API_KEY),
        "nvidia_api_configured": bool(config.NVIDIA_API_KEY),
        "default_model": config.DEFAULT_MODEL,
        "mcp_connected": mcp_service.client.client.is_connected() if hasattr(mcp_service.client.client, 'is_connected') else False,
        "mcp_services": mcp_services
    })
