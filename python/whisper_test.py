import whisper
import time

model = whisper.load_model("base")
now = time.time()
result = model.transcribe("../workdir/turn_on_the_lights.wav")
print(result["text"])
print("Time taken: %f" % (time.time() - now))