"""
GEE Authentication Script
Run this once to authenticate your Google Earth Engine account.
Usage:
    .venv\Scripts\python.exe scripts\gee_auth.py
"""
import os

# Load .env if available
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

import ee

GEE_PROJECT = os.environ.get("GEE_PROJECT_ID", "")

print("=" * 60)
print("Google Earth Engine Authentication")
print("=" * 60)
print()
print("Step 1: Authenticating with Google...")
print("        A browser window will open — sign in with your Google account.")
print("        Then authorize Earth Engine access.")
print()

try:
    ee.Authenticate()
    print()
    print("Step 2: Initializing with project:", GEE_PROJECT)
    ee.Initialize(project=GEE_PROJECT)
    result = ee.String("GEE Connected Successfully!").getInfo()
    print()
    print("=" * 60)
    print("SUCCESS:", result)
    print("Project:", GEE_PROJECT)
    print("GEE is now authenticated and ready!")
    print("=" * 60)
except Exception as e:
    print()
    print("ERROR:", str(e))
    print()
    print("Tips:")
    print("  - Make sure you have a Google Cloud project named:", GEE_PROJECT)
    print("  - Or update GEE_PROJECT_ID in your .env file")
    print("  - Earth Engine must be enabled for your project at:")
    print("    https://console.cloud.google.com/apis/library/earthengine.googleapis.com")
