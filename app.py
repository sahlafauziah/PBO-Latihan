"""
app.py
------
Entry point aplikasi web Flask untuk sistem
"Pengingat Produktivitas dan Pengontrol Screen Time" — versi mobile.

App ini memakai class-class OOP dari folder models/ (User, ScreenTimeTracker,
ReminderManager, TaskManager) sebagai inti logika bisnis. Flask di sini hanya
berperan sebagai "jembatan" antara tampilan web (HTML/JS) dan logika OOP.

Untuk kebutuhan demo/tugas kuliah, data disimpan di memori (dict Python)
selama server berjalan -- cukup untuk satu user demo, tanpa perlu database.
"""

from flask import Flask, render_template, request, jsonify
from models import User, ScreenTimeTracker, ReminderManager, TaskManager, build_daily_report

app = Flask(__name__)

# ------------------------------------------------------------------
# "Database" sederhana di memori untuk satu user demo.
# ------------------------------------------------------------------
demo_user = User(user_id=1, username="Mahasiswa", email="mahasiswa@kampus.ac.id")
screen_tracker = ScreenTimeTracker(owner_id=demo_user.user_id, daily_limit_minutes=180)
reminder_manager = ReminderManager(owner_id=demo_user.user_id)
task_manager = TaskManager(owner_id=demo_user.user_id)


# =========================== HALAMAN ===========================

@app.route("/")
def index():
    return render_template("index.html", user=demo_user.to_dict())


# =========================== API: USER ===========================

@app.route("/api/user", methods=["GET"])
def get_user():
    return jsonify(demo_user.to_dict())


# ===================== API: SCREEN TIME TRACKER =====================

@app.route("/api/screentime", methods=["GET"])
def get_screentime():
    return jsonify(screen_tracker.get_summary())


@app.route("/api/screentime/limit", methods=["PUT"])
def set_screentime_limit():
    data = request.get_json(force=True)
    try:
        screen_tracker.set_daily_limit(int(data.get("limit_minutes")))
        return jsonify({"success": True, "summary": screen_tracker.get_summary()})
    except (ValueError, TypeError) as e:
        return jsonify({"success": False, "error": str(e)}), 400


@app.route("/api/screentime/log", methods=["POST"])
def log_screentime():
    data = request.get_json(force=True)
    try:
        minutes = int(data.get("minutes", 0))
        result = screen_tracker.log_usage(minutes)
        return jsonify({"success": True, "result": result, "summary": screen_tracker.get_summary()})
    except (ValueError, TypeError) as e:
        return jsonify({"success": False, "error": str(e)}), 400


# ===================== API: REMINDER MANAGER =====================

@app.route("/api/reminders", methods=["GET"])
def get_reminders():
    return jsonify(reminder_manager.get_summary())


@app.route("/api/reminders/active-hours", methods=["PUT"])
def set_active_hours():
    data = request.get_json(force=True)
    try:
        reminder_manager.set_active_hours(data.get("start"), data.get("end"))
        return jsonify({"success": True, "summary": reminder_manager.get_summary()})
    except (ValueError, TypeError) as e:
        return jsonify({"success": False, "error": str(e)}), 400


@app.route("/api/reminders", methods=["POST"])
def add_reminder():
    data = request.get_json(force=True)
    try:
        reminder = reminder_manager.add_reminder(
            title=data.get("title", ""),
            time_str=data.get("time", ""),
            repeat=data.get("repeat", "sekali"),
        )
        return jsonify({"success": True, "reminder": reminder})
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 400


@app.route("/api/reminders/<int:reminder_id>/complete", methods=["PUT"])
def complete_reminder(reminder_id):
    ok = reminder_manager.complete_reminder(reminder_id)
    return jsonify({"success": ok})


@app.route("/api/reminders/<int:reminder_id>", methods=["DELETE"])
def delete_reminder(reminder_id):
    ok = reminder_manager.delete_reminder(reminder_id)
    return jsonify({"success": ok})


# ===================== API: TASK MANAGER =====================

@app.route("/api/tasks", methods=["GET"])
def get_tasks():
    return jsonify(task_manager.get_summary())


@app.route("/api/tasks", methods=["POST"])
def add_task():
    data = request.get_json(force=True)
    try:
        task = task_manager.add_task(
            title=data.get("title", ""),
            deadline=data.get("deadline"),
            priority=data.get("priority", "sedang"),
        )
        return jsonify({"success": True, "task": task})
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 400


@app.route("/api/tasks/<int:task_id>/complete", methods=["PUT"])
def complete_task(task_id):
    ok = task_manager.complete_task(task_id)
    return jsonify({"success": ok})


@app.route("/api/tasks/<int:task_id>", methods=["DELETE"])
def delete_task(task_id):
    ok = task_manager.delete_task(task_id)
    return jsonify({"success": ok})


# ===================== API: DAILY PRODUCTIVITY REPORT =====================

@app.route("/api/report", methods=["GET"])
def get_daily_report():
    """
    Menggabungkan get_summary() dari ScreenTimeTracker, ReminderManager,
    dan TaskManager (polymorphism) menjadi satu laporan harian.
    """
    report = build_daily_report(screen_tracker, reminder_manager, task_manager)
    return jsonify(report)


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
