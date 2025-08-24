import requests
import json
import os

# Каналы и их ID (примерные)
channels_to_update = {
    "tvc+2": "7200",
    "tvc+4": "10"
}

def get_stream_url(channel_id):
    url = f"https://peers.tv/api/v4/streaming/playlist?id={channel_id}"
    headers = {
        "User-Agent": "Dalvik/2.1.0 (Linux; U; Android 8.0.1;)",
        "Referer": "https://peers.tv/"
    }
    r = requests.get(url, headers=headers)
    r.raise_for_status()
    data = r.json()
    return data["result"]["playlist"]["hls"]

def main():
    config = {}
    for name, chan_id in channels_to_update.items():
        try:
            config[name] = get_stream_url(chan_id)
        except Exception as e:
            print(f"Ошибка для {name}: {e}")

    with open("config.json", "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2, ensure_ascii=False)

if __name__ == "__main__":
    main()
