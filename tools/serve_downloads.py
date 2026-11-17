#!/usr/bin/env python3
"""Static download server for the Peach Blossom Isle deliverables.

Serves /home/user/downloads over HTTP/1.1 and forces ZIP archives to be
saved as attachments instead of rendered, so clicking a link inside the
in-app preview actually downloads the file.
"""
import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = "/home/user/downloads"
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5300


class Handler(SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def guess_type(self, path):
        if path.endswith(".zip"):
            return "application/zip"
        if path.endswith(".html"):
            return "text/html; charset=utf-8"
        if path.endswith(".json"):
            return "application/json; charset=utf-8"
        return super().guess_type(path)

    def send_head(self):
        raw = self.path.split("?", 1)[0]
        force_download = raw.startswith("/dl/")
        rel = raw[len("/dl/"):] if force_download else raw.lstrip("/")
        path = os.path.join(ROOT, rel) if rel else os.path.join(ROOT, "index.html")
        path = os.path.abspath(path)
        if not path.startswith(os.path.abspath(ROOT)) or not os.path.isfile(path):
            self.send_error(404, "Not Found")
            return None
        name = os.path.basename(path)
        is_zip = name.endswith(".zip")
        if is_zip or force_download:
            ctype = "application/zip" if is_zip else "application/octet-stream"
            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(os.path.getsize(path)))
            self.send_header(
                "Content-Disposition",
                'attachment; filename="%s"' % name,
            )
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            return open(path, "rb")
        return super().send_head()

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))


if __name__ == "__main__":
    os.chdir(ROOT)
    srv = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    srv.daemon_threads = True
    sys.stderr.write("serving %s on %d\n" % (ROOT, PORT))
    sys.stderr.flush()
    srv.serve_forever()
