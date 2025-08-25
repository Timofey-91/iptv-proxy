import requests
import re
import json
import os

USER_AGENT = "Dalvik/2.1.0 (Linux; U; Android 8.0.1;)"
REFERRER = "https://peers.tv/"

CONFIG_FILE = "config.json"

def get_token():
    """Получаем access_token с PeersTV"""
    url = "http://api.peers.tv/auth/2/token"
    payload = "grant_type=inetra%3Aanonymous&client_id=29783051&client_secret=b4d4eb438d760da95f0acb5bc6b5c760"
    headers = {"User-Agent": USER_AGENT, "Content-Type": "application/x-www-form-urlencoded"}
    response = requests.post(url, data=payload, headers=headers, timeout=8)
    if response.status_code != 200:
        return None
    return re.search(r'"access_token":"([^"]+)"', response.text).group(1)

def get_stream_url(channel, channel_id, token, offset):
    """Получаем оригинальный плейлист PeersTV"""
    base_url = f"http://api.peers.tv/timeshift/{channel}/{channel_id}/playlist.m3u8"
    return f"{base_url}?token={token}&offset={offset}"

def update_config():
    token = get_token()
    if not token:
        print("Ошибка: не удалось получить токен.")
        return

    channel = {
        "tvc", "rentv"
    }
    channel_id = 16  # базовый ID

    offsets = {
        "rentv": 7200,
        "tvc_plus2": 7200,
        "tvc_plus4": 10,
        "tvc_plus7": 36000,
    }

    config = {}
    for name, offset in offsets.items():
        url = get_stream_url(channel, channel_id, token, offset)
        config[name] = url
        print(f"{name} → {url}")

    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2, ensure_ascii=False)

if __name__ == "__main__":
    update_config()
