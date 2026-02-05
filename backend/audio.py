from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import numpy as np
import librosa
import tensorflow as tf
import tensorflow_hub as hub
import shutil
import os
import tempfile

# --- CONFIGURATION ---
CUSTOM_MODEL_PATH = "yamnet_4data_full.h5"
SAMPLE_RATE = 16000 # Strictly 16kHz for YAMNet

# --- HARDCODED CLASSES (Alphabetical order from your 4dataset) ---
CLASS_NAMES = ["correct", "far", "ringpress"]

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- GLOBAL VARIABLES ---
yamnet_model = None
custom_model = None

@app.on_event("startup")
def load_brain():
    global yamnet_model, custom_model
    if not os.path.exists(CUSTOM_MODEL_PATH):
        raise RuntimeError(f"❌ Critical Error: '{CUSTOM_MODEL_PATH}' not found!")

    print("🧠 Loading Base YAMNet (Feature Extractor)...")
    yamnet_model = hub.load('https://tfhub.dev/google/yamnet/1')
    
    print("🧠 Loading Custom Classifier...")
    custom_model = tf.keras.models.load_model(CUSTOM_MODEL_PATH)
    print(f"✅ System Ready for {len(CLASS_NAMES)} chord types.")

# --- HELPER: SMART SPIKE FEATURE EXTRACTOR ---
def extract_features(file_path):
    """Isolates the pure string vibration by detecting attack and decay."""
    # 1. Load raw audio
    y, sr = librosa.load(file_path, sr=SAMPLE_RATE)
    y_abs = np.abs(y)
    
    # 2. Find the Peak (Strum Impact)
    peak_idx = np.argmax(y_abs)
    peak_val = y_abs[peak_idx]
    
    # 3. NOISE GATE: Reject silence
    if peak_val < 0.02: 
        print("🤫 Audio too quiet. Ignoring.")
        return None

    # 4. START: Trim leading flat noise
    start_idx = 0
    window_size = 160 # 10ms
    for i in range(peak_idx, window_size, -1):
        window = y_abs[i-window_size:i]
        if np.std(window) < (peak_val * 0.01): # Signal is 'flat'
            start_idx = i
            break

    # 5. END: Follow decay until string stops vibrating
    end_idx = len(y)
    for i in range(peak_idx + window_size, len(y) - window_size, window_size):
        curr_avg = np.mean(y_abs[i:i+window_size])
        prev_avg = np.mean(y_abs[i-window_size:i])
        
        # Stop when signal stops reducing or hits noise floor
        if curr_avg >= prev_avg or curr_avg < (peak_val * 0.05):
            end_idx = i
            break

    # 6. Extract Pure Event
    y_pure = y[start_idx:end_idx]
    print(f"🎯 Isolated Strum: {len(y_pure)/sr:.2f}s")
    
    # 7. Standardize
    y_final = (y_pure - np.mean(y_pure)) / (np.std(y_pure) + 1e-6)

    # 8. YAMNet Processing
    _, embeddings, _ = yamnet_model(tf.constant(y_final, dtype=tf.float32))
    embeddings_mean = tf.reduce_mean(embeddings, axis=0).numpy()
    
    return embeddings_mean[np.newaxis, ...]

# --- API ENDPOINTS ---
@app.post("/predict-audio")
async def predict_audio(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(('.wav', '.m4a', '.mp3')):
        raise HTTPException(status_code=400, detail="Audio files only")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_file:
        shutil.copyfileobj(file.file, temp_file)
        temp_path = temp_file.name

    try:
        embeddings = extract_features(temp_path)
        
        if embeddings is None:
            return {"prediction": "silent", "advice": "Please strum louder!", "status": "success"}
        
        # Classifier Prediction
        prediction_array = custom_model.predict(embeddings, verbose=0)
        idx = np.argmax(prediction_array)
        conf = float(np.max(prediction_array))
        label = CLASS_NAMES[idx]

        return {
            "prediction": label,
            "label": label,
            "confidence": round(conf, 4),
            "advice": get_advice(label),
            "feedback": get_advice(label),
            "raw_predictions": {CLASS_NAMES[i]: float(prediction_array[0][i]) for i in range(len(CLASS_NAMES))},
            "status": "success"
        }
    except Exception as e:
        print(f"❌ Error: {e}")
        raise HTTPException(status_code=500, detail="Server Error")
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

def get_advice(label):
    advice_map = {
        "correct": "✅ Perfect! Your D-Chord sounds great.",
        "far": "📢 Too quiet! Press down harder on the frets.",
        "ringpress": "⚠️ Ring finger is muting the E string! Arch it higher."
    }
    return advice_map.get(label, "Strum clearly again.")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)