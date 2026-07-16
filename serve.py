# Tiny static server for the interactive app. Reads PORT from the environment
# (set by the Claude Code preview harness); falls back to 4173 for manual runs:
#   py -3 serve.py
import functools
import http.server
import os

port = int(os.environ.get("PORT", "4173"))
here = os.path.dirname(os.path.abspath(__file__))
handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=here)
print(f"serving {here} on http://localhost:{port}")
http.server.ThreadingHTTPServer(("127.0.0.1", port), handler).serve_forever()
