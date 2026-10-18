import os
from auth_fixture import mock_provider
from playwright.sync_api import sync_playwright,expect
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1280,'height':1000});mock_provider(page)
 for width in [1280,390,320]:
  page.set_viewport_size({'width':width,'height':1000 if width==1280 else 844})
  for route in ['','welcome.html','login.html','confirm-email.html','signup.html']:
   page.goto(os.environ.get('JKSPEAK_TEST_URL','http://127.0.0.1:8084').rstrip('/')+'/'+route);page.wait_for_timeout(150)
   box=page.locator('main').bounding_box()
   assert box['width']==(420 if width==1280 else width),(route,box)
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),route
   if route=='login.html':
    assert page.locator('.flow-form').evaluate('(el)=>getComputedStyle(el).rowGap')=='20px'
    fields=page.locator('.field').all()
    assert round(fields[1].bounding_box()['y']-(fields[0].bounding_box()['y']+fields[0].bounding_box()['height']))==20
   if route in ['login.html','signup.html']:page.screenshot(path=f'/tmp/flow-{width}-{route}.png',full_page=True)
  page.locator('#email').fill('test@example.test');page.locator('#password').fill('test-password-example');page.locator('#confirmPassword').fill('test-password-example');page.locator('[data-next]').click()
  page.locator('#displayName').fill('Test learner');page.locator('#course').fill('Psychology')
  for i in range(6):
   page.locator('[data-next]').click()
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  expect(page.locator('#profile-review')).to_be_visible()
  page.screenshot(path=f'/tmp/flow-{width}-review.png',full_page=True)
 b.close()
print('PASS: 420px desktop / 390px and 320px mobile flow frames; all profile questions and review without horizontal overflow.')
