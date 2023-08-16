from transformers import SpeechT5Processor, SpeechT5ForTextToSpeech, SpeechT5HifiGan
from datasets import load_dataset
import torch
import soundfile as sf
from datasets import load_dataset

# Load model directly
from transformers import AutoProcessor, SpeechT5ForTextToSpeech

# processor = AutoProcessor.from_pretrained("magnustragardh/speecht5_finetuned_voxpopuli_fi")
# model = SpeechT5ForTextToSpeech.from_pretrained("magnustragardh/speecht5_finetuned_voxpopuli_fi")
# vocoder = SpeechT5HifiGan.from_pretrained("magnustragardh/speecht5_finetuned_voxpopuli_fi")

processor = SpeechT5Processor.from_pretrained("microsoft/speecht5_tts")
model = SpeechT5ForTextToSpeech.from_pretrained("microsoft/speecht5_tts")
vocoder = SpeechT5HifiGan.from_pretrained("microsoft/speecht5_hifigan")

inputs = processor(text='''
In the vast expanse of the cosmos, a fierce intergalactic war rages on between the Mountain Dew faction and the Dr Pepper alliance. These two soda empires, fueled by their ardently loyal followers, seek to dominate not only the taste buds of the universe but also the very fabric of space and time.

High above the celestial battlegrounds, a renegade Mountain Dew warrior named Thundercharge, with his neon-green armor and electrifying presence, fights with a reckless abandon.

''', return_tensors="pt")

# load xvector containing speaker's voice characteristics from a dataset
embeddings_dataset = load_dataset("Matthijs/cmu-arctic-xvectors", split="validation")
# embeddings_dataset = load_dataset("magnustragardh/speecht5_finetuned_voxpopuli_fi", split="validation")
speaker_embeddings = torch.tensor(embeddings_dataset[7306]["xvector"]).unsqueeze(0)

speech = model.generate_speech(inputs["input_ids"], speaker_embeddings, vocoder=vocoder)

sf.write("speech.wav", speech.numpy(), samplerate=16000)