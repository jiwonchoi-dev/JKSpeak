"""Intercepted provider responses for browser tests; not a real authentication service."""
import json
from urllib.parse import urlsplit, parse_qs

USER_A = '11111111-1111-4111-8111-111111111111'
USER_B = '22222222-2222-4222-8222-222222222222'
PROFILE = {'version':1, 'displayName':'Test learner', 'course':'Psychology', 'examFormat':'oral', 'englishLevel':'B2', 'focus':'evidence', 'preferredMinutes':10, 'weeklyGoal':3, 'answerPreference':'both', 'examDate':'', 'goal':'Explain my reasoning', 'challenges':['followups'], 'timezone':'UTC', 'aiConsent':False}


def mock_provider(page, immediate_signup=False):
    state = {'profiles':{USER_A:dict(PROFILE), USER_B:{**PROFILE, 'displayName':'Second learner', 'course':'Chemistry'}}, 'signup':[], 'passwords':[], 'profile_writes':[], 'signup_redirects':[], 'recovery_redirects':[], 'verify':[], 'resend':[]}
    page.route('**/auth-config.json', lambda route: route.fulfill(json={'provider':'supabase','url':'https://jkspeak-test.supabase.co','publishableKey':'sb_publishable_browser_test_only'}))

    def respond(route):
        request = route.request
        path = urlsplit(request.url).path
        token = request.headers.get('authorization', '').removeprefix('Bearer ')
        user_id = USER_B if token == 'access-b' else USER_A
        body = request.post_data_json if request.post_data else {}
        if path == '/auth/v1/token':
            if body.get('password') == 'wrong-password':
                route.fulfill(status=400, json={'error':'invalid_grant'})
                return
            user_id = USER_B if body.get('email') == 'second@example.test' else USER_A
            token = 'access-b' if user_id == USER_B else 'access-a'
            route.fulfill(json={'access_token':token,'refresh_token':'refresh-test','expires_in':3600,'user':{'id':user_id,'email':body.get('email','learner@example.test')}})
        elif path == '/auth/v1/user':
            if token not in ['access-a','access-b']:
                route.fulfill(status=401, json={'error':'bad token'})
            else:
                if request.method == 'PUT': state['passwords'].append(body)
                route.fulfill(json={'id':user_id,'email':'learner@example.test'})
        elif path == '/auth/v1/signup':
            state['signup'].append(body)
            state['signup_redirects'].append(parse_qs(urlsplit(request.url).query)['redirect_to'][0])
            state['profiles'][USER_A] = body['data']['learning_profile']
            if immediate_signup:
                route.fulfill(json={'access_token':'access-a','refresh_token':'refresh-test','expires_in':3600,'user':{'id':USER_A,'email':body['email']}})
            else:
                route.fulfill(json={'id':USER_A,'email':body['email']})
        elif path == '/rest/v1/learning_profiles':
            if request.method == 'POST':
                assert body['id'] == user_id
                state['profiles'][user_id] = body['learning_profile']
                state['profile_writes'].append(body)
                route.fulfill(status=201, body='')
            else:
                requested = parse_qs(urlsplit(request.url).query).get('id',[''])[0]
                route.fulfill(json=[{'learning_profile':state['profiles'][user_id]}] if requested == 'eq.'+user_id and user_id in state['profiles'] else [])
        elif path == '/auth/v1/verify':
            state['verify'].append(body)
            if body.get('token_hash') != 'valid-test-hash':
                route.fulfill(status=403,json={'error_code':'otp_expired','msg':'Expired test token'})
            else:
                route.fulfill(json={'access_token':'access-a','refresh_token':'refresh-test','expires_in':3600,'user':{'id':USER_A,'email':'learner@example.test'}})
        elif path == '/auth/v1/resend':
            state['resend'].append(body)
            route.fulfill(json={})
        elif path in ['/auth/v1/logout','/auth/v1/recover']:
            if path == '/auth/v1/recover': state['recovery_redirects'].append(parse_qs(urlsplit(request.url).query)['redirect_to'][0])
            route.fulfill(json={})
        else:
            route.fulfill(status=404, json={'error':'unexpected test endpoint'})
    page.route('https://jkspeak-test.supabase.co/**', respond)
    return state


def seed_account(page, user_id=USER_A):
    data={'access_token':'access-b' if user_id==USER_B else 'access-a','refresh_token':'refresh-test','user':{'id':user_id,'email':'learner@example.test'}}
    page.add_init_script('sessionStorage.setItem("jkspeak-auth-session-v1",JSON.stringify({...'+json.dumps(data)+',expires_at:Date.now()+3600000}));')
