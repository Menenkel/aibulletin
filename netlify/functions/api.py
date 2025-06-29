import sys
from pathlib import Path

# Add the backend directory to the Python path
sys.path.append(str(Path(__file__).resolve().parent.parent.parent / 'backend'))

from mangum import Mangum
from main import app

handler = Mangum(app)
