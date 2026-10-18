"""End-to-end UI with intercepted Supabase responses; no real users or emails."""
import json
import os
from playwright.sync_api import sync_playwright, expect
from auth_fixture import mock_provider, USER_A, USER_B

BASE=os.environ.get('JKSPEAK_TEST_URL','http://127.0.0.1:8083').rstrip('/')
PASSWORD='Test-password-for-UI-only'

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
    # An unconfigured deployment never simulates account creation or submits credentials.
    empty=browser.new_page()
    empty.route('**/auth-config.json',lambda route:route.fulfill(json={'provider':'supabase','url':'','publishableKey':''}))
    empty.goto(BASE+'/signup.html')
    expect(empty.locator('#status')).to_contain_text('not connected')
    expect(empty.locator('[data-next]')).to_be_disabled()
    assert empty.locator('form').get_attribute('method') == 'post'
    empty.goto(BASE+'/welcome.html')
    empty.get_by_role('link',name='Next',exact=True).click()
    expect(empty).to_have_url(BASE+'/app.html')
    expect(empty.locator('h1')).to_contain_text('Your knowledge.')
    empty.close()

    page=browser.new_page()
    state=mock_provider(page)
    errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.goto(BASE+'/')
    expect(page.locator('h1')).to_have_text('JKSpeak')
    page.get_by_role('link',name='Get started').click()
    expect(page).to_have_url(BASE+'/welcome.html')
    page.get_by_role('link',name='Next',exact=True).click()
    expect(page).to_have_url(BASE+'/app.html')
    page.goto(BASE+'/signup.html')
    expect(page.locator('#email')).to_be_enabled()
    page.locator('#email').fill('learner@example.test')
    page.locator('#password').fill(PASSWORD)
    page.locator('#confirmPassword').fill('different-password')
    page.locator('[data-next]').first.click()
    assert page.locator('[data-step="0"]').is_visible()
    page.locator('#confirmPassword').fill(PASSWORD)
    page.locator('#confirmPassword').press('Enter')
    expect(page.locator('[data-step="1"]')).to_be_visible()
    page.locator('#displayName').fill('New learner')
    page.locator('#course').fill('Biology')
    page.locator('[data-next]').click()
    page.locator('[name=examFormat][value=viva]').check()
    page.locator('[data-next]').click()
    page.locator('[name=focus][value=reasoning]').check()
    page.locator('[data-next]').click()
    page.locator('#preferredMinutes').select_option('15')
    page.locator('#weeklyGoal').select_option('4')
    page.locator('[data-next]').click()
    page.locator('#goal').fill('Defend my evidence clearly')
    page.locator('[data-next]').click()
    page.locator('[data-next]').last.click()
    expect(page.locator('#profile-review')).to_contain_text('Off')
    page.locator('#privacyAck').check()
    page.get_by_role('button',name='Create my account',exact=True).click()
    expect(page).to_have_url(BASE+'/confirm-email.html')
    expect(page.locator('#pending-email')).to_have_text('learner@example.test')
    assert len(state['signup']) == 1
    assert state['signup_redirects'] == [BASE+'/login.html']
    sent=state['signup'][0]
    assert sent['data']['learning_profile']['course'] == 'Biology'
    assert sent['data']['learning_profile']['aiConsent'] is False
    assert 'password' not in sent['data']['learning_profile']
    assert page.evaluate('sessionStorage.getItem("jkspeak-auth-session-v1")') is None
    assert not page.evaluate('(password)=>Object.values(localStorage).concat(Object.values(sessionStorage)).join().includes(password)',PASSWORD)

    # Email confirmation callback validates the user and removes URL tokens.
    page.goto(BASE+'/login.html#access_token=access-a&refresh_token=refresh-test&expires_in=3600&type=signup')
    expect(page).to_have_url(BASE+'/app.html')
    expect(page.locator('main h1')).to_contain_text('Your knowledge.')
    assert '#' not in page.url
    page.locator('[data-action=new]').click()
    expect(page.locator('#course')).to_have_value('Biology')
    expect(page.locator('#format')).to_have_value('viva')
    expect(page.locator('#focus')).to_have_value('reasoning')
    page.locator('[data-action=settings]').click()
    page.get_by_role('link',name='Edit learning profile').click()
    page.locator('#course').fill('Neuroscience')
    for _ in range(5): page.locator('[data-next]').click()
    page.locator('#aiConsent').check()
    page.locator('[data-next]').click()
    page.get_by_role('button',name='Save and continue').click()
    expect(page).to_have_url(BASE+'/app.html')
    expect(page.locator('main h1')).to_contain_text('Your knowledge.')
    assert state['profile_writes'][-1]['learning_profile']['course'] == 'Neuroscience'
    assert state['profile_writes'][-1]['learning_profile']['aiConsent'] is True
    page.locator('[data-action=new]').click()
    expect(page.locator('#course')).to_have_value('Neuroscience')
    page.evaluate('const session=JSON.parse(sessionStorage.getItem("jkspeak-auth-session-v1"));session.expires_at=0;sessionStorage.setItem("jkspeak-auth-session-v1",JSON.stringify(session));')
    page.reload()
    expect(page.locator('main h1')).to_contain_text('Your knowledge.')
    page.locator('[data-action=sign-out]').click()
    expect(page).to_have_url(BASE+'/welcome.html')
    assert page.evaluate('sessionStorage.getItem("jkspeak-auth-session-v1")') is None
    page.goto(BASE+'/app.html')
    expect(page).to_have_url(BASE+'/login.html')

    # Existing account: wrong credentials do not reach the app, then normal login.
    page.locator('#email').fill('second@example.test')
    page.locator('#password').fill('wrong-password')
    page.get_by_role('button',name='Log in',exact=True).click()
    expect(page.locator('#status')).to_contain_text('not accepted')
    page.locator('#password').fill(PASSWORD)
    page.get_by_role('button',name='Log in',exact=True).click()
    expect(page).to_have_url(BASE+'/app.html')
    expect(page.locator('.account-menu')).to_contain_text('Second learner')
    page.locator('[data-action=settings]').click()
    expect(page.locator('main')).to_contain_text('Chemistry')
    assert page.evaluate('JSON.parse(localStorage.getItem("jkspeak-practice-v2:'+USER_B+'")).draft.course') == 'Chemistry'
    assert page.evaluate('JSON.parse(localStorage.getItem("jkspeak-practice-v2:'+USER_A+'")).draft.course') == 'Neuroscience'
    page.locator('[data-action=sign-out]').click()
    expect(page).to_have_url(BASE+'/welcome.html')

    page.goto(BASE+'/recover.html')
    page.locator('#email').fill('learner@example.test')
    page.get_by_role('button',name='Send recovery link').click()
    expect(page.locator('#status')).to_contain_text('If a recovery email')
    assert state['recovery_redirects'] == [BASE+'/reset-password.html']
    page.goto(BASE+'/reset-password.html#access_token=access-a&refresh_token=refresh-test&expires_in=3600&type=recovery')
    expect(page.locator('#password')).to_be_enabled()
    assert '#' not in page.url
    page.locator('#password').fill('Another-test-password-only')
    page.locator('#confirmPassword').fill('Another-test-password-only')
    page.get_by_role('button',name='Save new password').click()
    expect(page).to_have_url(BASE+'/login.html')
    assert state['passwords'][-1] == {'password':'Another-test-password-only'}

    # Phone layout and first-visit keyboard access on the integrated pages.
    page.set_viewport_size({'width':390,'height':844})
    for name in ['','welcome.html','login.html','signup.html','confirm-email.html','account-privacy.html']:
        page.goto(BASE+'/'+name)
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),name
    page.goto(BASE+'/signup.html')
    expect(page.locator('#email')).to_be_enabled()
    page.screenshot(path='/tmp/jkspeak-account-mobile.png',full_page=True)
    assert not errors,errors
    browser.close()
    print('PASS (mock provider): splash/welcome; guarded app; sequential signup and review; validation/consent; email confirmation; profile prefill/edit; login errors; account isolation; logout; password recovery/reset; 390px; no password in app storage or URL.')
