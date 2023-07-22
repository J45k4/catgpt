from gtts import gTTS
import argparse

parser = argparse.ArgumentParser(description='Convert text to speech')
parser.add_argument('--text', type=str, help='Text to convert to speech')
parser.add_argument("--out", type=str, help="Output file name")
parser.add_argument("--lang", type=str, default="fi", help="Language of the text")

args = parser.parse_args()

mytext = args.text
output_file = args.out

language = 'fi'
  
myobj = gTTS(text=mytext, lang=language, slow=False)
  
myobj.save(output_file)