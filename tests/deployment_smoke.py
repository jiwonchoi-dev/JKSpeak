"""Check root hosting (Netlify) and project-path hosting (GitHub Pages) locally."""
import os
from pathlib import Path
import runpy
from http.server import ThreadingHTTPServer
from threading import Thread
from playwright.sync_api import sync_playwright, expect
from auth_fixture import mock_provider, seed_account

PublicHandler = runpy.run_path(str(Path(__file__).resolve().parents[1] / 'scripts/serve.py'))['PublicHandler']


def handler_for(prefix):
    class MountedHandler(PublicHandler):
        def send_head(self):
            if prefix:
                if not self.path.startswith(prefix + '/'):
                    self.send_error(404)
                    return None
                self.path = self.path[len(prefix):]
            return super().send_head()

        def log_message(self, *args):
            pass
    return MountedHandler


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'), args=['--no-sandbox'])
    for prefix in ['', '/JKSpeak']:
        server = ThreadingHTTPServer(('127.0.0.1', 0), handler_for(prefix))
        Thread(target=server.serve_forever, daemon=True).start()
        origin = f'http://127.0.0.1:{server.server_port}'
        base = origin + prefix + '/'
        page = browser.new_page()
        mock_provider(page)
        seed_account(page)
        errors, failures = [], []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('response', lambda r: failures.append(r.url) if r.status >= 400 else None)
        page.goto(base)
        expect(page.locator('main h1')).to_contain_text('Your knowledge.')
        page.wait_for_function('document.querySelector(".brand img").naturalWidth > 0')
        assert page.locator('link[rel=stylesheet]').evaluate('(e)=>e.href') == base + 'styles.css'
        skip = page.locator('.skip')
        assert skip.bounding_box()['y'] + skip.bounding_box()['height'] <= 0
        page.keyboard.press('Tab')
        expect(skip).to_be_focused()
        assert skip.bounding_box()['y'] >= 0
        page.keyboard.press('Enter')
        expect(page.locator('#main')).to_be_focused()
        page.goto(base + '#main')
        expect(page.locator('main h1')).to_contain_text('Your knowledge.')
        page.locator('footer a').click()
        expect(page).to_have_url(base + 'scope.html')
        expect(page.locator('main h1')).to_contain_text('Practice you can')
        assert page.locator('link[rel=stylesheet]').evaluate('(e)=>Boolean(e.sheet)')
        page.get_by_role('link', name='Back to practice').click()
        expect(page.locator('main h1')).to_contain_text('Your knowledge.')
        version = page.evaluate('''async()=>{const p=await import('./pdf.mjs');p.GlobalWorkerOptions.workerSrc=new URL('./pdf.worker.mjs',location.href).href;const worker=new p.PDFWorker();await worker.promise;worker.destroy();return p.version}''')
        assert version
        assert not failures, failures
        assert not errors, errors
        print(f'PASS {prefix or "/"}: app, #main, CSS, images, scope and back link, skip-link focus, PDF module/worker; no HTTP or JS errors')
        page.close()
        server.shutdown()
        server.server_close()
    browser.close()
