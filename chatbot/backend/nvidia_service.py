"""
Service for interacting with the NVIDIA API.
"""
import requests
import base64
import json
import os
from io import BytesIO

class NvidiaService:
    """Service for interacting with the NVIDIA API."""

    def __init__(self, api_key, model_name="mistralai/mistral-medium-3-instruct"):
        """Initialize the NVIDIA service.

        Args:
            api_key (str): The NVIDIA API key.
            model_name (str): The model name to use.
        """
        self.api_key = api_key
        self.model_name = model_name
        self.invoke_url = "https://integrate.api.nvidia.com/v1/chat/completions"
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Accept": "application/json"
        }
        self.conversation_history = []

        # Add system prompt to conversation history
        self.system_prompt = r"""You are a helpful AI assistant. When responding with mathematical formulas or equations:
1. Always use proper LaTeX syntax
2. Enclose inline math expressions with single dollar signs ($...$)
3. Enclose block/display math expressions with double dollar signs ($$...$$)
4. Use proper LaTeX commands for mathematical symbols (e.g., \sin, \cos, \theta)
5. Use ^ for superscripts and _ for subscripts
6. Use \cdot for multiplication instead of *
7. Format fractions with \frac{numerator}{denominator}

Example of good LaTeX formatting:
- Inline: The formula $E = mc^2$ describes energy-mass equivalence.
- Display: The quadratic formula is:
$$x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}$$
"""
        self.conversation_history.append({
            "role": "system",
            "content": self.system_prompt
        })

    def generate_response(self, message, image_path=None):
        """
        Generate a response from the NVIDIA API.

        Args:
            message (str): The user's message.
            image_path (str, optional): Path to an image file to include.

        Returns:
            str: The generated response.
            bool: Whether the API call was successful.
        """
        try:
            # Add user message to conversation history
            content = message

            # If image is provided, encode it and add to the message
            if image_path and os.path.exists(image_path):
                with open(image_path, "rb") as f:
                    image_b64 = base64.b64encode(f.read()).decode()

                # Check image size
                if len(image_b64) >= 180_000:
                    return "Image is too large. Please use an image smaller than 180KB.", False

                content = f'{message} <img src="data:image/png;base64,{image_b64}" />'

            # Add user message to conversation history
            self.conversation_history.append({
                "role": "user",
                "content": content
            })

            # Prepare the payload
            payload = {
                "model": self.model_name,
                "messages": self.conversation_history,
                "max_tokens": 1024,
                "temperature": 0.7,
                "top_p": 0.95,
                "stream": False
            }

            # Send the request with a timeout
            response = requests.post(
                self.invoke_url,
                headers=self.headers,
                json=payload,
                timeout=10  # 10 second timeout
            )

            # Check if the request was successful
            if response.status_code == 200:
                response_data = response.json()
                assistant_message = response_data["choices"][0]["message"]["content"]

                # Add assistant message to conversation history
                self.conversation_history.append({
                    "role": "assistant",
                    "content": assistant_message
                })

                return assistant_message, True
            else:
                error_message = f"API error: {response.status_code} - {response.text}"
                print(error_message)
                return f"I'm sorry, I encountered an error: {error_message}", False

        except requests.exceptions.RequestException as e:
            error_message = f"Connection error with NVIDIA API: {str(e)}"
            print(error_message)
            return error_message, False
        except Exception as e:
            error_message = f"Error generating response: {str(e)}"
            print(error_message)
            return error_message, False

    def reset_chat(self):
        """Reset the chat history."""
        self.conversation_history = [{
            "role": "system",
            "content": self.system_prompt
        }]
        return "Chat history has been reset."
