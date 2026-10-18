#!/usr/bin/env python3
"""Write only PUBLIC Supabase client configuration. Never accept a secret/service key."""
import base64
import json
import os
from pathlib import Path
from urllib.parse import urlsplit

url=os.environ.get('SUPABASE_URL','').strip().rstrip('/')
key=os.environ.get('SUPABASE_PUBLISHABLE_KEY','').strip()
if not url or not key:
    raise SystemExit('Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY to the project URL and public client key. Values are not printed.')
parsed=urlsplit(url)
if parsed.scheme!='https' or not parsed.netloc or parsed.username or parsed.password or parsed.path or parsed.query or parsed.fragment:
    raise SystemExit('SUPABASE_URL must be an HTTPS project origin without a path, query or credentials.')
public=key.startswith('sb_publishable_')
try:
    encoded=key.split('.')[1]
    payload=json.loads(base64.urlsafe_b64decode(encoded+'='*(-len(encoded)%4)))
    public=payload.get('role')=='anon'
except (ValueError,IndexError,UnicodeDecodeError):
    pass
if not public:
    raise SystemExit('Refusing a secret/service-role key. Only a publishable key or legacy anon key belongs in this public file.')
destination=Path(__file__).resolve().parents[1]/'auth-config.json'
destination.write_text(json.dumps({'provider':'supabase','url':url,'publishableKey':key},indent=2)+'\n')
print('Public auth-config.json updated. Key values were not printed. Apply the SQL migration and verify email/redirect settings before deployment.')
