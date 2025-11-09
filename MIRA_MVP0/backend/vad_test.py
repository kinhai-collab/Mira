import shutil
import os
import wave
import math
import struct

print('CWD:', os.getcwd())
print('ffmpeg on PATH:', shutil.which('ffmpeg'))

try:
    import pydub
    print('pydub available:', pydub.__version__)
except Exception as e:
    print('pydub not available:', e)

# generate 2s silent wav and 2s tone wav
RATE = 16000
DURATION = 2.0
SAMPLES = int(RATE * DURATION)

silence_path = 'vad_silence.wav'
tone_path = 'vad_tone.wav'

# create silence
with wave.open(silence_path, 'wb') as wf:
    wf.setnchannels(1)
    wf.setsampwidth(2)
    wf.setframerate(RATE)
    wf.writeframes(b'\x00\x00' * SAMPLES)

# create tone (sine 440Hz)
with wave.open(tone_path, 'wb') as wf:
    wf.setnchannels(1)
    wf.setsampwidth(2)
    wf.setframerate(RATE)
    frames = bytearray()
    for n in range(SAMPLES):
        t = n / RATE
        val = int(0.5 * 32767.0 * math.sin(2.0 * math.pi * 440.0 * t))
        frames += struct.pack('<h', val)
    wf.writeframes(frames)

# import our helpers
try:
    from voice.voice_generation import has_speech, _energy_based_speech_check, _detect_speech_vad
    print('Imported VAD helpers from voice.voice_generation')
except Exception as e:
    print('Failed to import VAD helpers:', e)
    raise

print('\nRunning energy-based check:')
try:
    s_sil = _energy_based_speech_check(silence_path)
    s_tone = _energy_based_speech_check(tone_path)
    print('energy silence ->', s_sil)
    print('energy tone   ->', s_tone)
except Exception as e:
    print('Energy check failed:', e)

print('\nRunning has_speech (full pipeline):')
try:
    hs_sil = has_speech(silence_path)
    hs_tone = has_speech(tone_path)
    print('has_speech silence ->', hs_sil)
    print('has_speech tone   ->', hs_tone)
except Exception as e:
    print('has_speech failed:', e)

print('\nFiles created:')
print(os.path.abspath(silence_path))
print(os.path.abspath(tone_path))
