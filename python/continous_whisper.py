import pyaudio
import whisper
import torch
import numpy as np
import openai
import os
import sys
import subprocess

openai.api_key = os.getenv("OPENAI_API_KEY")

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

system_msg = '''You are samuel L jackson and you speak like him. He is know to swear a lot 
but when you swear use family friendly words like moterpflipping and mother trucker.
Also use his famous quotes a lot when you speak.
Be brief with your responses!'''

messages = [
    {
        "role": "system",
        "content": system_msg
    }
]

print("Recording...")

last_text = ""

frames = []
while True:
    text = last_text
    try:
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
        text = result["text"]
    except Exception as e:
        print(e)
        stream = p.open(format=FORMAT, channels=CHANNELS, rate=RATE, input=True, frames_per_buffer=CHUNK)
        continue

    if text == " ." or text == "":
        print("No speech detected")
        continue

    segemnts = result["segments"]

    if len(segemnts) == 0 or segemnts[0]["no_speech_prob"] > 0.75:
        print("No speech detected")
        continue

    if text != last_text:
        last_text = text
    else:
        print("Nothing new")
        frames = []
        messages.append({
            "role": "user",
            "content": text
        })
        
        if len(messages) > 4:
            messages = [{
                "role": "system",
                "content": system_msg
            }] + messages[-4:]

        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=messages,
            stream=True
        )

        response_text = ""
        sentence = ""
        sentence_index = 1
        player_thread = None
        print("GPT3: ", end="")
        for chunk in response:
            delta = chunk["choices"][0]["delta"]
            # print(delta)
            if hasattr(delta, "content"):
                content = delta["content"]
                if content != "":
                    print(content, end="")
                    response_text += content
                    sentence += content
                    sys.stdout.flush()

                    if "." in content or "?" in content or "!" in content or ":" in content or ";" in content:
                        subprocess.run(["say", sentence])
                        sentence = ""
                        

    # segents = result["segments"]

    # if len(segents) == 0 or segents[0]["no_speech_prob"] > 0.8:
    #     print("No speech detected")
    #     frames = []
    # else:
    #     print("Speech detected")


print("Recording finished.")
