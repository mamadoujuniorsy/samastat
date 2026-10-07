import os
import tempfile
from pathlib import Path

import torch
from fastapi import FastAPI, File, HTTPException, UploadFile
from transformers import pipeline

MODEL_ID = os.getenv("SAMASTAT_ASR_MODEL", "AIHubSN/kiriku-ASR")
MODEL_CACHE = os.getenv("SAMASTAT_ASR_CACHE", "/models")
DEVICE = 0 if torch.cuda.is_available() and os.getenv("SAMASTAT_ASR_DEVICE", "auto") != "cpu" else -1

app = FastAPI(title="SamaStat local Wolof ASR")
recognizer = None


def get_recognizer():
    global recognizer
    if recognizer is None:
        recognizer = pipeline(
            "automatic-speech-recognition",
            model=MODEL_ID,
            device=DEVICE,
            cache_dir=MODEL_CACHE,
        )
    return recognizer


@app.get("/health")
def health():
    return {
        "status": "ok",
        "model": MODEL_ID,
        "device": "cuda" if DEVICE == 0 else "cpu",
        "loaded": recognizer is not None,
    }


@app.post("/transcribe")
async def transcribe(audio: UploadFile = File(...)):
    if not audio.filename:
        raise HTTPException(status_code=400, detail="Audio manquant.")
    suffix = Path(audio.filename).suffix or ".audio"
    content = await audio.read()
    if not content:
        raise HTTPException(status_code=400, detail="Audio vide.")
    if len(content) > 16 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Audio trop volumineux.")

    path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(content)
            path = tmp.name
        result = get_recognizer()(path, generate_kwargs={"task": "transcribe"})
        text = result.get("text", "").strip()
        if len(text) < 2:
            raise HTTPException(status_code=422, detail="Aucune parole reconnue.")
        return {"text": text, "language": "wo", "model": MODEL_ID}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"ASR local indisponible : {exc}") from exc
    finally:
        if path:
            Path(path).unlink(missing_ok=True)
