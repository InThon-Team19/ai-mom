"""외부 결제 없이 HTTP multipart/실패 계약을 검증한다."""
import httpx

from app.tts import fish


def test_fish_registration_encodes_multipart(tmp_path, monkeypatch):
    recording = tmp_path / "parent.wav"
    recording.write_bytes(b"RIFF-demo")
    seen = []
    def capture(request):
        seen.append(request)
        return httpx.Response(200, json={"_id": "voice-test", "state": "created"})
    client = httpx.Client(transport=httpx.MockTransport(capture))
    monkeypatch.setenv("FISH_API_KEY", "fake-test-key")
    monkeypatch.setattr(fish.httpx, "post", client.post)
    result = fish.register_voice("test", [recording], ["사과", "바나나"])
    assert result["_id"] == "voice-test"
    assert b'name="voices"' in seen[0].content
    assert seen[0].content.count(b'name="texts"') == 2
    assert seen[0].headers["authorization"] == "Bearer fake-test-key"
    client.close()
