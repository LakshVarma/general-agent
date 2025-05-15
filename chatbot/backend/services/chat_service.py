"""
Chat service for the chatbot API.
"""
import json
import logging
import os
import re
import traceback
import asyncio
from typing import Dict, List, Any, Optional, Generator, Tuple, AsyncGenerator

from .gemini_service import GeminiService
from .nvidia_service import NvidiaService
from .mcp_service import MCPService
from .mcp.client import run_async

# Configure logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class ChatService:
    """Service for handling chat interactions."""

    def __init__(self, gemini_service: GeminiService, nvidia_service: NvidiaService, mcp_service: MCPService):
        """
        Initialize the chat service.

        Args:
            gemini_service: The Gemini service to use.
            nvidia_service: The NVIDIA service to use.
            mcp_service: The MCP service to use.
        """
        self.gemini_service = gemini_service
        self.nvidia_service = nvidia_service
        self.mcp_service = mcp_service
        self.chat_history_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'chat_history')

        # Create chat history directory if it doesn't exist
        os.makedirs(self.chat_history_dir, exist_ok=True)

    def get_chat_history(self, session_id: str) -> List[Dict[str, str]]:
        """
        Get the chat history for a session.

        Args:
            session_id: The session ID.

        Returns:
            A list of chat messages.
        """
        history_file = os.path.join(self.chat_history_dir, f"{session_id}.json")

        if os.path.exists(history_file):
            try:
                with open(history_file, 'r') as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"Error loading chat history: {e}")
                return []
        else:
            return []

    def save_chat_history(self, session_id: str, history: List[Dict[str, str]]):
        """
        Save the chat history for a session.

        Args:
            session_id: The session ID.
            history: The chat history to save.
        """
        history_file = os.path.join(self.chat_history_dir, f"{session_id}.json")

        try:
            with open(history_file, 'w') as f:
                json.dump(history, f)
        except Exception as e:
            logger.error(f"Error saving chat history: {e}")

    def reset_chat_history(self, session_id: str):
        """
        Reset the chat history for a session.

        Args:
            session_id: The session ID.
        """
        history_file = os.path.join(self.chat_history_dir, f"{session_id}.json")

        if os.path.exists(history_file):
            try:
                os.remove(history_file)
            except Exception as e:
                logger.error(f"Error resetting chat history: {e}")

    async def get_chat_response(self, message: str, session_id: str, model: str = "gemini-2.5-flash") -> Tuple[str, str]:
        """
        Get a response from the chatbot.

        Args:
            message: The user's message.
            session_id: The session ID.
            model: The model to use (gemini-2.5-pro, gemini-2.5-flash, nvidia, etc.).

        Returns:
            A tuple containing the response text and the model used.
        """
        # Get chat history
        history = self.get_chat_history(session_id)

        # Add user message to history
        history.append({"role": "user", "content": message})

        # Try to get a response from the specified model
        try:
            if model.lower() == "nvidia":
                response = await self.nvidia_service.generate_response(message, history)
                actual_model_used = "nvidia"
            else:
                # Use Gemini service with the specified model
                response, actual_model_used = await self.gemini_service.generate_response(message, history, model)
        except Exception as e:
            logger.error(f"Error getting response from {model}: {e}")
            logger.error(traceback.format_exc())

            # Fall back to another model
            try:
                if "gemini" in model.lower():
                    # Fall back to NVIDIA if Gemini fails
                    response = await self.nvidia_service.generate_response(message, history)
                    actual_model_used = "nvidia"
                else:
                    # Fall back to Gemini if NVIDIA fails
                    response, actual_model_used = await self.gemini_service.generate_response(
                        message, history, "gemini-2.5-flash"
                    )
            except Exception as e2:
                logger.error(f"Error getting response from fallback model: {e2}")
                logger.error(traceback.format_exc())
                response = "I'm sorry, I encountered an error and couldn't generate a response. Please try again later."
                actual_model_used = "none"

        # Add assistant response to history
        history.append({"role": "assistant", "content": response})

        # Save updated history
        self.save_chat_history(session_id, history)

        return response, actual_model_used

    async def stream_chat_response(self, message: str, session_id: str, model: str = "gemini-2.5-flash") -> AsyncGenerator[Dict[str, Any], None]:
        """
        Stream a response from the chatbot.

        Args:
            message: The user's message.
            session_id: The session ID.
            model: The model to use (gemini-2.5-pro, gemini-2.5-flash, nvidia, etc.).

        Yields:
            Dictionaries containing response chunks and metadata.
        """
        # Get chat history
        history = self.get_chat_history(session_id)

        # Add user message to history
        history.append({"role": "user", "content": message})

        # Check if this is an MCP-related request
        service, action, params = self._detect_mcp_action(message)

        if service and action:
            # This is an MCP action
            await asyncio.sleep(0)  # Ensure this is truly asynchronous
            yield {
                "type": "status",
                "text": f"Detected request to use {service} {action}..."
            }

            # If we have parameters, call the tool directly
            if params:
                await asyncio.sleep(0)  # Ensure this is truly asynchronous
                yield {
                    "type": "status",
                    "text": f"Connecting to {service} {action} tool..."
                }

                # Call the MCP tool
                tool_name = f"{service}_{action}"
                try:
                    result = await self.mcp_service.call_tool(tool_name, params)

                    # Yield the result
                    await asyncio.sleep(0)  # Ensure this is truly asynchronous
                    yield {
                        "type": "mcp_result",
                        "service": service,
                        "action": action,
                        "result": result
                    }

                    # Add the result to the chat history
                    result_text = f"I used the {service} {action} tool for you. Here's the result: {result}"
                    history.append({"role": "assistant", "content": result_text})
                    self.save_chat_history(session_id, history)

                    # Yield the result as content
                    await asyncio.sleep(0)  # Ensure this is truly asynchronous
                    yield {
                        "type": "content",
                        "text": result_text,
                        "model_used": "mcp"
                    }
                    return
                except Exception as e:
                    logger.error(f"Error calling MCP tool: {e}")
                    logger.error(traceback.format_exc())
                    await asyncio.sleep(0)  # Ensure this is truly asynchronous
                    yield {
                        "type": "error",
                        "text": f"Error calling {tool_name}: {str(e)}"
                    }
            else:
                # If we don't have parameters, get them from the AI
                await asyncio.sleep(0)  # Ensure this is truly asynchronous
                yield {
                    "type": "status",
                    "text": f"Getting more information for {service} {action}..."
                }

        # Get the response from the AI model
        try:
            # Add a hint about MCP tools to the message if it's related to MCP
            if self._is_mcp_related(message):
                enhanced_message = f"{message}\n\nRemember to use your MCP tools to help with this request."

                # Use the streaming API directly for Gemini models
                if model.lower() != "nvidia":
                    # Stream directly from Gemini
                    async for chunk in self.gemini_service.stream_response(enhanced_message, history, model):
                        await asyncio.sleep(0)  # Ensure this is truly asynchronous
                        yield chunk

                    # Save the last complete response to history
                    # This will be handled by the frontend
                    return
                else:
                    # For NVIDIA, we don't have streaming yet, so use the regular API
                    response_text, actual_model_used = await self.get_chat_response(enhanced_message, session_id, model)
            else:
                # Use the streaming API directly for Gemini models
                if model.lower() != "nvidia":
                    # Stream directly from Gemini
                    async for chunk in self.gemini_service.stream_response(message, history, model):
                        await asyncio.sleep(0)  # Ensure this is truly asynchronous
                        yield chunk

                    # Save the last complete response to history
                    # This will be handled by the frontend
                    return
                else:
                    # For NVIDIA, we don't have streaming yet, so use the regular API
                    response_text, actual_model_used = await self.get_chat_response(message, session_id, model)

            # For NVIDIA or if we reached here, yield the full response
            await asyncio.sleep(0)  # Ensure this is truly asynchronous
            yield {
                "type": "content",
                "text": response_text,
                "model_used": actual_model_used
            }

            # Add the response to the chat history
            history.append({"role": "assistant", "content": response_text})
            self.save_chat_history(session_id, history)
        except Exception as e:
            logger.error(f"Error generating response: {e}")
            logger.error(traceback.format_exc())
            await asyncio.sleep(0)  # Ensure this is truly asynchronous
            yield {
                "type": "error",
                "text": f"Error generating response: {str(e)}"
            }

        # Detect MCP actions from the message
        service, action, params = self._detect_mcp_action(message)

        # If we detected an MCP action, handle it
        if service and action:
            if params:
                # If we have parameters, call the tool directly
                yield {
                    "type": "status",
                    "text": f"Connecting to {service} {action} tool..."
                }

                # Call the MCP tool
                tool_name = f"{service}_{action}"
                try:
                    result = run_async(self.mcp_service.call_tool(tool_name, params))

                    # Yield the result
                    yield {
                        "type": "mcp_result",
                        "service": service,
                        "action": action,
                        "result": result
                    }
                except Exception as e:
                    logger.error(f"Error calling MCP tool: {e}")
                    yield {
                        "type": "error",
                        "text": f"Error calling {tool_name}: {str(e)}"
                    }
            else:
                # If we don't have parameters, trigger the appropriate UI action
                yield {
                    "type": "status",
                    "text": f"Connecting to {service} {action} tool..."
                }

                yield {
                    "type": "mcp_action",
                    "service": service,
                    "action": action
                }

    def _is_mcp_related(self, message: str) -> bool:
        """
        Check if a message is related to MCP tools.

        Args:
            message: The message to check.

        Returns:
            True if the message is related to MCP tools, False otherwise.
        """
        mcp_keywords = [
            "email", "gmail", "send", "compose", "write email",
            "meeting", "calendar", "schedule", "appointment",
            "file", "document", "drive", "upload",
            "contact", "phone", "address",
            "youtube", "video", "upload video",
            "linkedin", "post", "share",
            "pdf", "convert", "scan"
        ]

        return any(keyword in message.lower() for keyword in mcp_keywords)

    def _detect_mcp_action(self, message: str) -> Tuple[Optional[str], Optional[str], Optional[Dict[str, Any]]]:
        """
        Detect MCP actions from a message.

        Args:
            message: The message to analyze.

        Returns:
            A tuple containing the service name, action, and parameters (if any).
        """
        # Gmail/Email actions
        if "gmail" in message.lower() or "email" in message.lower():
            if "search" in message.lower() and ("emails" in message.lower() or "email" in message.lower()):
                # Extract search query from the message
                search_terms = re.findall(r'search for emails? (?:with|containing|about|from) ["\'"]?([^"\']+)["\'"]?', message.lower())
                if search_terms:
                    return "gmail", "find_email", {"query": search_terms[0]}
                return "gmail", "find_email", None

            elif ("send" in message.lower() or "compose" in message.lower() or "write" in message.lower()) and "email" in message.lower():
                # Try to extract email parameters from the message
                to_match = re.search(r'to\s+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})', message)
                subject_match = re.search(r'subject\s+["\']?([^"\']+)["\']?', message, re.IGNORECASE)
                body_match = re.search(r'body\s+["\']?([^"\']+)["\']?', message, re.IGNORECASE)

                # If we have enough information, return the parameters
                if to_match:
                    to_email = to_match.group(1)
                    subject = subject_match.group(1) if subject_match else "Email from Chatbot"
                    body = body_match.group(1) if body_match else "This is an email sent from the chatbot."

                    return "gmail", "send_email", {
                        "to": to_email,
                        "subject": subject,
                        "body": body
                    }

                return "gmail", "compose_email", None

        # Zoom actions
        elif "zoom" in message.lower() or "meeting" in message.lower():
            if "create" in message.lower() or "schedule" in message.lower() or "set up" in message.lower():
                return "zoom", "create_meeting", None

        # Google Drive actions
        elif "google drive" in message.lower() or "drive" in message.lower() or "file" in message.lower():
            if "find" in message.lower() or "search" in message.lower():
                # Extract file name from the message
                file_terms = re.findall(r'find (?:a |the )?file (?:called |named |titled |with name |with title )["\'"]?([^"\']+)["\'"]?', message.lower())
                if file_terms:
                    return "google_drive", "find_a_file", {"title": file_terms[0]}
                return "google_drive", "find_a_file", None

        return None, None, None
