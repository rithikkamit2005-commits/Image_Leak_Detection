import sys
import os

# Add the backend directory to the path so we can import app
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', 'backend'))

from serverless_wsgi import handle_wsgi
from app import app

def handler(event, context):
    return handle_wsgi(app, event, context)