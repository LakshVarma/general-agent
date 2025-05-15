"""
Service for executing Python code and handling agentic tasks.
"""
import os
import sys
import uuid
import json
import traceback
import io
import contextlib
import matplotlib
matplotlib.use('Agg')  # Use non-interactive backend
import matplotlib.pyplot as plt
import pandas as pd
import numpy as np
from datetime import datetime
import base64
import tempfile
import shutil
import importlib
import subprocess
import re

# Define a safe directory for saving generated files
AGENT_OUTPUT_DIR = os.path.join(os.path.dirname(__file__), 'agent_output')
if not os.path.exists(AGENT_OUTPUT_DIR):
    os.makedirs(AGENT_OUTPUT_DIR)

class AgentService:
    """Service for executing Python code and handling agentic tasks."""
    
    def __init__(self):
        """Initialize the agent service."""
        self.session_id = str(uuid.uuid4())
        self.session_dir = os.path.join(AGENT_OUTPUT_DIR, self.session_id)
        if not os.path.exists(self.session_dir):
            os.makedirs(self.session_dir)
        
        # List of allowed modules for code execution
        self.allowed_modules = {
            'pandas', 'numpy', 'matplotlib', 'matplotlib.pyplot', 
            'seaborn', 'math', 'datetime', 'collections', 'json',
            'csv', 're', 'random', 'statistics', 'itertools'
        }
        
        # Track generated files
        self.generated_files = []
    
    def execute_code(self, code, file_paths=None):
        """
        Execute Python code in a safe environment.
        
        Args:
            code (str): The Python code to execute.
            file_paths (list, optional): List of file paths that the code can access.
            
        Returns:
            dict: Execution results including stdout, stderr, generated files, and plots.
        """
        # Check for potentially dangerous operations
        if self._contains_dangerous_code(code):
            return {
                'success': False,
                'error': 'Code contains potentially dangerous operations',
                'stdout': '',
                'stderr': 'Security error: Code contains potentially dangerous operations',
                'files': [],
                'plots': []
            }
        
        # Create a temporary directory for execution
        temp_dir = os.path.join(self.session_dir, f"exec_{uuid.uuid4().hex[:8]}")
        os.makedirs(temp_dir, exist_ok=True)
        
        # Copy any input files to the temp directory
        input_file_map = {}
        if file_paths:
            for file_path in file_paths:
                if os.path.exists(file_path):
                    filename = os.path.basename(file_path)
                    dest_path = os.path.join(temp_dir, filename)
                    shutil.copy2(file_path, dest_path)
                    input_file_map[filename] = dest_path
        
        # Capture stdout and stderr
        stdout_capture = io.StringIO()
        stderr_capture = io.StringIO()
        
        # Track generated plots
        plots = []
        
        # Track generated files
        generated_files = []
        
        # Prepare the execution environment
        exec_globals = {
            'pd': pd,
            'np': np,
            'plt': plt,
            'datetime': datetime,
            'os': os,
            'json': json,
            're': re,
            'base64': base64,
            'input_files': input_file_map,
            'output_dir': temp_dir
        }
        
        try:
            # Add code to save any matplotlib figures
            modified_code = code + """
# Save any open matplotlib figures
for i in plt.get_fignums():
    fig = plt.figure(i)
    fig_path = os.path.join(output_dir, f'plot_{i}.png')
    fig.savefig(fig_path)
    print(f"[AGENT] Saved plot to {fig_path}")
"""
            
            # Execute the code with captured output
            with contextlib.redirect_stdout(stdout_capture), contextlib.redirect_stderr(stderr_capture):
                exec(modified_code, exec_globals)
            
            # Check for generated files in the temp directory
            for filename in os.listdir(temp_dir):
                file_path = os.path.join(temp_dir, filename)
                if os.path.isfile(file_path):
                    # Check if it's a plot
                    if filename.startswith('plot_') and filename.endswith('.png'):
                        with open(file_path, 'rb') as f:
                            img_data = base64.b64encode(f.read()).decode('utf-8')
                            plots.append({
                                'filename': filename,
                                'path': file_path,
                                'data': img_data
                            })
                    # Otherwise it's a regular file
                    else:
                        file_info = {
                            'filename': filename,
                            'path': file_path
                        }
                        # If it's a CSV or Excel file, include a preview
                        if filename.endswith(('.csv', '.xlsx', '.xls')):
                            try:
                                if filename.endswith('.csv'):
                                    df = pd.read_csv(file_path)
                                else:
                                    df = pd.read_excel(file_path)
                                file_info['preview'] = df.head().to_html()
                            except Exception as e:
                                file_info['preview_error'] = str(e)
                        generated_files.append(file_info)
            
            # Add generated files to the tracking list
            self.generated_files.extend([f['path'] for f in generated_files])
            
            return {
                'success': True,
                'stdout': stdout_capture.getvalue(),
                'stderr': stderr_capture.getvalue(),
                'files': generated_files,
                'plots': plots
            }
            
        except Exception as e:
            error_traceback = traceback.format_exc()
            return {
                'success': False,
                'error': str(e),
                'stdout': stdout_capture.getvalue(),
                'stderr': stderr_capture.getvalue() + '\n' + error_traceback,
                'files': [],
                'plots': []
            }
    
    def _contains_dangerous_code(self, code):
        """
        Check if the code contains potentially dangerous operations.
        
        Args:
            code (str): The Python code to check.
            
        Returns:
            bool: True if the code contains dangerous operations, False otherwise.
        """
        # List of dangerous patterns
        dangerous_patterns = [
            r'import\s+os\s*;',
            r'from\s+os\s+import',
            r'import\s+sys\s*;',
            r'from\s+sys\s+import',
            r'import\s+subprocess',
            r'from\s+subprocess\s+import',
            r'__import__\s*\(',
            r'eval\s*\(',
            r'exec\s*\(',
            r'open\s*\(.+?["\']w["\']',
            r'open\s*\(.+?["\']a["\']',
            r'os\.(system|popen|spawn|exec)',
            r'subprocess\.(Popen|call|run)',
            r'importlib',
            r'shutil\.(copy|move|rmtree)',
            r'pathlib\.Path',
            r'__builtins__'
        ]
        
        # Check for imports of modules not in the allowed list
        import_pattern = r'^\s*(import|from)\s+([a-zA-Z0-9_\.]+)'
        for line in code.split('\n'):
            match = re.match(import_pattern, line)
            if match:
                module = match.group(2).split(' ')[0].split('.')[0]
                if module not in self.allowed_modules:
                    return True
        
        # Check for dangerous patterns
        for pattern in dangerous_patterns:
            if re.search(pattern, code):
                return True
        
        return False
    
    def cleanup(self):
        """Clean up generated files and directories."""
        for file_path in self.generated_files:
            if os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except Exception as e:
                    print(f"Error removing file {file_path}: {e}")
        
        if os.path.exists(self.session_dir):
            try:
                shutil.rmtree(self.session_dir)
            except Exception as e:
                print(f"Error removing directory {self.session_dir}: {e}")
