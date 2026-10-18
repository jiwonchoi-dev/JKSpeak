"""Run against scripts/serve.py with Python Playwright and a Chromium installation."""
import json
import os
from playwright.sync_api import sync_playwright, expect
from auth_fixture import mock_provider, seed_account, USER_A

BASE = os.environ.get('JKSPEAK_TEST_URL', 'http://127.0.0.1:8081')


def text_pdf():
    content = b'BT /F1 12 Tf 20 200 Td (A PDF example for oral practice.) Tj ET'
    objects = [b'<</Type/Catalog/Pages 2 0 R>>', b'<</Type/Pages/Kids[3 0 R]/Count 1>>', b'<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 300]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>', b'<</Length '+str(len(content)).encode()+b'>>\nstream\n'+content+b'\nendstream', b'<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>']
    data = b'%PDF-1.4\n'
    offsets = []
    for index, obj in enumerate(objects, 1):
        offsets.append(len(data))
        data += str(index).encode() + b' 0 obj\n' + obj + b'\nendobj\n'
    start = len(data)
    data += b'xref\n0 6\n0000000000 65535 f \n' + b''.join(f'{offset:010d} 00000 n \n'.encode() for offset in offsets)
    return data + f'trailer<</Size 6/Root 1 0 R>>\nstartxref\n{start}\n%%EOF'.encode()


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'), args=['--no-sandbox'])
    page = browser.new_page()
    mock_provider(page)
    seed_account(page)
    page.set_default_timeout(8000)
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('dialog', lambda dialog: dialog.accept())
    page.goto(BASE + "/app.html")
    for route in ['/', '/app.js', '/oral-coach.mjs', '/pdf.mjs', '/pdf.worker.mjs', '/scope.html']:
        assert page.request.get(BASE + route).status == 200, route
    assert page.request.get(BASE + '/.git/HEAD').status == 404

    # A pre-upgrade session and draft survive new preferences and learning reviews.
    legacy = {'id':'legacy', 'course':'Legacy course', 'role':'student', 'questions':[{'question':'Old question', 'topic':'Old topic'}], 'answers':[{'text':'Keep this answer', 'reflection':'Keep this note', 'needsWork':False}], 'elapsed':42, 'ended':'2026-10-17T00:00:00Z', 'feedback':None}
    page.evaluate('(s)=>localStorage.setItem("bee-independent-v1",JSON.stringify(s))', {'draft':{'name':'Existing learner'}, 'history':[legacy]})
    page.reload()
    page.locator('[data-action=settings]').click()
    page.locator('[data-action=import-legacy]').click()
    page.locator('[data-action=demo]').click()
    page.locator('#confidence').select_option('2')
    page.locator('#format').select_option('viva')
    page.locator('button[type=submit]').click()
    page.locator('#files').set_input_files({'name':'notes.txt', 'mimeType':'text/plain', 'buffer':b'An example for this practice.'})
    expect(page.locator('#materials')).to_contain_text('notes.txt')
    page.locator('#files').set_input_files({'name':'practice.pdf', 'mimeType':'application/pdf', 'buffer':text_pdf()})
    expect(page.locator('#materials')).to_contain_text('practice.pdf')
    for _ in range(3):
        page.locator('button[type=submit]').click()
    expect(page.locator('.hint')).to_be_visible()
    page.locator('#answer').fill('My first answer gives an example from the course.')
    page.reload()
    page.locator('[data-action=resume]').click()
    expect(page.locator('#answer')).to_have_value('My first answer gives an example from the course.')
    expect(page.locator('[data-action=pause]')).to_have_text('Resume')
    page.locator('[data-action=pause]').click()
    page.locator('[data-action=next]').click()
    page.locator('#answer').fill('Chunking groups related items. For example, organise concepts together.')
    page.locator('[data-action=finish]').click()
    page.locator('#confidenceAfter').select_option('4')

    # Review evidence is checked rather than invented, and guides the next focus.
    page.locator('#skill-1').select_option('reasoning')
    page.locator('#verdict-1').select_option('practise')
    page.locator('#quote-1').fill('Not actually said')
    page.locator('[data-coach-form="1"] button[type=submit]').click()
    expect(page.locator('[data-coach-status="1"]')).to_contain_text('exact passage')
    page.locator('#quote-1').fill('Chunking groups related items.')
    page.locator('#reason-1').fill('Explain why this grouping helps.')
    page.locator('[data-coach-form="1"] button[type=submit]').click()
    expect(page.locator('[data-coach-status="1"]')).to_contain_text('Self-review saved')
    page.locator('[data-coach-form="0"] button[type=submit]').click()
    expect(page.locator('[data-coach-status="0"]')).to_contain_text('Self-review saved')
    page.get_by_text('Examiner marking · enter marks and feedback', exact=True).click()
    page.locator('#mark-0').fill('80')
    page.locator('#mark-1').fill('60')
    page.locator('#mark-form button').click()
    page.locator('[data-retry-one="1"]').click()
    page.locator('#answer').fill('A revised explanation with a reason and a limitation.')
    page.locator('[data-action=finish]').click()
    expect(page.locator('.comparison')).to_contain_text('Chunking groups related items.')
    assert 'My first answer' not in page.locator('.comparison').inner_text()
    page.locator('[data-transfer="0"]').click()
    page.locator('#answer').fill('A claim with a clear example.')
    page.locator('[data-action=follow-up]').click()
    expect(page.locator('.question-card .badge')).to_contain_text('OF 2')
    page.locator('[data-action=next]').click()
    expect(page.locator('.exam-question')).to_contain_text('You wrote: “A claim with a clear example.”')
    page.locator('#answer').fill('An example supports the claim but has limitations.')
    page.locator('[data-action=finish]').click()
    page.locator('[data-action=growth]').click()
    expect(page.locator('.today-card h2')).to_have_text('Critical reasoning')
    expect(page.locator('.skill-grid')).to_contain_text('1 uncertain')
    expect(page.locator('main')).to_contain_text('2 → 4')
    expect(page.locator('.weekly-plan')).to_contain_text('Try the same skill on a different question.')
    assert page.evaluate('JSON.parse(localStorage.getItem("jkspeak-practice-v2:11111111-1111-4111-8111-111111111111")).history.find(s=>s.id==="legacy").answers[0].text') == 'Keep this answer'

    # Appearance persists; export includes original data and excludes recordings.
    page.locator('[data-action=settings]').click()
    page.locator('#theme').select_option('dark')
    page.locator('#weeklyGoal').select_option('4')
    page.reload()
    expect(page.locator('html')).to_have_attribute('data-theme', 'dark')
    assert page.evaluate('JSON.parse(localStorage.getItem("jkspeak-practice-v2:11111111-1111-4111-8111-111111111111")).settings.weeklyGoal') == 4
    page.locator('[data-action=settings]').click()
    with page.expect_download() as download:
        page.locator('[data-action=export-all]').click()
    with open(download.value.path()) as f:
        backup = json.load(f)
    assert backup['history'][-1] == legacy
    page.get_by_role('button', name='Overview', exact=True).click()
    page.locator('[data-format-start=presentation]').click()
    page.locator('#practice').select_option('mock')
    for _ in range(3):
        page.locator('button[type=submit]').click()
    page.locator('[data-action=starter]').click()
    expect(page.locator('#manualQuestions')).to_have_value('Summarise the main takeaway of your presentation.\nWhat evidence should convince your audience?\nHow would you respond to a different interpretation?\nWhat should your audience do or explore next?')
    page.locator('button[type=submit]').click()
    assert page.locator('.hint').count() == 0
    assert page.get_by_text('My study notes', exact=True).count() == 0
    # Permission errors retain typed answers.
    page.locator('#answer').fill('Typed fallback survives microphone failure.')
    page.locator('[data-action=record]').click()
    expect(page.locator('#toast')).to_contain_text('Microphone permission')
    expect(page.locator('#answer')).to_have_value('Typed fallback survives microphone failure.')
    page.set_viewport_size({'width':390, 'height':844})
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.screenshot(path='/tmp/jkspeak-mobile-practice.png', full_page=True)
    page.locator('[data-action=settings]').click()
    page.evaluate('''async()=>{const db=await new Promise((ok,fail)=>{const r=indexedDB.open('jkspeak-audio-v2:11111111-1111-4111-8111-111111111111',1);r.onupgradeneeded=()=>r.result.createObjectStore('recordings');r.onsuccess=()=>ok(r.result);r.onerror=()=>fail(r.error)});await new Promise((ok,fail)=>{const t=db.transaction('recordings','readwrite');t.objectStore('recordings').put(new Blob(['test']),'test:0');t.oncomplete=ok;t.onerror=fail});db.close()}''')
    page.locator('[data-action=clear-all]').click()
    expect(page.locator('#toast')).to_contain_text('have been deleted')
    assert page.evaluate('localStorage.getItem("jkspeak-practice-v2:11111111-1111-4111-8111-111111111111")') is None
    assert page.evaluate('JSON.parse(localStorage.getItem("bee-independent-v1")).history[0].id') == 'legacy'
    assert page.evaluate('''async()=>{const db=await new Promise(ok=>{const r=indexedDB.open('jkspeak-audio-v2:11111111-1111-4111-8111-111111111111',1);r.onsuccess=()=>ok(r.result)});const count=await new Promise(ok=>{const r=db.transaction('recordings').objectStore('recordings').count();r.onsuccess=()=>ok(r.result)});db.close();return count}''') == 0
    assert not errors, errors
    browser.close()
    # Synthetic microphone checks the real MediaRecorder/IndexedDB path.
    audio_browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'), args=['--no-sandbox', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'])
    audio_page = audio_browser.new_page()
    mock_provider(audio_page)
    seed_account(audio_page)
    audio_page.on('dialog', lambda dialog: dialog.accept())
    audio_page.goto(BASE + "/app.html")
    audio_page.locator('[data-action=demo]').click()
    for _ in range(4):
        audio_page.locator('button[type=submit]').click()
    audio_page.locator('[data-action=record]').click()
    expect(audio_page.locator('[data-action=record]')).to_contain_text('Stop recording')
    audio_page.wait_for_timeout(350)
    audio_page.locator('[data-action=record]').click()
    expect(audio_page.locator('#recording audio')).to_be_visible()
    audio_page.locator('#recording audio').evaluate('async audio=>{await audio.play();audio.pause();}')
    assert audio_page.evaluate('''async()=>{const state=JSON.parse(localStorage.getItem('jkspeak-practice-v2:11111111-1111-4111-8111-111111111111'));const db=await new Promise(ok=>{const r=indexedDB.open('jkspeak-audio-v2:11111111-1111-4111-8111-111111111111',1);r.onsuccess=()=>ok(r.result)});const size=await new Promise(ok=>{const r=db.transaction('recordings').objectStore('recordings').get(state.active.id+':0');r.onsuccess=()=>ok(r.result.size)});db.close();return size}''') > 0
    audio_page.get_by_role('button', name='Delete recording', exact=True).click()
    expect(audio_page.locator('#recording audio')).to_have_count(0)
    audio_browser.close()
    print('PASS: legacy preservation; TXT/PDF uploads; guided/mock; interrupted session; evidence/uncertainty; exact retry comparison; skill transfer; authored follow-up; examiner marks; learning focus; weekly goal; confidence; dark theme; export; microphone fallback; synthetic recording/playback/deletion; mobile; complete deletion; no uncaught JavaScript errors.')
