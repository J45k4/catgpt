from multiprocessing import Process, Queue, Value
import subprocess
import sys
import time
import numpy as np
import pyaudio
import torch
import whisper
import openai
import os

from helpers import DEBUG

openai.api_key = os.getenv("OPENAI_API_KEY")

FORMAT = pyaudio.paInt16  # Sample format (16-bit integer)
CHANNELS = 1              # Number of audio channels (1 for mono, 2 for stereo)
RATE = 16000              # Sample rate (samples per second)
CHUNK = 1600              # Number of frames per buffer

device = "cuda" if torch.cuda.is_available() else "cpu"
model_root = "~/.cache/whisper"
model="base.en"
audio_model = whisper.load_model(model, download_root=model_root).to(device)

def microphone_task(frame_queue: Queue, dont_listen: Value) -> None:
    p = pyaudio.PyAudio()
    stream = p.open(format=FORMAT, channels=CHANNELS, rate=RATE, input=True, frames_per_buffer=CHUNK)
    print("Listening for speech...")
    while True:
        frames = []
        for _ in range(int(RATE / CHUNK * 1)):
            if dont_listen.value:
                break

            data =stream.read(CHUNK, exception_on_overflow=False)
            frame = torch.from_numpy(np.frombuffer(data, np.int16).flatten().astype(np.float32) / 32768.0)
            frames.append(frame)

        if dont_listen.value:
            continue

        frame_queue.put_nowait(frames)

def sound_regocnition_task(frame_queue: Queue, text_queue: Queue):
    frames = []
    last_text = ""
    last_change_time = time.time()

    while True:
        new_frames = frame_queue.get()
        frames.extend(new_frames)

        if len(frames) == 0:
            continue

        if len(frames) > 50:
            if DEBUG > 0: print("Too many frames")
            frames = frames[-50:]

        data = torch.cat(frames)
        result = audio_model.transcribe(data,language='english', no_speech_threshold=0.4)
        if DEBUG > 1: print(result)
        text = result["text"]

        # print(text)

        if text == " ." or text == "":
            continue

        segemnts = result["segments"]

        if len(segemnts) == 0 or segemnts[0]["no_speech_prob"] > 0.4:
            # print("No speech detected")
            continue

        if text != last_text:
            last_text = text
            print(text, end='\r')
            print("", end='', flush=True)
            last_change_time = time.time()
            continue

        # if time.time() - last_change_time < 1:
        #     continue

        if DEBUG > 0: print("Speech detected: ", result)

        frames = []

        text_queue.put_nowait(text)

system_msg_content = '''You are samuel L jackson and you speak like him. He is know to swear a lot.
you can also come up with your own family friendly swear words. You have anger
management issues and sometimes you get angry for no reason.
Also use his famous quotes a lot when you speak.
Be very brief with your responses!
'''

system_message = {
    "role": "system",
    "content": system_msg_content
}

def chat_completion(text_queue: Queue, dont_listen: Value):
    messages = [system_message]

    while True:
        text = text_queue.get()
        print("You: ", text)

        messages.append({
            "role": "user",
            "content": text
        })

        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=messages,
            stream=True
        )

        dont_listen.value = True

        response_text = ""
        sentence = ""
        print("Samuel Jackson: ", end="")
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

        print()

        messages.append({
            "role": "assistant",
            "content": response_text
        })

        if len(messages) > 4:
            messages = [system_message] + messages[-4:]

        dont_listen.value = False

if __name__ == "__main__":
    dont_listen = Value("i", 0)

    text_queue = Queue()
    frame_queue = Queue()

    mic_process = Process(target=microphone_task, args=(frame_queue, dont_listen))
    mic_process.start()

    sound_regocnition_process = Process(target=sound_regocnition_task, args=(frame_queue, text_queue))
    sound_regocnition_process.start()

    chat_process = Process(target=chat_completion, args=(text_queue, dont_listen))
    chat_process.start()

    mic_process.join()
    sound_regocnition_process.join()
    chat_process.join()