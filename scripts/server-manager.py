#!/usr/bin/env python3
"""PeydX server manager — listens for deploy commands from the CMS."""

import json
import os
import subprocess
import sys
from http.server import HTTPServer, BaseHTTPRequestHandler

DEPLOY_SCRIPT = "/opt/peydx/scripts/deploy.sh"
PROJECT_DIR = "/opt/peydx"
TOKEN = os.environ.get("SERVER_MANAGER_TOKEN", "")
PORT = int(os.environ.get("SERVER_MANAGER_PORT", "5556"))
STATUS_FILE = "/tmp/peydx-deploy-status"


class Handler(BaseHTTPRequestHandler):
    def _auth(self):
        auth = self.headers.get("Authorization", "")
        if TOKEN and auth != f"Bearer {TOKEN}":
            self.send_error(401, "Unauthorized")
            return False
        return True

    def do_GET(self):
        if not self._auth():
            return

        if self.path == "/health":
            self._send_json({"ok": True})
        elif self.path == "/status":
            self._handle_status()
        elif self.path == "/deploy-status":
            self._handle_deploy_status()
        else:
            self.send_error(404)

    def do_POST(self):
        if not self._auth():
            return

        if self.path == "/deploy":
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
                ["bash", DEPLOY_SCRIPT, version],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                cwd=PROJECT_DIR,
            )

            self._send_json({"ok": True, "message": f"Deploying {version}"})
        else:
            self.send_error(404)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")
        self.end_headers()

    def _handle_status(self):
        # Current version from package.json (always accurate, no git dependency)
        try:
            with open(f"{PROJECT_DIR}/package.json") as f:
                current = json.load(f).get("version", "dev")
        except Exception:
            current = "dev"

        # Latest version from git tags (fetched from GitHub)
        latest = current
        error = None
        try:
            fetch = subprocess.run(
                ["git", "fetch", "--tags"],
                capture_output=True, text=True, cwd=PROJECT_DIR,
                timeout=10,
            )
            if fetch.returncode != 0:
                error = f"git fetch failed (exit {fetch.returncode}): {fetch.stderr.strip()}"
                print(f"[server-manager] {error}", file=sys.stderr)
            else:
                rev_result = subprocess.run(
                    ["git", "rev-list", "--tags", "--max-count=1"],
                    capture_output=True, text=True, cwd=PROJECT_DIR,
                )
                if rev_result.returncode == 0 and rev_result.stdout.strip():
                    latest_commit = rev_result.stdout.strip()
                    desc_result = subprocess.run(
                        ["git", "describe", "--tags", latest_commit],
                        capture_output=True, text=True, cwd=PROJECT_DIR,
                    )
                    latest = desc_result.stdout.strip() or current
                else:
                    error = "No tags found in repository"
        except Exception as e:
            error = str(e)
            print(f"[server-manager] Update check failed: {e}", file=sys.stderr)

        self._send_json({
            "currentVersion": current,
            "latestVersion": latest,
            "updateAvailable": current != latest,
            "error": error,
        })

    def _handle_deploy_status(self):
        step = None
        try:
            with open(STATUS_FILE) as f:
                step = f.read().strip()
        except Exception:
            pass
        self._send_json({"step": step})

    def _send_json(self, data):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def log_message(self, format, *args):
        print(f"[server-manager] {args[0]}", file=sys.stderr)


if __name__ == "__main__":
    server = HTTPServer(("0.0.0.0", PORT), Handler)
    print(f"[server-manager] Listening on 127.0.0.1:{PORT}", file=sys.stderr)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
