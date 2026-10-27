#!/usr/bin/python3
"""Deterministic, offline CLI fixture. It never imports an actual backend."""
import json
import os
import sys
import time

args = sys.argv[1:]
command = args[0] if args else ''
if command == 'status':
    print(json.dumps(dict(receiving=False, visible=False, remaining=None,
                         name='Demo computer', dir='/tmp', mode='off', sound=False,
                         visibility='everyone', senders=0)))
elif command == 'peers':
    peers = [dict(mac='02:00:00:00:00:01', name='Demo iPhone', rssi=-48),
             dict(mac='02:00:00:00:00:02', name='Demo Mac', rssi=-71)]
    if '--stream' in args:
        for peer in peers:
            print(json.dumps(peer), flush=True)
            time.sleep(0.05)
    else:
        print(json.dumps(peers))
elif args[:2] == ['senders', 'list']:
    print('["demo@example.invalid"]')
elif command == 'test-echo':
    print(json.dumps(args[1:]))
elif command == 'test-fail':
    print('Expected fixture failure', file=sys.stderr)
    sys.exit(7)
elif command == 'test-delay':
    time.sleep(20)
elif command == 'send':
    print('Preparing demo files...', flush=True)
    time.sleep(float(os.environ.get('OMDROP_MOCK_SEND_DELAY', '2')))
    print('Sent demo files', flush=True)
elif command == 'limit':
    print('30')
elif command == 'doctor':
    print('Ready (offline fixture)')
else:
    print('OK')
