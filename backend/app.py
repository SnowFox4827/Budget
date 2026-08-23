import os

from app import create_app

app = create_app()

if __name__ == '__main__':
    # Only enable the debug reloader when asked, so containers health-checks
    # don't race the watcher's restart and trip into an unhealthy state.
    reloader = os.environ.get('FLASK_DEBUG_RELOADER', '0') == '1'
    debug = os.environ.get('FLASK_DEBUG', '0') == '1'
    app.run(host='0.0.0.0', port=5000, debug=debug, use_reloader=reloader)
