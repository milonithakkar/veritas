# conftest.py
import sys
import os

# Add the project root to Python path so pytest can find all modules
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
