
from flask import Flask, render_template, abort, jsonify, request, redirect, url_for, session, Response
from pathlib import Path
from datetime import datetime, timezone
import json, sqlite3, csv, io, os, secrets
from werkzeug.security import generate_password_hash, check_password_hash

BASE = Path(__file__).resolve().parent
DB = BASE / "data" / "rich_tutor.db"
DATA = BASE / "lessons" / "lessons.json"

app = Flask(__name__)
app.secret_key = os.environ.get("RICH_TUTOR_SECRET", "dev-change-me-rich-tutor")

def db():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    DB.parent.mkdir(exist_ok=True)
    conn = db()
    conn.executescript("""
    CREATE TABLE IF NOT EXISTS users(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin','parent','student')),
      display_name TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS parent_students(
      parent_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      UNIQUE(parent_id, student_id)
    );

    CREATE TABLE IF NOT EXISTS sessions(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      lesson_id INTEGER,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      seconds INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS grades(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      lesson_id INTEGER NOT NULL,
      score REAL NOT NULL,
      source TEXT NOT NULL DEFAULT 'practice',
      attempts INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS mastery(
      student_id INTEGER NOT NULL,
      lesson_id INTEGER NOT NULL,
      score REAL NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      PRIMARY KEY(student_id, lesson_id)
    );

    CREATE TABLE IF NOT EXISTS invitations(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('parent','student')),
      parent_id INTEGER,
      created_by INTEGER NOT NULL,
      expires_at TEXT,
      used_at TEXT,
      used_by INTEGER,
      created_at TEXT NOT NULL
    );
    """)
    row = conn.execute("SELECT id FROM users WHERE username='admin'").fetchone()
    if not row:
        conn.execute(
            "INSERT INTO users(username,password_hash,role,display_name,created_at) VALUES(?,?,?,?,?)",
            (os.environ.get("ADMIN_USERNAME","admin"), generate_password_hash(os.environ.get("ADMIN_PASSWORD","admin")), "admin", "Administrator", datetime.now(timezone.utc).isoformat())
        )
    conn.commit()
    conn.close()

def load_lessons():
    with open(DATA, "r", encoding="utf-8") as f:
        return json.load(f)

def current_user():
    uid = session.get("user_id")
    if not uid:
        return None
    conn = db()
    row = conn.execute("SELECT * FROM users WHERE id=? AND active=1", (uid,)).fetchone()
    conn.close()
    return row

def require_role(*roles):
    u = current_user()
    if not u or u["role"] not in roles:
        return None
    return u

def slugify_category(name):
    return name.lower().replace("&","and").replace("/","-").replace(" ","-")

@app.before_request
def _startup():
    init_db()

@app.context_processor
def inject_user():
    return {"auth_user": current_user()}

@app.route("/login", methods=["GET","POST"])
def login():
    if request.method == "POST":
        username = request.form.get("username","").strip()
        password = request.form.get("password","")
        conn = db()
        u = conn.execute("SELECT * FROM users WHERE username=? AND active=1",(username,)).fetchone()
        conn.close()
        if u and check_password_hash(u["password_hash"], password):
            session["user_id"] = u["id"]
            if u["role"] == "admin":
                return redirect("/admin")
            if u["role"] == "parent":
                return redirect("/parent")
            return redirect("/")
        return render_template("login.html", error="Invalid username or password.")
    return render_template("login.html")

@app.route("/logout")
def logout():
    session.clear()
    return redirect("/")

@app.route("/")
def home():
    lessons = load_lessons()
    categories = {}
    for lesson in lessons:
        categories.setdefault(lesson["category"], []).append(lesson)
    return render_template("index.html", categories=categories, lessons=lessons)

@app.route("/subject/<category_slug>")
def subject(category_slug):
    lessons = load_lessons()
    matches = [x for x in lessons if slugify_category(x["category"]) == category_slug]
    if not matches:
        abort(404)
    return render_template("subject.html", category=matches[0]["category"], lessons=matches)

@app.route("/lesson/<slug>")
def lesson(slug):
    lessons = load_lessons()
    item = next((x for x in lessons if x["slug"] == slug), None)
    if not item:
        abort(404)
    same = [x for x in lessons if x["category"] == item["category"]]
    idx = next(i for i,x in enumerate(same) if x["id"] == item["id"])
    video_rel = item.get("video")
    video_exists = bool(video_rel and (BASE/"static"/video_rel).is_file())
    return render_template(
        "lesson.html",
        lesson=item,
        lessons=lessons,
        prev_lesson=same[idx-1] if idx>0 else None,
        next_lesson=same[idx+1] if idx<len(same)-1 else None,
        video_exists=video_exists,
        animation_json=json.dumps(item.get("animation",{})),
        lesson_json=json.dumps(item),
    )

@app.route("/search")
def search_page():
    q = request.args.get("q","").strip()
    lessons = load_lessons()
    if not q:
        results = lessons
    else:
        n=q.lower()
        results=[]
        for x in lessons:
            hay=" ".join([
                x.get("title",""),x.get("category",""),x.get("summary",""),
                x.get("shortcut",""),x.get("problem","")," ".join(x.get("tags",[]))
            ]).lower()
            if n in hay: results.append(x)
    return render_template("search.html", q=q, results=results)

@app.route("/reference")
def reference():
    by={}
    for x in load_lessons():
        by.setdefault(x["category"],[]).append(x)
    return render_template("reference.html", by_category=by)

@app.route("/curriculum")
def curriculum():
    return render_template("curriculum.html", lessons=load_lessons())

@app.route("/roadmap")
def roadmap():
    return render_template("roadmap.html")

# ---------------- ADMIN ----------------
@app.route("/admin")
def admin_dashboard():
    u=require_role("admin")
    if not u: return redirect("/login")
    conn=db()
    students=conn.execute("SELECT * FROM users WHERE role='student' ORDER BY display_name").fetchall()
    parents=conn.execute("SELECT * FROM users WHERE role='parent' ORDER BY display_name").fetchall()
    stats=conn.execute("""
      SELECT s.id,s.display_name,
        COALESCE(SUM(se.seconds),0) seconds,
        COALESCE(AVG(g.score),0) avg_grade,
        COUNT(g.id) grade_count
      FROM users s
      LEFT JOIN sessions se ON se.student_id=s.id
      LEFT JOIN grades g ON g.student_id=s.id
      WHERE s.role='student'
      GROUP BY s.id
      ORDER BY s.display_name
    """).fetchall()
    conn.close()
    return render_template("admin.html", students=students, parents=parents, stats=stats)

@app.route("/admin/users/create", methods=["POST"])
def admin_create_user():
    u=require_role("admin")
    if not u: return redirect("/login")
    role=request.form.get("role","student")
    username=request.form.get("username","").strip()
    display=request.form.get("display_name","").strip() or username
    password=request.form.get("password","").strip() or "student"
    if role not in ("student","parent"): role="student"
    conn=db()
    try:
        cur=conn.execute(
          "INSERT INTO users(username,password_hash,role,display_name,created_at) VALUES(?,?,?,?,?)",
          (username,generate_password_hash(password),role,display,datetime.now(timezone.utc).isoformat())
        )
        new_id=cur.lastrowid
        if role=="student":
            parent_id=request.form.get("parent_id")
            if parent_id:
                conn.execute("INSERT OR IGNORE INTO parent_students(parent_id,student_id) VALUES(?,?)",(parent_id,new_id))
        conn.commit()
    finally:
        conn.close()
    return redirect("/admin")

@app.route("/admin/link", methods=["POST"])
def admin_link():
    u=require_role("admin")
    if not u: return redirect("/login")
    conn=db()
    conn.execute("INSERT OR IGNORE INTO parent_students(parent_id,student_id) VALUES(?,?)",
                 (request.form["parent_id"],request.form["student_id"]))
    conn.commit(); conn.close()
    return redirect("/admin")

@app.route("/admin/student/<int:sid>")
def admin_student(sid):
    u=require_role("admin")
    if not u: return redirect("/login")
    lessons={x["id"]:x for x in load_lessons()}
    conn=db()
    student=conn.execute("SELECT * FROM users WHERE id=? AND role='student'",(sid,)).fetchone()
    if not student: abort(404)
    grades=conn.execute("SELECT * FROM grades WHERE student_id=? ORDER BY created_at DESC",(sid,)).fetchall()
    sessions_=conn.execute("SELECT * FROM sessions WHERE student_id=? ORDER BY started_at DESC",(sid,)).fetchall()
    mastery=conn.execute("SELECT * FROM mastery WHERE student_id=? ORDER BY score DESC",(sid,)).fetchall()
    conn.close()
    return render_template("student_report.html", student=student, grades=grades, sessions=sessions_, mastery=mastery, lessons=lessons, portal="admin")

# ---------------- PARENT ----------------
@app.route("/parent")
def parent_portal():
    u=require_role("parent")
    if not u: return redirect("/login")
    conn=db()
    students=conn.execute("""
      SELECT s.* FROM users s
      JOIN parent_students ps ON ps.student_id=s.id
      WHERE ps.parent_id=? ORDER BY s.display_name
    """,(u["id"],)).fetchall()
    reports=[]
    for s in students:
        secs=conn.execute("SELECT COALESCE(SUM(seconds),0) x FROM sessions WHERE student_id=?",(s["id"],)).fetchone()["x"]
        avg=conn.execute("SELECT COALESCE(AVG(score),0) x FROM grades WHERE student_id=?",(s["id"],)).fetchone()["x"]
        reports.append((s,secs,avg))
    conn.close()
    return render_template("parent.html", reports=reports)

@app.route("/parent/student/<int:sid>")
def parent_student(sid):
    u=require_role("parent")
    if not u: return redirect("/login")
    conn=db()
    allowed=conn.execute("SELECT 1 FROM parent_students WHERE parent_id=? AND student_id=?",(u["id"],sid)).fetchone()
    if not allowed:
        conn.close(); abort(403)
    student=conn.execute("SELECT * FROM users WHERE id=?",(sid,)).fetchone()
    grades=conn.execute("SELECT * FROM grades WHERE student_id=? ORDER BY created_at DESC",(sid,)).fetchall()
    sessions_=conn.execute("SELECT * FROM sessions WHERE student_id=? ORDER BY started_at DESC",(sid,)).fetchall()
    mastery=conn.execute("SELECT * FROM mastery WHERE student_id=? ORDER BY score DESC",(sid,)).fetchall()
    conn.close()
    lessons={x["id"]:x for x in load_lessons()}
    return render_template("student_report.html", student=student, grades=grades, sessions=sessions_, mastery=mastery, lessons=lessons, portal="parent")


# ---------------- INVITATIONS ----------------
@app.route("/admin/invites")
def admin_invites():
    u=require_role("admin")
    if not u: return redirect("/login")
    conn=db()
    invites=conn.execute("""
      SELECT i.*, p.display_name parent_name, u.display_name used_name
      FROM invitations i
      LEFT JOIN users p ON p.id=i.parent_id
      LEFT JOIN users u ON u.id=i.used_by
      ORDER BY i.created_at DESC
    """).fetchall()
    parents=conn.execute("SELECT * FROM users WHERE role='parent' AND active=1 ORDER BY display_name").fetchall()
    conn.close()
    return render_template("invites.html", invites=invites, parents=parents)

@app.route("/admin/invites/create", methods=["POST"])
def admin_invite_create():
    u=require_role("admin")
    if not u: return redirect("/login")
    role=request.form.get("role","student")
    if role not in ("student","parent"): role="student"
    parent_id=request.form.get("parent_id") or None
    days=max(1,min(365,int(request.form.get("days","7") or 7)))
    token=secrets.token_urlsafe(24)
    now=datetime.now(timezone.utc)
    from datetime import timedelta
    expires=(now+timedelta(days=days)).isoformat()
    conn=db()
    conn.execute("""
      INSERT INTO invitations(token,role,parent_id,created_by,expires_at,created_at)
      VALUES(?,?,?,?,?,?)
    """,(token,role,parent_id if role=="student" else None,u["id"],expires,now.isoformat()))
    conn.commit(); conn.close()
    return redirect("/admin/invites")

@app.route("/invite/<token>", methods=["GET","POST"])
def accept_invite(token):
    conn=db()
    inv=conn.execute("SELECT * FROM invitations WHERE token=?",(token,)).fetchone()
    if not inv:
        conn.close(); abort(404)
    now=datetime.now(timezone.utc)
    expired=bool(inv["expires_at"] and datetime.fromisoformat(inv["expires_at"]) < now)
    unavailable=bool(inv["used_at"] or expired)
    if request.method=="POST" and not unavailable:
        username=request.form.get("username","").strip()
        display=request.form.get("display_name","").strip() or username
        password=request.form.get("password","")
        if len(username)<2 or len(password)<4:
            conn.close()
            return render_template("invite_accept.html", invite=inv, unavailable=False, error="Use a username of at least 2 characters and a password of at least 4 characters.")
        try:
            cur=conn.execute("""
              INSERT INTO users(username,password_hash,role,display_name,created_at)
              VALUES(?,?,?,?,?)
            """,(username,generate_password_hash(password),inv["role"],display,now.isoformat()))
            uid=cur.lastrowid
            if inv["role"]=="student" and inv["parent_id"]:
                conn.execute("INSERT OR IGNORE INTO parent_students(parent_id,student_id) VALUES(?,?)",(inv["parent_id"],uid))
            conn.execute("UPDATE invitations SET used_at=?,used_by=? WHERE id=?",(now.isoformat(),uid,inv["id"]))
            conn.commit()
        except sqlite3.IntegrityError:
            conn.close()
            return render_template("invite_accept.html", invite=inv, unavailable=False, error="That username is already in use.")
        conn.close()
        return render_template("invite_accept.html", invite=inv, success=True, username=username)
    conn.close()
    return render_template("invite_accept.html", invite=inv, unavailable=unavailable, expired=expired)


# ---------------- TRACKING API ----------------
@app.route("/api/session/start", methods=["POST"])
def api_session_start():
    u=require_role("student")
    if not u: return jsonify({"ok":False}),401
    body=request.get_json(force=True)
    conn=db()
    cur=conn.execute(
      "INSERT INTO sessions(student_id,lesson_id,started_at) VALUES(?,?,?)",
      (u["id"],body.get("lesson_id"),datetime.now(timezone.utc).isoformat())
    )
    conn.commit(); sid=cur.lastrowid; conn.close()
    return jsonify({"ok":True,"session_id":sid})

@app.route("/api/session/end", methods=["POST"])
def api_session_end():
    u=require_role("student")
    if not u: return jsonify({"ok":False}),401
    body=request.get_json(force=True)
    sid=body.get("session_id"); seconds=max(0,int(body.get("seconds",0)))
    conn=db()
    conn.execute("UPDATE sessions SET ended_at=?,seconds=? WHERE id=? AND student_id=?",
                 (datetime.now(timezone.utc).isoformat(),seconds,sid,u["id"]))
    conn.commit(); conn.close()
    return jsonify({"ok":True})

@app.route("/api/grade", methods=["POST"])
def api_grade():
    u=require_role("student")
    if not u: return jsonify({"ok":False}),401
    b=request.get_json(force=True)
    lesson_id=int(b["lesson_id"]); score=float(b["score"])
    source=b.get("source","practice"); attempts=int(b.get("attempts",1))
    now=datetime.now(timezone.utc).isoformat()
    conn=db()
    conn.execute("INSERT INTO grades(student_id,lesson_id,score,source,attempts,created_at) VALUES(?,?,?,?,?,?)",
                 (u["id"],lesson_id,score,source,attempts,now))
    old=conn.execute("SELECT score FROM mastery WHERE student_id=? AND lesson_id=?",(u["id"],lesson_id)).fetchone()
    mastery=max(float(old["score"]) if old else 0, score)
    conn.execute("""
      INSERT INTO mastery(student_id,lesson_id,score,updated_at) VALUES(?,?,?,?)
      ON CONFLICT(student_id,lesson_id) DO UPDATE SET score=excluded.score,updated_at=excluded.updated_at
    """,(u["id"],lesson_id,mastery,now))
    conn.commit(); conn.close()
    return jsonify({"ok":True})

@app.route("/export/grades.csv")
def export_grades():
    u=current_user()
    if not u or u["role"] not in ("admin","parent"):
        return redirect("/login")
    conn=db()
    if u["role"]=="admin":
        rows=conn.execute("""
          SELECT s.display_name,s.username,g.lesson_id,g.score,g.source,g.attempts,g.created_at
          FROM grades g JOIN users s ON s.id=g.student_id ORDER BY s.display_name,g.created_at
        """).fetchall()
    else:
        rows=conn.execute("""
          SELECT s.display_name,s.username,g.lesson_id,g.score,g.source,g.attempts,g.created_at
          FROM grades g JOIN users s ON s.id=g.student_id
          JOIN parent_students ps ON ps.student_id=s.id
          WHERE ps.parent_id=? ORDER BY s.display_name,g.created_at
        """,(u["id"],)).fetchall()
    conn.close()
    out=io.StringIO(); w=csv.writer(out)
    w.writerow(["student","username","lesson_id","score","source","attempts","created_at"])
    for r in rows: w.writerow(list(r))
    return Response(out.getvalue(), mimetype="text/csv",
                    headers={"Content-Disposition":"attachment; filename=rich_tutor_grades.csv"})

@app.route("/api/lessons")
def api_lessons():
    return jsonify(load_lessons())

@app.route("/health")
def health():
    return {"status":"ok","app":"Rich Tutor"}

if __name__=="__main__":
    app.run(host="0.0.0.0",port=5055,debug=True)
