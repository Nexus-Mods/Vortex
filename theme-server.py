#!/usr/bin/env python3
"""
Simple HTTP server for Vortex theme preview
Usage: python3 theme-server.py
"""

import http.server
import socketserver
import webbrowser
import os
import sys
from pathlib import Path

PORT = 8080
DIRECTORY = Path(__file__).parent

class ThemePreviewHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)
    
    def end_headers(self):
        # Add CORS headers for development
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        # Add cache control for CSS files
        if self.path.endswith('.css') or self.path.endswith('.scss'):
            self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        super().end_headers()

def main():
    print(f"🎨 Vortex macOS Tahoe Theme Preview Server")
    print(f"📁 Serving files from: {DIRECTORY}")
    print(f"🌐 Starting server on port {PORT}...")
    
    try:
        with socketserver.TCPServer(("", PORT), ThemePreviewHandler) as httpd:
            url = f"http://localhost:{PORT}/theme-preview.html"
            print(f"✅ Server started successfully!")
            print(f"🔗 Theme preview URL: {url}")
            print(f"📝 You can now:")
            print(f"   • Open {url} in your browser")
            print(f"   • Adjust theme positioning with live controls")
            print(f"   • Export CSS for real implementation")
            print(f"   • Press Ctrl+C to stop the server")
            print()
            
            # Try to open browser automatically
            try:
                webbrowser.open(url)
                print(f"🚀 Opening browser automatically...")
            except:
                print(f"⚠️  Could not open browser automatically. Please open {url} manually.")
            
            print()
            httpd.serve_forever()
            
    except KeyboardInterrupt:
        print(f"\n👋 Server stopped. Thank you for using the theme preview!")
    except OSError as e:
        if e.errno == 48:  # Address already in use
            print(f"❌ Port {PORT} is already in use. Try a different port or stop other servers.")
            sys.exit(1)
        else:
            print(f"❌ Error starting server: {e}")
            sys.exit(1)

if __name__ == "__main__":
    main()