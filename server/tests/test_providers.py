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


def test_inline_tts_preserves_speed_and_cache_key(tmp_path, monkeypatch):
    from app.routers import voice
    recording = tmp_path / "reference.wav"
    recording.write_bytes(b"test-audio")
    monkeypatch.setattr(voice, "_voice_id_file", lambda _: tmp_path / "missing-model")
    monkeypatch.setattr(voice, "_reference_samples", lambda _: [{"wav": recording, "text": "사과"}])
    monkeypatch.setattr(voice, "public_dir", lambda *_: tmp_path)
    monkeypatch.setattr(voice, "public_url", lambda path: path.name)
    speeds = []
    def synthesize(text, refs, out, speed):
        speeds.append(speed)
        out.write_bytes(b"test-mp3")
    monkeypatch.setattr(fish, "synthesize_inline", synthesize)
    slow = voice.tts(voice.TtsIn(child_id="child", text="사과", speed=0.8))
    fast = voice.tts(voice.TtsIn(child_id="child", text="사과", speed=1.0))
    assert slow.url != fast.url
    assert voice.tts(voice.TtsIn(child_id="child", text="사과", speed=0.8)).url == slow.url
    assert speeds == [0.8, 1.0]
