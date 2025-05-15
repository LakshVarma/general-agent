"""
Chat routes for the chatbot API.
"""
import json
import logging
import asyncio
from typing import Dict, Any, Generator, AsyncGenerator
from flask import Blueprint, request, jsonify, Response, stream_with_context

from services.chat_service import ChatService
from services.mcp.client import run_async

# Helper function to collect results from an async generator
async def collect_async_generator(async_gen):
    """Collect all items from an async generator into a list."""
    result = []
    try:
        async for item in async_gen:
            result.append(item)
    except Exception as e:
        logger.error(f"Error collecting from async generator: {e}")
        result.append(json.dumps({"type": "error", "text": str(e)}) + "\n")
        result.append(json.dumps({"type": "done"}) + "\n")
    return result

# Configure logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Create a blueprint for chat routes
chat_bp = Blueprint('chat', __name__)

# Chat service will be set by the app
chat_service = None

def init_routes(service: ChatService):
    """
    Initialize the chat routes with the chat service.

    Args:
        service: The chat service to use.
    """
    global chat_service
    chat_service = service

@chat_bp.route('/api/chat', methods=['POST'])
def chat():
    """
    Chat endpoint.
    """
    data = request.json

    if not data:
        return jsonify({"error": "No data provided"}), 400

    message = data.get('message')
    model = data.get('model', 'gemini-2.5-flash')  # Default to Gemini 2.5 Flash
    session_id = request.cookies.get('session_id', 'default')

    if not message:
        return jsonify({"error": "No message provided"}), 400

    # Get response from chat service
    response, model_used = run_async(chat_service.get_chat_response(message, session_id, model))

    return jsonify({
        "response": response,
        "model_used": model_used
    })

@chat_bp.route('/api/stream', methods=['POST'])
def stream():
    """
    Streaming chat endpoint.
    """
    data = request.json

    if not data:
        return jsonify({"error": "No data provided"}), 400

    message = data.get('message')
    model = data.get('model', 'gemini-2.5-flash')  # Default to Gemini 2.5 Flash
    session_id = request.cookies.get('session_id', 'default')

    if not message:
        return jsonify({"error": "No message provided"}), 400

    async def async_generate():
        """Generate streaming response asynchronously."""
        try:
            # Stream response from chat service
            async for chunk in chat_service.stream_chat_response(message, session_id, model):
                yield json.dumps(chunk) + "\n"

            # Final message to indicate completion
            yield json.dumps({"type": "done"}) + "\n"
        except Exception as e:
            logger.error(f"Error in async_generate: {e}")
            yield json.dumps({"type": "error", "text": str(e)}) + "\n"
            yield json.dumps({"type": "done"}) + "\n"

    def generate() -> Generator[str, None, None]:
        """Generate streaming response."""
        # Use run_async to run the async generator
        for chunk in run_async(collect_async_generator(async_generate())):
            yield chunk

    return Response(stream_with_context(generate()), mimetype='text/event-stream')

@chat_bp.route('/api/reset', methods=['POST'])
def reset():
    """
    Reset chat history endpoint.
    """
    session_id = request.cookies.get('session_id', 'default')

    # Reset chat history
    chat_service.reset_chat_history(session_id)

    return jsonify({"success": True})
