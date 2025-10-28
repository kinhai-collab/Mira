import os
from elevenlabs import ElevenLabs

client = ElevenLabs(api_key=os.getenv("ELEVENLABS_API_KEY"))
voice_id = os.getenv("ELEVENLABS_VOICE_ID")

try:
    # Request TTS with Zara's voice
    response = client.text_to_speech.convert(
        voice_id=voice_id,
        model_id="eleven_turbo_v2",
        text="Hey Anusha, this is Mira speaking! I hope you are having a wonderful day.",
        output_format="mp3_44100_128"
    )

    # Convert the stream into a file properly
    audio_bytes = b"".join(list(response))

    output_path = "voice_test.mp3"
    with open(output_path, "wb") as f:
        f.write(audio_bytes)

except Exception as e:
    pass
