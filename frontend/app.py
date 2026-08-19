from flask import Flask, request, send_from_directory, jsonify, Response
import requests
import os

# Paths
HERE = os.path.dirname(os.path.abspath(__file__))
APP_DIR = os.path.join(HERE, 'app')          # holds index.html
STATIC_DIR = os.path.join(APP_DIR, 'static')

# Backend container hostname (docker-compose service name)
BACKEND_URL = os.environ.get('BACKEND_URL', 'http://localhost:5000')

app = Flask(__name__)

@app.route('/')
def index():
    return send_from_directory(APP_DIR, 'index.html')

@app.route('/css/<path:filename>')
def css(filename):
    return send_from_directory(os.path.join(STATIC_DIR, 'css'), filename)

@app.route('/js/<path:filename>')
def js(filename):
    return send_from_directory(os.path.join(STATIC_DIR, 'js'), filename)

@app.route('/api/<path:path>', methods=['GET', 'POST', 'PUT', 'DELETE'])
def proxy(path):
    """Reverse-proxy API calls to the backend container."""
    url = f"{BACKEND_URL}/api/{path}"
    params = request.args.to_dict()
    data = request.get_data() if request.method in ('POST', 'PUT', 'DELETE') else None
    resp = requests.request(
        request.method, url, params=params, data=data,
        headers={'Content-Type': request.content_type or 'application/json'}
    )
    # Forward file downloads / attachments and raw responses properly
    excluded_headers = ['content-encoding', 'content-length', 'transfer-encoding', 'connection']
    headers = [(name, value) for (name, value) in resp.raw.headers.items()
               if name.lower() not in excluded_headers]
    return Response(resp.content, resp.status_code, headers)

@app.route('/api/health')
def health():
    return jsonify({'status': 'ok-frontend'})

@app.route('/favicon.ico')
def favicon():
    return ('', 204)

if __name__ == '__main__':
    # serve frontend on host port 8080 via compose
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 80)), debug=True)
