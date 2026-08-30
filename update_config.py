import json
import os
import sys

CONFIG_FILE = "config.json"

def update_config():
    # Забираем токен из секретных переменных окружения GitHub
    token = os.getenv("PEERS_TOKEN")
    
    if not token:
        print("Ошибка: Токен не найден в секретах GitHub. Добавьте секрет PEERS_TOKEN.")
        sys.exit(1)

    # Все ваши рабочие каналы
    channels = {
        "tvc": {
            "id": 16,
            "offsets": {
                "tvc": 0,
                "tvc_plus2": 7200,
                "tvc_plus4": 10,
                "tvc_plus7": 36000,
            },
        },
        "ren_tv_hd": {
            "id": 16,
            "offsets": {
                "ren_tv_hd": 10,
            },
        },
        "rentv": {
            "id": 16,
            "offsets": {
                "rentv_plus2": 7200,
                "rentv_plus4": 10,
            },
        },
        "sts_hd": {
            "id": 16,
            "offsets": {
                "sts_hd": 10,
            },
        },
        "sts": {
            "id": 16,
            "offsets": {
                "sts_plus2": 7200,
                "sts_plus4": 10,
            },
        },
        "russian_roman": {
            "id": 16,
            "offsets": {
                "russian_roman": 10,
            },
        },
        "friday": {
            "id": 16,
            "offsets": {
                "friday": 10,
            },
        },
        "star_family_hd": {
            "id": 16,
            "offsets": {
                "star_family_hd": 10,
            },
        },
    }

    config = {}
    for base_channel, data in channels.items():
        for name, offset in data["offsets"].items():
            base_url = f"http://peers.tv{base_channel}/{data['id']}/playlist.m3u8"
            config[name] = f"{base_url}?token={token}&offset={offset}"

    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2, ensure_ascii=False)
    print("Файл config.json успешно сгенерирован с текущим токеном.")

if __name__ == "__main__":
    update_config()
