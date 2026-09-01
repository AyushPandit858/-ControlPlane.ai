import urllib.request, json
models = ['grok-beta', 'grok-2-latest', 'grok-2', 'grok-1', 'grok-1.5', 'grok-4.6', 'grok-2-1212', 'grok-2-vision-1212']
key = 'your_xai_api_key_here'
url = 'https://api.x.ai/v1/chat/completions'
for m in models:
    payload = json.dumps({'model': m, 'messages': [{'role': 'user', 'content': 'hi'}]}).encode('utf-8')
    req = urllib.request.Request(url, data=payload, headers={'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'})
    try:
        resp = urllib.request.urlopen(req)
        print(f'{m}: SUCCESS')
        break
    except Exception as e:
        msg = e.read().decode('utf-8') if hasattr(e, 'read') else str(e)
        code = e.code if hasattr(e, 'code') else 'Error'
        print(f'{m}: {code} {msg}')
