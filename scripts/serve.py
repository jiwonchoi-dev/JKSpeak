#!/usr/bin/env python3
"""Serve only public app assets; never expose Git metadata or local test data."""
import argparse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
ASSETS = {'index.html', 'app.js', 'oral-coach.mjs', 'styles.css', 'bee.svg', 'jkspeak-mark.svg', 'logo.png.png',
          'scope.html', 'app.html', 'splash.html', 'welcome.html', 'login.html', 'signup.html', 'profile.html', 'recover.html', 'reset-password.html', 'account-privacy.html', 'confirm-email.html', 'auth.css', 'avatar.png', 'auth-pages.mjs', 'auth-client.mjs', 'auth-config.json', 'profile-fields.mjs', 'learning-profile.mjs', 'account-data.mjs', 'pdf.mjs', 'pdf.worker.mjs', 'PDFJS-LICENSE.txt'}


class PublicHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def send_head(self):
        path = urlsplit(self.path).path
        name = 'index.html' if path == '/' else path.removeprefix('/')
        if name.startswith('vendor/') and name[7:] in {'pdf.mjs', 'pdf.worker.mjs', 'PDFJS-LICENSE.txt'}:
            name = name[7:]
        if name not in ASSETS:
            self.send_error(404)
            return None
        self.path = '/' + name
        return super().send_head()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8080)
    parser.add_argument('--bind', default='127.0.0.1')
    args = parser.parse_args()
    ThreadingHTTPServer((args.bind, args.port), PublicHandler).serve_forever()
