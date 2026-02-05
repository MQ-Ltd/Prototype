from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import tensorflow as tf
import tensorflow_hub as hub  # <--- NEW LIBRARY
import librosa
import numpy as np
import io

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- GLOBAL VARIABLES ---
yamnet_model = None
my_model = None

# --- LOAD MODELS ---
print("⏳ Loading models...")
try:
    # 1. Load Base YAMNet (The Feature Extractor)
    # This converts Audio -> Numbers (1024 embeddings)
    yamnet_model = hub.load('https://tfhub.dev/google/yamnet/1')
    print("✅ Base YAMNet loaded")

    # 2. Load Your Custom Model (The Classifier)
    # This converts Numbers -> Chord Labels
    my_model = tf.keras.models.load_model("yamnet_top_model.h5")
    print("✅ Custom Chord Model loaded")
    
except Exception as e:
    print(f"❌ CRITICAL ERROR loading models: {e}")

# --- DEFINE CLASSES ---
# Make sure this list is 100% correct based on your training folders
CLASSES = [
    "1st String Correct",
    "1st String is getting touched by middlefinger",
    "1st String pressed far",
    "2nd String Correct",
    "2nd String pressed far",
    "3rd String Correct",
    "3rd String is getting touched by middlefield",
    "3rd String pressed far",
    "4th String Correct",
    "4th String is getting touched by index finger",
    # ... add the rest of your folder names here ...
]

@app.post("/predict-audio")
async def predict_audio(file: UploadFile = File(...)):
    if yamnet_model is None or my_model is None:
        raise HTTPException(status_code=500, detail="Models not loaded")

    try:
        # A. Read & Decode Audio
        audio_bytes = await file.read()
        # YAMNet requires 16000 Hz, mono
        waveform, sr = librosa.load(io.BytesIO(audio_bytes), sr=16000, mono=True)

        # B. Run Base YAMNet to get Embeddings
        # The model returns: [scores, embeddings, spectrogram]
        # We only need the 'embeddings' (Shape: N x 1024)
        scores, embeddings, spectrogram = yamnet_model(waveform)
        
        # C. Prepare Embeddings for Your Model
        # If the audio is long, YAMNet creates multiple embeddings.
        # We usually take the average (mean) to represent the whole clip.
        if len(embeddings) == 0:
             raise HTTPException(status_code=400, detail="Audio too short to analyze")
        
        # Average the embeddings -> Shape (1024,)
        final_embedding = np.mean(embeddings, axis=0)
        
        # Add batch dimension -> Shape (1, 1024)
        # This matches the input your 'dense_9' layer expects!
        input_data = np.expand_dims(final_embedding, axis=0)

        # D. Run Your Custom Model
        prediction = my_model.predict(input_data)
        
        # E. Process Result
        predicted_index = np.argmax(prediction[0])
        confidence = float(np.max(prediction[0]))
        predicted_label = CLASSES[predicted_index]

        # F. Generate Feedback
        is_correct = "Correct" in predicted_label
        feedback_msg = "Perfect technique!" if is_correct else f"Correction needed: {predicted_label}"

        return {
            "label": predicted_label,
            "confidence": confidence,
            "feedback": feedback_msg
        }

    except Exception as e:
        print(f"Error processing audio: {e}")
        raise HTTPException(status_code=500, detail=str(e))