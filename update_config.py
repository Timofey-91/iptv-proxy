import requests
import re
import json

USER_AGENT = "Dalvik/2.1.0 (Linux; U; Android 8.0.1;)"
REFERRER = "https://peers.tv/"

CONFIG_FILE = "config.json"


def get_token():
    """Получаем access_token с PeersTV"""

    url = "http://api-nsk.peers.tv/auth/2/token"

    payload = (
        "grant_type=inetra%3Aanonymous"
        "&client_id=29783051"
        "&client_secret=b4d4eb438d760da95f0acb5bc6b5c760"
    )

    headers = {
        "User-Agent": USER_AGENT,
        "Content-Type": "application/x-www-form-urlencoded"
    }

    response = requests.post(
        url,
        data=payload,
        headers=headers,
        timeout=15
    )

    print(f"Token API status: {response.status_code}")

    if response.status_code != 200:
        print("Ответ PeersTV:")
        print(response.text)
        raise RuntimeError("Не удалось получить токен PeersTV")

    match = re.search(r'"access_token":"([^"]+)"', response.text)

    if not match:
        print("Ответ PeersTV:")
        print(response.text)
        raise RuntimeError("В ответе PeersTV не найден access_token")

    token = match.group(1)

    print("Новый токен PeersTV успешно получен.")

    return token


def get_stream_url(channel, channel_id, token, offset):
    """Формируем оригинальную ссылку PeersTV"""

    base_url = (
        f"http://api-nsk.peers.tv/"
        f"timeshift/{channel}/{channel_id}/playlist.m3u8"
    )

    return f"{base_url}?token={token}&offset={offset}"


def update_config():

    token = get_token()

    # Все каналы
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

            url = get_stream_url(
                base_channel,
                data["id"],
                token,
                offset
            )

            config[name] = url

            print(f"{name} → offset={offset}")

    # Сохраняем config.json
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(
            config,
            f,
            indent=2,
            ensure_ascii=False
        )

    print()
    print(f"Config обновлён. Каналов: {len(config)}")


if __name__ == "__main__":
    update_config()
