import json
import time
import urllib.error
import urllib.request

BASE = "http://127.0.0.1:8002"


def req(method: str, path: str, data=None, token: str | None = None):
    body = None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if data is not None:
        body = json.dumps(data).encode("utf-8")

    request = urllib.request.Request(BASE + path, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            payload = response.read().decode("utf-8")
            return response.status, json.loads(payload) if payload else {}
    except urllib.error.HTTPError as exc:
        payload = exc.read().decode("utf-8")
        try:
            parsed = json.loads(payload)
        except Exception:
            parsed = {"raw": payload}
        return exc.code, parsed


def main() -> int:
    suffix = str(int(time.time()))
    writer_email = f"writer{suffix}@example.com"
    producer_email = f"producer{suffix}@example.com"

    writer_pw = "WriterPass123"
    producer_pw = "ProducerPass123"

    steps = []

    steps.append(("health",) + req("GET", "/health"))
    steps.append(
        (
            "register_writer",
        )
        + req(
            "POST",
            "/auth/register",
            {
                "name": "Writer User",
                "email": writer_email,
                "password": writer_pw,
                "role": "writer",
            },
        )
    )
    steps.append(
        (
            "register_producer",
        )
        + req(
            "POST",
            "/auth/register",
            {
                "name": "Producer User",
                "email": producer_email,
                "password": producer_pw,
                "role": "producer",
            },
        )
    )

    _, status, payload = steps[-2]
    writer_token = payload.get("access_token") if status in (200, 201) else None
    _, status, payload = steps[-1]
    producer_token = payload.get("access_token") if status in (200, 201) else None

    if not writer_token:
        status, payload = req("POST", "/auth/login", {"email": writer_email, "password": writer_pw})
        steps.append(("login_writer", status, payload))
        writer_token = payload.get("access_token")

    if not producer_token:
        status, payload = req("POST", "/auth/login", {"email": producer_email, "password": producer_pw})
        steps.append(("login_producer", status, payload))
        producer_token = payload.get("access_token")

    script_text = ("INT. WRITERS ROOM - DAY\n" * 20) + "A dramatic confrontation reveals a hidden motive and a final twist."
    steps.append(
        (
            "upload_script",
        )
        + req(
            "POST",
            "/upload_script",
            {
                "title": "The Last Window",
                "description": "A tense chamber drama about trust and betrayal.",
                "full_script_text": script_text,
                "language": "English",
            },
            token=writer_token,
        )
    )

    script_id = None
    _, status, payload = steps[-1]
    if status in (200, 201):
        script_id = payload.get("id")

    if script_id:
        steps.append(("interact_view",) + req("POST", "/interact", {"script_id": script_id, "type": "view"}, token=producer_token))
        steps.append(("interact_like",) + req("POST", "/interact", {"script_id": script_id, "type": "like"}, token=producer_token))

    steps.append(("trending",) + req("GET", "/trending?limit=5"))
    steps.append(("recommendations",) + req("GET", "/recommendations?limit=5", token=producer_token))
    steps.append(("search",) + req("GET", "/search?query=betrayal%20drama&limit=5"))
    steps.append(("match",) + req("GET", "/match/scripts_for_producer?limit=5", token=producer_token))

    failures = []
    for name, status, payload in steps:
        print(f"{name}: {status}")
        if isinstance(payload, dict) and "items" in payload:
            print(f"  items={len(payload['items'])}")
        elif isinstance(payload, dict) and "id" in payload:
            print(f"  id={payload['id']}")
        elif isinstance(payload, dict) and "access_token" in payload:
            print("  token=ok")
        elif isinstance(payload, dict) and "detail" in payload:
            print(f"  detail={payload['detail']}")

        if status >= 400:
            failures.append((name, status, payload))

    if failures:
        print("\nFAILURES:")
        for failure in failures:
            print(failure)
        return 1

    print("\nALL_SMOKE_TESTS_PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
