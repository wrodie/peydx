#!/usr/bin/env python3
"""Listener for remote update commands from the sync agent. Runs on host, not in container."""

import json
import subprocess
import sys
from http.server import HTTPServer, BaseHTTPRequestHandler

UPDATE_SCRIPT = "/opt/peydx/update.sh"
PORT = 5555


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path != "/update":
            self.send_error(404)
            return

        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length) if length else b"{}"
        try:
            data = json.loads(body)
        except json.JSONDecodeError:
            self.send_error(400, "Invalid JSON")
            return

        version = data.get("version")
        if not version:
            self.send_error(400, "Missing 'version' field")
            return

        subprocess.Popen(
            ["bash", UPDATE_SCRIPT, version],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps({"ok": True}).encode())

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def log_message(self, format, *args):
        print(f"[update-listener] {args[0]}", file=sys.stderr)


if __name__ == "__main__":
    server = HTTPServer(("0.0.0.0", PORT), Handler)
    print(f"[update-listener] Listening on 0.0.0.0:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
