import json
import sys

def get_recent_user_messages():
    try:
        with open(r'C:\Users\T470\.gemini\antigravity\brain\0923bc33-7f34-4040-ab77-f39bbb4e2375\.system_generated\logs\transcript.jsonl', 'r', encoding='utf-8') as f:
            lines = f.readlines()
            
        user_msgs = []
        for i, line in enumerate(lines):
            try:
                data = json.loads(line)
                if data.get('type') == 'USER_INPUT' or data.get('source') == 'USER_EXPLICIT':
                    user_msgs.append((i, data.get('content')))
            except json.JSONDecodeError:
                pass
                
        for idx, content in user_msgs[-10:]:
            print(f"Line {idx}: {content}")
            print("-" * 40)
            
        print("\n\nLet's also look at the 5 lines preceding 'perbaiki bagian ini'")
        for i, line in enumerate(lines):
            if 'perbaiki bagian ini' in line and data.get('source') != 'MODEL':
                print("Found target at line", i)
                for j in range(max(0, i-5), min(len(lines), i+6)):
                    print(f"[{j}]: {lines[j][:200]}")
    except Exception as e:
        print(e)

get_recent_user_messages()
