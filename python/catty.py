from multiprocessing import Process, Queue, Value
import queue
import subprocess
import sys
import time
import numpy as np
import pyaudio
import torch
import whisper
import openai
import os
from transformers import SpeechT5Processor, SpeechT5ForTextToSpeech, SpeechT5HifiGan
from datasets import load_dataset
import simpleaudio as sa
import soundfile as sf

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
            last_change_time = time.time()
            continue

        # if time.time() - last_change_time < 1:
        #     continue

        if DEBUG > 0: print("Speech detected: ", result)

        frames = []

        text_queue.put_nowait(text)

system_msg_content = '''You catty the housecat who likes to meow and purr. 
You are very friendly and like to talk to people.
Be very brief with your responses!
'''

system_message = {
    "role": "system",
    "content": system_msg_content
}

def chat_completion(text_queue: Queue, sentence_queue: Queue, dont_listen: Value):
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

        response_text = ""
        sentence = ""
        sentence_index = 1
        player_thread = None
        print("Catty: ", end="")
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
                        sentence_queue.put_nowait(sentence)
                        sentence = ""

        print()

        messages.append({
            "role": "assistant",
            "content": response_text
        })

        if len(messages) > 4:
            messages = [system_message] + messages[-4:]

processor = SpeechT5Processor.from_pretrained("microsoft/speecht5_tts")
model = SpeechT5ForTextToSpeech.from_pretrained("microsoft/speecht5_tts")
vocoder = SpeechT5HifiGan.from_pretrained("microsoft/speecht5_hifigan")
embeddings_dataset = load_dataset("Matthijs/cmu-arctic-xvectors", split="validation")
speaker_embeddings = torch.tensor(embeddings_dataset[7306]["xvector"]).unsqueeze(0)

def generate_speech(sentence_queue: Queue, sound_queue: Queue):
    while True:
        sentence = sentence_queue.get()
        if DEBUG > 1: print("Generating speech for: ", sentence)
        inputs = processor(text=sentence, return_tensors="pt")
        if DEBUG > 1: print("inputs: ", inputs)
        speech = model.generate_speech(inputs["input_ids"], speaker_embeddings, vocoder=vocoder)
        sound_queue.put_nowait(speech.numpy())

def speak(sound_queue: Queue, dont_listen: Value):
    while True:
        sound = sound_queue.get()
        if not dont_listen.value:
            if DEBUG > 0: print("Start speaking")
            dont_listen.value = True    
        sf.write('speech.wav', sound, samplerate=16000)
        # if DEBUG > 0: print("Playing sound")
        subprocess.run(["afplay", "speech.wav"])
        # if DEBUG > 0: print("Done playing sound")
        os.remove("speech.wav")

        if sound_queue.empty():
            if DEBUG > 0: print("Done speaking")
            dont_listen.value = False

        # obj = sa.play_buffer(sound, 1, 2, 16000)
        # obj.wait_done()

if __name__ == "__main__":
    dont_listen = Value("i", 0)

    text_queue = Queue()
    frame_queue = Queue()
    sentence_queue = Queue()
    sound_queue = Queue()

    mic_process = Process(target=microphone_task, args=(frame_queue, dont_listen))
    mic_process.start()

    sound_regocnition_process = Process(target=sound_regocnition_task, args=(frame_queue, text_queue))
    sound_regocnition_process.start()

    chat_process = Process(target=chat_completion, args=(text_queue, sentence_queue, dont_listen))
    chat_process.start()

    speech_process = Process(target=generate_speech, args=(sentence_queue, sound_queue))
    speech_process.start()

    speak_process = Process(target=speak, args=(sound_queue, dont_listen))
    speak_process.start()

    # sentence_queue.put_nowait("Hello, I am Catty the cat. I like to meow and purr. I am very friendly and like to talk to people.")

    mic_process.join()
    sound_regocnition_process.join()
    chat_process.join()
    speech_process.join()
    speak_process.join()