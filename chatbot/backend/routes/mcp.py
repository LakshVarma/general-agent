"""
MCP routes for the chatbot API.
"""
import json
import logging
from typing import Dict, Any, Generator
from flask import Blueprint, request, jsonify, Response, stream_with_context

from services.mcp_service import MCPService
from services.mcp.client import run_async

# Configure logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Create a blueprint for MCP routes
mcp_bp = Blueprint('mcp', __name__)

# MCP service will be set by the app
mcp_service = None

def init_routes(service: MCPService):
    """
    Initialize the MCP routes with the MCP service.

    Args:
        service: The MCP service to use.
    """
    global mcp_service
    mcp_service = service

@mcp_bp.route('/api/mcp/services', methods=['GET'])
def list_services():
    """
    List available MCP services and their tools.
    """
    try:
        services = run_async(mcp_service.list_services())
        return jsonify({
            "success": True,
            "services": services
        })
    except Exception as e:
        logger.error(f"Error listing MCP services: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@mcp_bp.route('/api/mcp/tools', methods=['GET'])
def list_tools():
    """
    List all available MCP tools.
    """
    try:
        tools = run_async(mcp_service.list_available_tools())
        return jsonify({
            "success": True,
            "tools": tools
        })
    except Exception as e:
        logger.error(f"Error listing MCP tools: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@mcp_bp.route('/api/mcp/call', methods=['POST'])
def call_tool():
    """
    Call a specific MCP tool with parameters.
    """
    data = request.json
    logger.debug(f"MCP call request received: {data}")

    if not data:
        logger.error("Error: Tool data is required")
        return jsonify({"error": "Tool data is required"}), 400

    if 'tool_name' not in data:
        logger.error("Error: tool_name is required")
        return jsonify({"error": "tool_name is required"}), 400

    if 'params' not in data:
        logger.error("Error: params is required")
        return jsonify({"error": "params is required"}), 400

    tool_name = data['tool_name']
    params = data['params']

    logger.debug(f"Calling MCP tool: {tool_name} with params: {params}")

    # Extract service and action from tool_name (e.g., gmail_send_email -> gmail, send_email)
    parts = tool_name.split('_', 1)
    service = parts[0] if len(parts) > 0 else "unknown"
    action = parts[1] if len(parts) > 1 else "unknown"

    # Create a response with streaming
    def generate() -> Generator[str, None, None]:
        """Generate streaming response."""
        try:
            # Send a message that we're connecting to the tool
            yield json.dumps({
                "type": "status",
                "text": f"Connecting to {service} {action} tool..."
            }) + "\n"

            # Call the MCP tool
            result = run_async(mcp_service.call_tool(tool_name, params))
            logger.debug(f"MCP tool result: {result}")

            # Send the result
            yield json.dumps({
                "success": True,
                "result": result
            }) + "\n"
        except Exception as e:
            logger.error(f"Error calling MCP tool: {e}")
            import traceback
            traceback.print_exc()
            yield json.dumps({
                "success": False,
                "error": str(e)
            }) + "\n"

    return Response(stream_with_context(generate()), mimetype='text/event-stream')
