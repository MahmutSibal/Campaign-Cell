import os
from http.server import BaseHTTPRequestHandler, HTTPServer
import json

class HealthHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path in ['/', '/health']:
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            service_name = os.environ.get('SERVICE_NAME', 'Python Service')
            self.wfile.write(json.dumps({'status': 'healthy', 'service': service_name}).encode())
        else:
            self.send_response(404)
            self.end_headers()

def run():
    port = int(os.environ.get('PORT', 8000))
    server_address = ('', port)
    httpd = HTTPServer(server_address, HealthHandler)
    print(f"Service running on port {port}")
    httpd.serve_forever()

if __name__ == '__main__':
    run()
