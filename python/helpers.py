
import os


def getenv(key, default=0): return type(default)(os.getenv(key, default))
DEBUG = getenv("DEBUG", 0)