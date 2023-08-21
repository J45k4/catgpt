import pyaudio
import whisper
import torch
import numpy as np

model_root = "~/.cache/whisper"
device = "cuda" if torch.cuda.is_available() else "cpu"
# if torch.backends.mps.is_available():
#     device = torch.device("mps")

model="base.en"

audio_model = whisper.load_model(model, download_root=model_root).to(device)

p = pyaudio.PyAudio()

# Define parameters
FORMAT = pyaudio.paInt16  # Sample format (16-bit integer)
CHANNELS = 1              # Number of audio channels (1 for mono, 2 for stereo)
RATE = 16000              # Sample rate (samples per second)
CHUNK = 1600              # Number of frames per buffer

stream = p.open(format=FORMAT, channels=CHANNELS, rate=RATE, input=True, frames_per_buffer=CHUNK)


print("Recording...")

frames = []
while True:
    for _ in range(int(RATE / CHUNK * 1)):
        data = stream.read(CHUNK)
        #print(len(data))
        frame = torch.from_numpy(np.frombuffer(data, np.int16).flatten().astype(np.float32) / 32768.0)
        frames.append(frame)
        # print(data.shape)
        # result = audio_model.transcribe(data,language='english')
        # print(result["text"])

    data = torch.cat(frames)
    result = audio_model.transcribe(data,language='english', no_speech_threshold=0.4)
    print(result)

    segents = result["segments"]

    if len(segents) == 0 or segents[0]["no_speech_prob"] > 0.8:
        print("No speech detected")
        frames = []
    else:
        print("Speech detected")


print("Recording finished.")
