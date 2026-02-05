import base64
import json
import numpy as np
import cv2
import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from ultralytics import YOLO

# ---------------- CONFIGURATION ----------------
# Using relative paths so it works on any server
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "best.pt")
SMART_MODEL_JSON = os.path.join(BASE_DIR, "D_finger_positions.json")
TARGET_FRET_CLASSES = [1, 2] # We only care about Fret 2 and 3 for the D Chord

app = Flask(__name__)
CORS(app) # Enable Cross-Origin Resource Sharing (allows frontend to talk to backend)

@app.route('/')
def health():
    return jsonify({'status': 'ok', 'message': 'Vision backend running'})

# ---------------- INITIALIZATION ----------------
print(f"Server starting... Loading model from {MODEL_PATH}")

try:
    # Load YOLO Model
    yolo_model = YOLO(MODEL_PATH, task='obb')
    
    # Load Chord Data
    with open(SMART_MODEL_JSON, 'r') as f:
        smart_model = json.load(f)
        
    print("✅ System Ready. Model and Data loaded.")
except Exception as e:
    print(f"❌ CRITICAL ERROR: Could not load model or JSON. Check paths.\nError: {e}")

# ---------------- HELPER MATH FUNCTIONS ----------------
# These are identical to your local script to ensure consistency

def unit_vector(v):
    norm = np.linalg.norm(v)
    if norm == 0: return v
    return v / norm

def get_mastered_line(fret_boxes):
    if 1 not in fret_boxes or 2 not in fret_boxes: return None, None
    f1_pts = np.array(fret_boxes[1]).reshape(4, 2)
    f2_pts = np.array(fret_boxes[2]).reshape(4, 2)
    all_points = np.vstack([f1_pts, f2_pts])
    sorted_by_x = all_points[all_points[:, 0].argsort()]
    inner_edge_points = sorted_by_x[2:6]
    sorted_by_y = inner_edge_points[inner_edge_points[:, 1].argsort()]
    master_top = np.mean(sorted_by_y[0:2], axis=0)
    master_bottom = np.mean(sorted_by_y[2:4], axis=0)
    return master_top, master_bottom

def calculate_robust_finger_pos(master_top, master_bottom, f2_pts, f3_pts, string_num, fret_percent):
    t = (6.0 - string_num) / 5.0
    line_vec = master_bottom - master_top
    string_point = master_top + (line_vec * t)
    line_unit = unit_vector(line_vec)
    perp_unit = np.array([-line_unit[1], line_unit[0]]) 
    
    f2_mean = np.mean(f2_pts, axis=0); f3_mean = np.mean(f3_pts, axis=0)
    direction_check = f3_mean - f2_mean
    if np.dot(perp_unit, direction_check) < 0: perp_unit = -perp_unit

    if f2_mean[0] < f3_mean[0]:
        left_pts = f2_pts; right_pts = f3_pts
    else:
        left_pts = f3_pts; right_pts = f2_pts

    left_sorted = left_pts[left_pts[:, 0].argsort()]
    left_outer = left_sorted[0:2][left_sorted[0:2][:, 1].argsort()]
    right_sorted = right_pts[right_pts[:, 0].argsort()]
    right_outer = right_sorted[2:4][right_sorted[2:4][:, 1].argsort()]

    if fret_percent < 0:
        d_top = np.linalg.norm(master_top - left_outer[0])
        d_bot = np.linalg.norm(master_bottom - left_outer[1])
        width = (d_top + d_bot) / 2.0
    else:
        d_top = np.linalg.norm(master_top - right_outer[0])
        d_bot = np.linalg.norm(master_bottom - right_outer[1])
        width = (d_top + d_bot) / 2.0

    pixels_move = (fret_percent / 100.0) * width
    final_xy = string_point + (perp_unit * pixels_move)
    return final_xy

def decode_image(base64_string):
    """Converts base64 frontend string to OpenCV image"""
    if ',' in base64_string:
        base64_string = base64_string.split(',')[1]
    img_data = base64.b64decode(base64_string)
    np_arr = np.frombuffer(img_data, np.uint8)
    img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    return img

# Hitbox settings (matching notebook)
VISUAL_RADIUS_FACTOR = 0.12
HIT_RADIUS_MULTIPLIER = 1.6
SCORING_RADIUS_MULTIPLIER = 3.5

FINGER_GROUPS = {
    "index": ["index", "im"], "middle": ["middle", "mm"],
    "ring": ["ring", "rm"], "pinky": ["pinky", "pm"]
}

# ---------------- API ENDPOINTS ----------------

@app.route('/detect_frets', methods=['POST'])
def detect_frets():
    """Continuous fret detection - returns fret box coordinates for drawing before lock"""
    try:
        data = request.json
        if 'image' not in data:
            return jsonify({'success': False, 'error': 'No image provided'}), 400

        img = decode_image(data['image'])
        img = cv2.flip(img, 1)  # Mirror to match what user sees
        h, w, _ = img.shape

        # Run YOLO Detection
        results = yolo_model.predict(img, verbose=False)[0]
        detected_frets = {}
        fret_boxes = {}
        
        if hasattr(results, 'obb'):
            for box, conf, cls in zip(results.obb.xyxyxyxy.cpu().numpy(), results.obb.conf.cpu().numpy(), results.obb.cls.cpu().numpy()):
                if conf >= 0.02 and int(cls) in TARGET_FRET_CLASSES:
                    cls_id = int(cls)
                    detected_frets[cls_id] = box
                    # Convert to normalized coordinates for frontend
                    pts = box.reshape(4, 2)
                    fret_boxes[cls_id] = [
                        {"x": float(pt[0] / w), "y": float(pt[1] / h)} 
                        for pt in pts
                    ]

        has_both = 1 in detected_frets and 2 in detected_frets
        
        return jsonify({
            'success': True,
            'fret_boxes': fret_boxes,
            'ready_to_lock': has_both
        })

    except Exception as e:
        print(f"Detection Error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/lock_fretboard', methods=['POST'])
def lock_fretboard():
    try:
        data = request.json
        if 'image' not in data:
            return jsonify({'success': False, 'error': 'No image provided'}), 400

        img = decode_image(data['image'])
        img = cv2.flip(img, 1)  # Mirror to match what user sees
        
        h, w, _ = img.shape

        # Run YOLO Detection
        results = yolo_model.predict(img, verbose=False)[0]
        detected_frets = {}
        
        if hasattr(results, 'obb'):
            for box, conf, cls in zip(results.obb.xyxyxyxy.cpu().numpy(), results.obb.conf.cpu().numpy(), results.obb.cls.cpu().numpy()):
                if conf >= 0.02 and int(cls) in TARGET_FRET_CLASSES:
                    detected_frets[int(cls)] = box

        if 1 not in detected_frets or 2 not in detected_frets:
            print("Detection Failed: Missing Fret 2 or 3")
            return jsonify({
                'success': False, 
                'message': 'Could not find Fret 2 and 3. Please align guitar clearly.'
            })

        master_top, master_bottom = get_mastered_line(detected_frets)
        f2_pts = np.array(detected_frets[1]).reshape(4, 2)
        f3_pts = np.array(detected_frets[2]).reshape(4, 2)

        # Calculate Finger Target Points in PIXELS (not normalized)
        targets = {}
        calculated_targets_px = {}

        for finger_name, finger_data in smart_model.items():
            target_xy = None
            parent_group = next((k for k, v in FINGER_GROUPS.items() if finger_name in v), finger_name)

            if 'string_number' in finger_data:
                target_xy = calculate_robust_finger_pos(
                    master_top, master_bottom, f2_pts, f3_pts, 
                    finger_data['string_number'], finger_data.get('fret_percent', 0)
                )
            elif 'ref_finger' in finger_data:
                ref_name = finger_data['ref_finger']
                if ref_name in calculated_targets_px:
                    ref_pt = calculated_targets_px[ref_name]
                    master_len = np.linalg.norm(master_bottom - master_top)
                    dist_pixels = finger_data.get('avg_rel_dist_norm', 0) * master_len
                    master_vec = master_bottom - master_top
                    angle_deg = finger_data.get('avg_rel_angle_deg', 0)
                    angle_rad = np.arctan2(master_vec[1], master_vec[0]) + np.radians(angle_deg)
                    offset = np.array([np.cos(angle_rad), np.sin(angle_rad)]) * dist_pixels
                    target_xy = ref_pt + offset

            if target_xy is not None:
                calculated_targets_px[finger_name] = target_xy
                # Return normalized coordinates (0-1)
                targets[finger_name] = {
                    "x": float(target_xy[0] / w), 
                    "y": float(target_xy[1] / h),
                    "group": parent_group
                }

        # Visual radius and hit radii (matching notebook)
        master_len = np.linalg.norm(master_bottom - master_top)
        visual_radius_px = master_len * VISUAL_RADIUS_FACTOR
        
        # Also return fret boxes for overlay
        fret_boxes = {}
        for cls_id, box in detected_frets.items():
            pts = np.array(box).reshape(4, 2)
            fret_boxes[cls_id] = [
                {"x": float(pt[0] / w), "y": float(pt[1] / h)} 
                for pt in pts
            ]

        print("✅ Lock Successful! Sending targets to frontend.")
        
        return jsonify({
            'success': True,
            'targets': targets,
            'fret_boxes': fret_boxes,
            'visual_radius_norm': float(visual_radius_px / w),
            'hit_radius_multiplier': HIT_RADIUS_MULTIPLIER,
            'scoring_radius_multiplier': SCORING_RADIUS_MULTIPLIER
        })

    except Exception as e:
        print(f"Server Error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

if __name__ == '__main__':
    # Run the server
    # host='0.0.0.0' makes it accessible on your local network
    app.run(debug=True, port=5000, host='0.0.0.0')