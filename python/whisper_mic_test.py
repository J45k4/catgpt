import openai
import sys
import subprocess
import torch
import speech_recognition as sr
import pynput.keyboard
import platform
import logging
import whisper
import time
import queue
import os
import numpy as np
from typing_extensions import Literal
from rich.logging import RichHandler
from transformers import SpeechT5Processor, SpeechT5ForTextToSpeech, SpeechT5HifiGan
from datasets import load_dataset
import soundfile as sf
import threading

def get_logger(name: str, level: Literal["info", "warning", "debug"]) -> logging.Logger:
    rich_handler = RichHandler(level=logging.INFO, rich_tracebacks=True, markup=True)

    logger = logging.getLogger(name)
    logger.setLevel(logging._nameToLevel[level.upper()])

    if not logger.handlers:
        logger.addHandler(rich_handler)

    logger.propagate = False

    return logger

class WhisperMic:
    def __init__(self,model="base",device=("cuda" if torch.cuda.is_available() else "cpu"),english=False,verbose=False,energy=300,pause=0.8,dynamic_energy=False,save_file=False, model_root="~/.cache/whisper",mic_index=None):
        self.logger = get_logger("whisper_mic", "info")
        self.energy = energy
        self.pause = pause
        self.dynamic_energy = dynamic_energy
        self.save_file = save_file
        self.verbose = verbose
        self.english = english
        self.keyboard = pynput.keyboard.Controller()

        self.platform = platform.system()

        if self.platform == "darwin":
            if device == "mps":
                self.logger.warning("Using MPS for Mac, this does not work but may in the future")
                device = "mps"
                device = torch.device(device)

        if (model != "large" and model != "large-v2") and self.english:
            model = model + ".en"
        
        self.audio_model = whisper.load_model(model, download_root=model_root).to(device)
        self.temp_dir = tempfile.mkdtemp() if save_file else None

        self.audio_queue = queue.Queue()
        self.result_queue: "queue.Queue[str]" = queue.Queue()

        self.break_threads = False
        self.mic_active = False

        self.banned_results = [""," ","\n",None]

        self.setup_mic(mic_index)


    def setup_mic(self, mic_index):
        if mic_index is None:
            self.logger.info("No mic index provided, using default")
        self.source = sr.Microphone(sample_rate=16000, device_index=mic_index)

        self.recorder = sr.Recognizer()
        self.recorder.energy_threshold = self.energy
        self.recorder.pause_threshold = self.pause
        self.recorder.dynamic_energy_threshold = self.dynamic_energy

        with self.source:
            self.recorder.adjust_for_ambient_noise(self.source)

        subprocess.run(["say", "ready to listen"])
        self.recorder.listen_in_background(self.source, self.record_callback, phrase_time_limit=2)
        self.logger.info("Mic setup complete, you can now talk")


    def preprocess(self, data):
        return torch.from_numpy(np.frombuffer(data, np.int16).flatten().astype(np.float32) / 32768.0)

    def get_all_audio(self, min_time: float = -1.):
        audio = bytes()
        got_audio = False
        time_start = time.time()
        while not got_audio or time.time() - time_start < min_time:
            while not self.audio_queue.empty():
                audio += self.audio_queue.get()
                got_audio = True

        data = sr.AudioData(audio,16000,2)
        data = data.get_raw_data()
        return data


    def record_callback(self,_, audio: sr.AudioData) -> None:
        data = audio.get_raw_data()
        self.audio_queue.put_nowait(data)


    def transcribe_forever(self) -> None:
        while True:
            if self.break_threads:
                break
            self.transcribe()


    def transcribe(self,data=None, realtime: bool = False) -> None:
        if data is None:
            audio_data = self.get_all_audio()
        else:
            audio_data = data
        audio_data = self.preprocess(audio_data)
        # if self.english:
        #     result = self.audio_model.transcribe(audio_data,language='finnish')
        # else:
        #     result = self.audio_model.transcribe(audio_data)

        result = self.audio_model.transcribe(audio_data,language='english')

        predicted_text = result["text"]
        if not self.verbose:
            if predicted_text not in self.banned_results:
                self.result_queue.put_nowait(predicted_text)
        else:
            if predicted_text not in self.banned_results:
                self.result_queue.put_nowait(result)

        if self.save_file:
            os.remove(audio_data)


    def listen_loop(self, dictate: bool = False) -> None:
        threading.Thread(target=self.transcribe_forever).start()
        while True:
            result = self.result_queue.get()
            if dictate:
                self.keyboard.type(result)
            else:
                print(result)


    def listen(self, timeout: int = 3):
        audio_data = self.get_all_audio(timeout)
        self.transcribe(data=audio_data)
        while True:
            if not self.result_queue.empty():
                return self.result_queue.get()

    def toggle_microphone(self) -> None:
        #TO DO: make this work
        self.mic_active = not self.mic_active
        if self.mic_active:
            print("Mic on")
        else:
            print("turning off mic")
            self.mic_thread.join()
            print("Mic off")

openai.api_key = os.getenv("OPENAI_API_KEY")

processor = SpeechT5Processor.from_pretrained("microsoft/speecht5_tts")
model = SpeechT5ForTextToSpeech.from_pretrained("microsoft/speecht5_tts")
vocoder = SpeechT5HifiGan.from_pretrained("microsoft/speecht5_hifigan")
embeddings_dataset = load_dataset("Matthijs/cmu-arctic-xvectors", split="validation")
speaker_embeddings = torch.tensor(embeddings_dataset[7306]["xvector"]).unsqueeze(0)

system_msg = '''You are cat you speak like a cat. You randomly meow and purr.
If you say number 1 say it as one. or like 25 say it as twenty five.  etc... This is very important!!'''

messages = [{
    "role": "system",
    "content": system_msg
}]

def speak():
    while True:
        files = os.listdir(".")

        speech_files = [f for f in files if f.startswith("speech")]
        sorted_files = sorted(speech_files, key=lambda x: int(x.split("speech")[1].split(".wav")[0]))

        if len(sorted_files) == 0:
            break

        while len(sorted_files) > 0:
            file = sorted_files.pop(0)
            subprocess.run(["afplay", file])
            os.remove(file)

while True:
    mic = WhisperMic()
    result = mic.listen(timeout=6)
    print('You: {}'.format(result))
    messages.append({
        "role": "user",
        "content": result
    })

    if len(messages) > 4:
        messages = [{
            "role": "system",
            "content": system_msg
        }] + messages[-4:]

    print("sending messages", messages)

    subprocess.run(["say", "thingking"])
    response = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        messages=messages,
        stream=True
    )

    # print(response)
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
                    inputs = processor(text='''{}'''.format(sentence), return_tensors="pt")      
                    # embeddings_dataset = load_dataset("magnustragardh/speecht5_finetuned_voxpopuli_fi", split="validation")
                    speech = model.generate_speech(inputs["input_ids"], speaker_embeddings, vocoder=vocoder)

                    sf.write('speech{}.wav'.format(sentence_index), speech.numpy(), samplerate=16000)
                    sentence_index += 1
                    # subprocess.run(["say", sentence])
                    # subprocess.run(["afplay", "speech.wav"])
                    sentence = ""

                    if player_thread is None or not player_thread.is_alive():
                        player_thread = threading.Thread(target=speak)
                        player_thread.start()
                        
                
    player_thread.join()

    # print("start speaking")
    # subprocess.run(["say", response_text])
    # print("done speaking")

    messages.append({
        "role": "assistant",
        "content": response_text
    })
    

    # choice = response["choices"][0].message.content

    # print('GPT3: {}'.format(choice))


