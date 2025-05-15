"""
Utility functions for formatting responses.
"""
import re
import json

def format_markdown(text):
    """
    Format markdown text for better display.

    Args:
        text (str): The markdown text to format.

    Returns:
        str: The formatted text.
    """
    # Replace code blocks with HTML
    text = re.sub(
        r'```(\w+)?\n(.*?)\n```',
        r'<pre><code class="language-\1">\2</code></pre>',
        text,
        flags=re.DOTALL
    )

    # Replace inline code with HTML
    text = re.sub(
        r'`([^`]+)`',
        r'<code>\1</code>',
        text
    )

    # Format LaTeX blocks (display math)
    text = re.sub(
        r'\$\$(.*?)\$\$',
        r'<div class="math-display katex-block">\1</div>',
        text,
        flags=re.DOTALL
    )

    # Format inline LaTeX
    text = re.sub(
        r'\$([^\$]+)\$',
        r'<span class="math-inline katex-inline">\1</span>',
        text
    )

    # Fix common LaTeX issues
    # Replace ** with ^ for exponents
    text = re.sub(
        r'(\w+)\*\*(\w+)',
        r'\1^\2',
        text
    )

    # Replace * with \cdot for multiplication
    text = re.sub(
        r'(\d+)\*(\d+)',
        r'\1\\cdot \2',
        text
    )

    return text

def prepare_response(response_text):
    """
    Prepare the response for sending to the client.

    Args:
        response_text (str): The response text from the Gemini API.

    Returns:
        dict: The formatted response.
    """
    formatted_text = format_markdown(response_text)

    return {
        "text": response_text,
        "formatted_text": formatted_text,
        "timestamp": None  # This would be set by the app.py
    }
