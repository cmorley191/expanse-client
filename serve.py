import http.server
import mimetypes

mimetypes.add_type("text/javascript", ".mjs")
mimetypes.add_type("application/wasm", ".wasm")

class ServeRequestHandler(http.server.SimpleHTTPRequestHandler):
  def end_headers(self):
    self.send_header('Access-Control-Allow-Origin', '*')
    http.server.SimpleHTTPRequestHandler.end_headers(self)

server = http.server.ThreadingHTTPServer(
  ("", 8000),
  ServeRequestHandler,
)

print("Serving at http://localhost:8000")
try:
  server.serve_forever()
except KeyboardInterrupt:
  print("KeyboardInterrupt")

