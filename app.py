"""
Project Submission System — Flask Backend
==========================================

REQUIRED Railway / environment variables:
  FIREBASE_CREDS        = <paste serviceAccountKey.json content as JSON string>
  FIREBASE_PROJECT_ID   = <your Firebase project ID>          ← PUT YOUR PROJECT ID HERE
  ADMIN_PASSWORD_HASH   = <bcrypt hash>  (or use /api/admin/setup on first run)
  ADMIN_ID              = e.g. ADMIN001   (default: ADMIN001)
  ADMIN_NAME            = e.g. System Administrator
  VAPID_PRIVATE_KEY     = 0Wza3XjCbjcGZ3EZM8b8_9QerDynkv5Sj3wje8a8qpE
  DEBUG                 = false

Push notifications use pywebpush. VAPID keys are already configured
in config.js (public key) and VAPID_PRIVATE_KEY env var (private key).
"""

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials, firestore
import bcrypt
import io, datetime, random, string, os, json

try:
    from pywebpush import webpush, WebPushException
    WEBPUSH_AVAILABLE = True
except ImportError:
    WEBPUSH_AVAILABLE = False
    print("⚠️  pywebpush not installed — push notifications disabled")

# ─────────────────────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────────────────────
DEBUG_MODE          = os.environ.get("DEBUG", "false").lower() == "true"
ADMIN_ID            = os.environ.get("ADMIN_ID",   "ADMIN001").strip()
ADMIN_NAME          = os.environ.get("ADMIN_NAME", "System Administrator").strip()
ADMIN_PASSWORD_HASH = os.environ.get("ADMIN_PASSWORD_HASH", "").strip()

# ── VAPID for Web Push ──────────────────────────────────────
VAPID_PUBLIC_KEY  = "BOImjzVykAe3ETDyIumJYW_Sxw5u4fPlr8kPP_ymFdquJkM7ccZLOuoEAG4C_qTCq8PpPyKghsaI7CxpzrHh3xk"
VAPID_PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY", "0Wza3XjCbjcGZ3EZM8b8_9QerDynkv5Sj3wje8a8qpE").strip()
VAPID_EMAIL       = "mailto:project777008@gmail.com"

# ─────────────────────────────────────────────────────────────
# FLASK SETUP
# ─────────────────────────────────────────────────────────────
app = Flask(__name__, static_folder="static", static_url_path="")
CORS(app, origins=os.environ.get("ALLOWED_ORIGIN", "*"))


# ─────────────────────────────────────────────────────────────
# SERVE FRONTEND
# ─────────────────────────────────────────────────────────────
@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")

@app.route("/<path:path>")
def static_files(path):
    full = os.path.join(app.static_folder, path)
    if os.path.exists(full):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, "index.html")


# ─────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────
def err(message, status=400, code=None):
    p = {"success": False, "message": message}
    if code: p["code"] = code
    return jsonify(p), status

def ok(data: dict):
    return jsonify({"success": True, **data})

def now_iso():
    return datetime.datetime.utcnow().isoformat()

def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt(12)).decode("utf-8")

def check_password(plain: str, hashed: str) -> bool:
    if not plain or not hashed: return False
    try: return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except: return False

def generate_password(length=12):
    chars = string.ascii_letters + string.digits + "!@#$%^&*"
    while True:
        pwd = ''.join(random.choices(chars, k=length))
        if any(c.isupper() for c in pwd) and any(c.islower() for c in pwd) and any(c.isdigit() for c in pwd):
            return pwd

def safe_user(u: dict) -> dict:
    return {k: v for k, v in u.items() if k not in ("passHash",)}

def debug_log(*args):
    if DEBUG_MODE: print("[DEBUG]", *args)


# ─────────────────────────────────────────────────────────────
# FIREBASE INIT
# ─────────────────────────────────────────────────────────────
FIREBASE_READY = False
db = None
PROJECT_ID = os.environ.get("FIREBASE_PROJECT_ID", "").strip()   # ← SET IN RAILWAY

def init_firebase():
    global db, FIREBASE_READY
    creds_json = os.environ.get("FIREBASE_CREDS")
    if creds_json:
        try:
            cred = credentials.Certificate(json.loads(creds_json))
            firebase_admin.initialize_app(cred, {"projectId": PROJECT_ID})
            db = firestore.client()
            FIREBASE_READY = True
            print("✅ Firebase connected via FIREBASE_CREDS")
            return
        except Exception as e:
            print(f"⚠️  FIREBASE_CREDS failed: {e}")
    sa = os.path.join(os.path.dirname(__file__), "serviceAccountKey.json")
    if os.path.exists(sa):
        try:
            firebase_admin.initialize_app(credentials.Certificate(sa), {"projectId": PROJECT_ID})
            db = firestore.client()
            FIREBASE_READY = True
            print("✅ Firebase connected via serviceAccountKey.json")
            return
        except Exception as e:
            print(f"⚠️  serviceAccountKey.json failed: {e}")
    print("❌ Firebase not connected — set FIREBASE_CREDS env var")

init_firebase()


# ─────────────────────────────────────────────────────────────
# BOOTSTRAP ADMIN
# ─────────────────────────────────────────────────────────────
def bootstrap_admin():
    if not FIREBASE_READY or not ADMIN_PASSWORD_HASH: return
    if not ADMIN_PASSWORD_HASH.startswith("$2b$"): return
    ref = db.collection("users").document(ADMIN_ID)
    if ref.get().exists: return
    ref.set({"id": ADMIN_ID, "passHash": ADMIN_PASSWORD_HASH, "role": "admin",
              "name": ADMIN_NAME, "dept": "Administration",
              "createdAt": now_iso(), "createdBy": "system"})
    print(f"✅ Admin {ADMIN_ID} bootstrapped")

bootstrap_admin()


# ─────────────────────────────────────────────────────────────
# AUTH HELPERS
# ─────────────────────────────────────────────────────────────
def get_user(uid):
    if not FIREBASE_READY or not uid: return None
    doc = db.collection("users").document(uid).get()
    return doc.to_dict() if doc.exists else None

def require_role(*roles):
    uid = request.headers.get("X-User-Id", "").strip()
    if not uid: return None
    u = get_user(uid)
    return u if u and u.get("role") in roles else None


# ─────────────────────────────────────────────────────────────
# PUSH NOTIFICATION HELPER
# ─────────────────────────────────────────────────────────────
def send_push(subscription_info: dict, title: str, body: str, data: dict = None):
    """Send a Web Push notification to a single subscription."""
    if not WEBPUSH_AVAILABLE or not subscription_info:
        return
    try:
        payload = json.dumps({"title": title, "body": body, "data": data or {}})
        webpush(
            subscription_info=subscription_info,
            data=payload,
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims={"sub": VAPID_EMAIL}
        )
    except WebPushException as e:
        debug_log("Push failed:", e)
    except Exception as e:
        debug_log("Push error:", e)

def notify_user(user_id: str, title: str, body: str, data: dict = None):
    """Look up user's push subscription and send them a notification."""
    if not FIREBASE_READY: return
    try:
        sub_doc = db.collection("push_subscriptions").document(user_id).get()
        if sub_doc.exists:
            send_push(sub_doc.to_dict().get("subscription"), title, body, data)
    except Exception as e:
        debug_log("notify_user error:", e)

def notify_classroom(classroom_id: str, title: str, body: str, data: dict = None, exclude_id: str = None):
    """Notify all students in a classroom."""
    if not FIREBASE_READY: return
    try:
        doc = db.collection("classrooms").document(classroom_id).get()
        if not doc.exists: return
        for sid in doc.to_dict().get("studentIds", []):
            if sid != exclude_id:
                notify_user(sid, title, body, data)
    except Exception as e:
        debug_log("notify_classroom error:", e)


# ─────────────────────────────────────────────────────────────
# PUSH SUBSCRIPTION SAVE
# ─────────────────────────────────────────────────────────────
@app.route("/api/push/subscribe", methods=["POST"])
def push_subscribe():
    uid = request.headers.get("X-User-Id", "").strip()
    if not uid or not FIREBASE_READY:
        return err("Unauthorized", 403)
    data = request.get_json(silent=True) or {}
    sub  = data.get("subscription")
    if not sub:
        return err("subscription is required", 400)
    db.collection("push_subscriptions").document(uid).set({"subscription": sub, "updatedAt": now_iso()})
    return ok({"message": "Subscription saved"})


# ─────────────────────────────────────────────────────────────
# FIRST-RUN SETUP
# ─────────────────────────────────────────────────────────────
@app.route("/api/admin/setup", methods=["POST"])
def admin_setup():
    if not FIREBASE_READY: return err("Firebase not connected", 503)
    data     = request.get_json(silent=True) or {}
    admin_id = data.get("adminId", "").strip() or ADMIN_ID
    password = data.get("password", "").strip()
    if not password:        return err("password is required")
    if len(password) < 10:  return err("Password must be at least 10 characters")
    ref = db.collection("users").document(admin_id)
    if ref.get().exists:    return err("Admin already exists. Setup is closed.", 403)
    ref.set({"id": admin_id, "passHash": hash_password(password), "role": "admin",
              "name": ADMIN_NAME, "dept": "Administration",
              "createdAt": now_iso(), "createdBy": "setup"})
    return ok({"message": f"Admin {admin_id} created. Please log in."})


# ─────────────────────────────────────────────────────────────
# AUTH — LOGIN
# ─────────────────────────────────────────────────────────────
@app.route("/api/login", methods=["POST"])
def login():
    if not FIREBASE_READY: return err("Firebase not connected", 503)
    data     = request.get_json(silent=True) or {}
    user_id  = data.get("userId", "").strip()
    password = data.get("password", "")
    if not user_id or not password: return err("userId and password required")
    user = get_user(user_id)
    stored = user.get("passHash", "") if user else ""
    if not user or not check_password(password, stored):
        return err("Invalid credentials", 401, "INVALID_CREDENTIALS")
    return ok({"user": safe_user(user)})


# ─────────────────────────────────────────────────────────────
# ADMIN — Create User (student or professor only)
# ─────────────────────────────────────────────────────────────
@app.route("/api/admin/create-user", methods=["POST"])
def create_user():
    caller = require_role("admin")
    if not caller: return err("Unauthorized", 403)
    data = request.get_json(silent=True) or {}
    name = data.get("name", "").strip()
    role = data.get("role", "student")
    dept = data.get("dept", "").strip()
    if not name or not dept: return err("name and dept are required")
    if role not in ("student", "professor"):
        return err("role must be student or professor", 400)
    prefix = {"professor": "PROF", "student": "STU"}
    for _ in range(5):
        new_id = prefix[role] + str(random.randint(1000, 9999))
        if not db.collection("users").document(new_id).get().exists:
            break
    plain = generate_password()
    db.collection("users").document(new_id).set({
        "id": new_id, "passHash": hash_password(plain), "role": role,
        "name": name, "dept": dept, "createdAt": now_iso(), "createdBy": caller["id"]
    })
    return ok({"credentials": {"id": new_id, "password": plain, "role": role, "name": name, "dept": dept}})


# ─────────────────────────────────────────────────────────────
# ADMIN — All Users
# ─────────────────────────────────────────────────────────────
@app.route("/api/admin/users", methods=["GET"])
def get_all_users():
    caller = require_role("admin")
    if not caller: return err("Unauthorized", 403)
    docs  = db.collection("users").where("role", "in", ["student", "professor"]).stream()
    users = [safe_user(d.to_dict()) for d in docs]
    return ok({"users": users})


# ─────────────────────────────────────────────────────────────
# ADMIN — Change Password
# ─────────────────────────────────────────────────────────────
@app.route("/api/admin/change-password", methods=["POST"])
def change_password():
    caller = require_role("admin")
    if not caller: return err("Unauthorized", 403)
    data = request.get_json(silent=True) or {}
    cur  = data.get("currentPassword", "")
    new  = data.get("newPassword", "")
    if not cur or not new:    return err("Both passwords required")
    if len(new) < 10:         return err("Min 10 characters")
    if cur == new:            return err("New password must differ")
    if not check_password(cur, caller.get("passHash", "")): return err("Current password incorrect", 401)
    db.collection("users").document(caller["id"]).update({"passHash": hash_password(new)})
    return ok({"message": "Password updated"})


# ─────────────────────────────────────────────────────────────
# CLASSROOM — Create (professor only)
# ─────────────────────────────────────────────────────────────
@app.route("/api/classroom/create", methods=["POST"])
def create_classroom():
    caller = require_role("professor")
    if not caller: return err("Unauthorized", 403)
    data       = request.get_json(silent=True) or {}
    name       = data.get("name", "").strip()
    desc       = data.get("description", "").strip()
    student_ids = data.get("studentIds", [])
    if not name:              return err("Classroom name required")
    if not student_ids:       return err("Select at least one student")

    # Validate all students exist
    for sid in student_ids:
        u = get_user(sid)
        if not u or u.get("role") != "student":
            return err(f"Student {sid} not found", 400)

    cid = "CLS" + str(int(datetime.datetime.utcnow().timestamp() * 1000))
    db.collection("classrooms").document(cid).set({
        "id": cid, "name": name, "description": desc,
        "professorId": caller["id"], "professorName": caller.get("name"),
        "studentIds": student_ids, "createdAt": now_iso()
    })

    # Notify each student
    for sid in student_ids:
        notify_user(sid, "Added to Classroom 🎓",
                    f"You've been added to '{name}' by {caller.get('name')}",
                    {"classroomId": cid})

    return ok({"classroomId": cid})


# ─────────────────────────────────────────────────────────────
# CLASSROOM — My classrooms (professor)
# ─────────────────────────────────────────────────────────────
@app.route("/api/classroom/mine", methods=["GET"])
def my_classrooms_prof():
    caller = require_role("professor")
    if not caller: return err("Unauthorized", 403)
    docs = db.collection("classrooms").where("professorId", "==", caller["id"]).stream()
    cls  = [d.to_dict() for d in docs]
    return ok({"classrooms": sorted(cls, key=lambda x: x.get("createdAt", ""), reverse=True)})


# ─────────────────────────────────────────────────────────────
# CLASSROOM — Student's classrooms
# ─────────────────────────────────────────────────────────────
@app.route("/api/classroom/student", methods=["GET"])
def my_classrooms_student():
    caller = require_role("student")
    if not caller: return err("Unauthorized", 403)
    docs = db.collection("classrooms").where("studentIds", "array_contains", caller["id"]).stream()
    cls  = [d.to_dict() for d in docs]
    return ok({"classrooms": sorted(cls, key=lambda x: x.get("createdAt", ""), reverse=True)})


# ─────────────────────────────────────────────────────────────
# CLASSROOM — Get single classroom detail
# ─────────────────────────────────────────────────────────────
@app.route("/api/classroom/<cid>", methods=["GET"])
def get_classroom(cid):
    uid = request.headers.get("X-User-Id", "").strip()
    u   = get_user(uid)
    if not u: return err("Unauthorized", 403)
    doc = db.collection("classrooms").document(cid).get()
    if not doc.exists: return err("Classroom not found", 404)
    cls = doc.to_dict()
    # Access check
    if u["role"] == "professor" and cls["professorId"] != uid:
        return err("Forbidden", 403)
    if u["role"] == "student" and uid not in cls.get("studentIds", []):
        return err("Forbidden", 403)
    return ok({"classroom": cls})


# ─────────────────────────────────────────────────────────────
# CLASSROOM — List all students (for professor to pick from)
# ─────────────────────────────────────────────────────────────
@app.route("/api/students", methods=["GET"])
def get_students():
    caller = require_role("professor", "admin")
    if not caller: return err("Unauthorized", 403)
    docs = db.collection("users").where("role", "==", "student").stream()
    students = [safe_user(d.to_dict()) for d in docs]
    return ok({"students": sorted(students, key=lambda x: x.get("name", ""))})


# ─────────────────────────────────────────────────────────────
# PROJECT SUBMISSION — Submit Drive link (student)
# ─────────────────────────────────────────────────────────────
@app.route("/api/submission/submit", methods=["POST"])
def submit_project():
    caller = require_role("student")
    if not caller: return err("Unauthorized", 403)
    data         = request.get_json(silent=True) or {}
    classroom_id = data.get("classroomId", "").strip()
    drive_link   = data.get("driveLink", "").strip()
    title        = data.get("title", "").strip()
    description  = data.get("description", "").strip()

    if not classroom_id: return err("classroomId required")
    if not drive_link:   return err("driveLink required")
    if not title:        return err("title required")
    if not drive_link.startswith(("https://drive.google.com", "https://docs.google.com")):
        return err("Please provide a valid Google Drive or Google Docs link")

    # Verify student is in this classroom
    cls_doc = db.collection("classrooms").document(classroom_id).get()
    if not cls_doc.exists: return err("Classroom not found", 404)
    cls = cls_doc.to_dict()
    if caller["id"] not in cls.get("studentIds", []):
        return err("You are not in this classroom", 403)

    sub_id = "SUB" + str(int(datetime.datetime.utcnow().timestamp() * 1000))
    db.collection("submissions").document(sub_id).set({
        "id": sub_id,
        "classroomId": classroom_id,
        "classroomName": cls.get("name"),
        "professorId": cls.get("professorId"),
        "professorName": cls.get("professorName"),
        "studentId": caller["id"],
        "studentName": caller.get("name"),
        "studentDept": caller.get("dept"),
        "title": title,
        "description": description,
        "driveLink": drive_link,
        "status": "submitted",
        "grade": None,
        "feedback": None,
        "submittedAt": now_iso(),
        "gradedAt": None,
    })

    # Notify professor
    notify_user(cls["professorId"], "New Project Submission 📁",
                f"{caller.get('name')} submitted '{title}' in {cls.get('name')}",
                {"submissionId": sub_id, "classroomId": classroom_id})

    return ok({"submissionId": sub_id})


# ─────────────────────────────────────────────────────────────
# PROJECT SUBMISSION — Grade/Feedback (professor)
# ─────────────────────────────────────────────────────────────
@app.route("/api/submission/<sub_id>/grade", methods=["POST"])
def grade_submission(sub_id):
    caller = require_role("professor")
    if not caller: return err("Unauthorized", 403)
    data     = request.get_json(silent=True) or {}
    grade    = data.get("grade", "").strip()
    feedback = data.get("feedback", "").strip()
    if not grade: return err("grade is required")

    doc = db.collection("submissions").document(sub_id).get()
    if not doc.exists: return err("Submission not found", 404)
    sub = doc.to_dict()
    if sub.get("professorId") != caller["id"]:
        return err("Forbidden — not your classroom", 403)

    db.collection("submissions").document(sub_id).update({
        "grade": grade, "feedback": feedback,
        "status": "graded", "gradedAt": now_iso(),
        "gradedBy": caller["id"], "gradedByName": caller.get("name")
    })

    # Notify student
    notify_user(sub["studentId"], "Project Graded ✅",
                f"Your project '{sub.get('title')}' received grade: {grade}",
                {"submissionId": sub_id})

    return ok({"message": "Graded"})


# ─────────────────────────────────────────────────────────────
# PROJECT SUBMISSION — List for professor (by classroom)
# ─────────────────────────────────────────────────────────────
@app.route("/api/classroom/<cid>/submissions", methods=["GET"])
def classroom_submissions(cid):
    caller = require_role("professor")
    if not caller: return err("Unauthorized", 403)
    # Verify ownership
    cls_doc = db.collection("classrooms").document(cid).get()
    if not cls_doc.exists: return err("Classroom not found", 404)
    if cls_doc.to_dict().get("professorId") != caller["id"]:
        return err("Forbidden", 403)
    docs = db.collection("submissions").where("classroomId", "==", cid).stream()
    subs = [d.to_dict() for d in docs]
    return ok({"submissions": sorted(subs, key=lambda x: x.get("submittedAt", ""), reverse=True)})


# ─────────────────────────────────────────────────────────────
# PROJECT SUBMISSION — Student's own submissions
# ─────────────────────────────────────────────────────────────
@app.route("/api/submission/mine", methods=["GET"])
def my_submissions():
    caller = require_role("student")
    if not caller: return err("Unauthorized", 403)
    docs = db.collection("submissions").where("studentId", "==", caller["id"]).stream()
    subs = [d.to_dict() for d in docs]
    return ok({"submissions": sorted(subs, key=lambda x: x.get("submittedAt", ""), reverse=True)})


# ─────────────────────────────────────────────────────────────
# HEALTH CHECK
# ─────────────────────────────────────────────────────────────
@app.route("/api/health", methods=["GET"])
def health():
    admin_exists = False
    needs_setup  = True
    if FIREBASE_READY:
        try:
            admin_exists = db.collection("users").document(ADMIN_ID).get().exists
            needs_setup  = not admin_exists
        except: pass
    return ok({"status": "ok", "firebase": FIREBASE_READY,
                "needsSetup": needs_setup, "timestamp": now_iso()})


# ─────────────────────────────────────────────────────────────
# ENTRY POINT
# ─────────────────────────────────────────────────────────────
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"🚀 Project System — http://0.0.0.0:{port}")
    print(f"   Firebase : {'✅' if FIREBASE_READY else '❌'}")
    app.run(host="0.0.0.0", debug=DEBUG_MODE, port=port)
