"""
Lambda handler for REST API
Uses the Lambda-optimized FastAPI app (no WebSocket)
"""
from mangum import Mangum
from main_lambda import app

# Create the Lambda handler
handler = Mangum(app, lifespan="off")
