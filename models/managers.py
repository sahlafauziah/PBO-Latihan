"""
managers.py
-----------
Berisi tiga class utama sistem:
1. ScreenTimeTracker -> mengelola target & pencatatan screen time harian
2. ReminderManager    -> mengelola pengingat jadwal belajar/aktivitas
3. TaskManager        -> mengelola daftar tugas

Ketiganya adalah turunan (subclass) dari Manager (INHERITANCE) dan
masing-masing punya implementasi get_summary() sendiri (POLYMORPHISM).
Atribut internal masing-masing class juga disembunyikan dan hanya bisa
diakses lewat method yang sudah disediakan (ENCAPSULATION).
"""

from datetime import datetime, date
from .base import Manager


class ScreenTimeTracker(Manager):
    """
    Mengelola target screen time harian dan mencatat pemakaian aktual.

    ENCAPSULATION: _daily_limit_minutes dan _usage_log disembunyikan.
    Untuk menambah pemakaian harus lewat log_usage(), tidak bisa
    mengubah _usage_log langsung dari luar class.
    """

    def __init__(self, owner_id: int, daily_limit_minutes: int = 180):
        super().__init__(owner_id)  # INHERITANCE: pakai constructor parent
        self._daily_limit_minutes = daily_limit_minutes
        # _usage_log -> dict {tanggal_str: total_menit}
        self._usage_log = {}

    @property
    def daily_limit_minutes(self) -> int:
        return self._daily_limit_minutes

    def set_daily_limit(self, minutes: int) -> None:
        if minutes <= 0:
            raise ValueError("Limit screen time harus lebih dari 0 menit")
        self._daily_limit_minutes = minutes
        self._touch()

    def log_usage(self, minutes: int, on_date: str = None) -> dict:
        """Menambahkan catatan pemakaian smartphone (dalam menit)."""
        if minutes < 0:
            raise ValueError("Durasi pemakaian tidak boleh negatif")
        day_key = on_date or date.today().strftime("%Y-%m-%d")
        self._usage_log[day_key] = self._usage_log.get(day_key, 0) + minutes
        self._touch()
        return {
            "date": day_key,
            "total_minutes": self._usage_log[day_key],
            "over_limit": self._usage_log[day_key] > self._daily_limit_minutes,
        }

    def get_today_usage(self) -> int:
        today_key = date.today().strftime("%Y-%m-%d")
        return self._usage_log.get(today_key, 0)

    def is_over_limit(self) -> bool:
        return self.get_today_usage() > self._daily_limit_minutes

    def get_summary(self) -> dict:
        """
        POLYMORPHISM: implementasi get_summary() khusus untuk screen time.
        """
        today_usage = self.get_today_usage()
        remaining = max(self._daily_limit_minutes - today_usage, 0)
        return {
            "type": "screen_time",
            "daily_limit_minutes": self._daily_limit_minutes,
            "today_usage_minutes": today_usage,
            "remaining_minutes": remaining,
            "over_limit": self.is_over_limit(),
            "history": self._usage_log,
            "last_updated": self.last_updated,
        }


class ReminderManager(Manager):
    """
    Mengelola pengingat jadwal belajar / aktivitas produktif.

    ENCAPSULATION: daftar pengingat (_reminders) hanya bisa diubah lewat
    add_reminder(), complete_reminder(), atau delete_reminder(). Jam aktif
    (_active_start / _active_end) juga hanya bisa diubah lewat
    set_active_hours() yang sudah memvalidasi format & urutan jamnya.
    """

    def __init__(self, owner_id: int, active_start: str = "06:00", active_end: str = "22:00"):
        super().__init__(owner_id)
        self._reminders = []  # list of dict
        self._next_id = 1
        self._active_start = active_start
        self._active_end = active_end

    def set_active_hours(self, start: str, end: str) -> None:
        """Mengatur jam aktif harian, dipakai untuk menghitung waktu kosong."""
        if start >= end:
            raise ValueError("Jam mulai harus lebih awal dari jam selesai")
        self._active_start = start
        self._active_end = end
        self._touch()

    @property
    def active_hours(self) -> dict:
        return {"start": self._active_start, "end": self._active_end}

    def add_reminder(self, title: str, time_str: str, repeat: str = "sekali") -> dict:
        if not title.strip():
            raise ValueError("Judul pengingat tidak boleh kosong")
        reminder = {
            "id": self._next_id,
            "title": title.strip(),
            "time": time_str,
            "repeat": repeat,
            "is_done": False,
            "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        }
        self._reminders.append(reminder)
        self._next_id += 1
        self._touch()
        return reminder

    def complete_reminder(self, reminder_id: int) -> bool:
        for r in self._reminders:
            if r["id"] == reminder_id:
                r["is_done"] = True
                self._touch()
                return True
        return False

    def delete_reminder(self, reminder_id: int) -> bool:
        before = len(self._reminders)
        self._reminders = [r for r in self._reminders if r["id"] != reminder_id]
        self._touch()
        return len(self._reminders) < before

    def get_active_reminders(self) -> list:
        return [r for r in self._reminders if not r["is_done"]]

    def find_free_slots(self, block_minutes: int = 120) -> list:
        """
        Menghitung slot waktu kosong dalam jam aktif, dengan cara membagi
        jam aktif menjadi blok-blok (default 2 jam = 120 menit), lalu
        membuang blok yang waktunya beririsan dengan reminder yang sudah
        ada (yang belum selesai).

        Dipakai untuk fitur "notifikasi waktu kosong untuk belajar":
        sistem mengusulkan waktu yang belum terisi jadwal apa pun.
        """
        def to_minutes(hhmm: str) -> int:
            h, m = hhmm.split(":")
            return int(h) * 60 + int(m)

        def to_hhmm(total_minutes: int) -> str:
            h = (total_minutes // 60) % 24
            m = total_minutes % 60
            return f"{h:02d}:{m:02d}"

        start = to_minutes(self._active_start)
        end = to_minutes(self._active_end)

        # Kumpulkan jam-jam yang sudah "terisi" oleh reminder aktif.
        # Setiap reminder dianggap menempati 1 blok (block_minutes) mulai
        # dari jam reminder tersebut, sebagai perkiraan sederhana.
        occupied = []
        for r in self.get_active_reminders():
            if not r.get("time"):
                continue
            r_start = to_minutes(r["time"])
            occupied.append((r_start, r_start + block_minutes))

        free_slots = []
        cursor = start
        while cursor + block_minutes <= end:
            block_end = cursor + block_minutes
            overlaps = any(cursor < o_end and block_end > o_start for o_start, o_end in occupied)
            if not overlaps:
                free_slots.append({"start": to_hhmm(cursor), "end": to_hhmm(block_end)})
            cursor += block_minutes

        return free_slots

    def get_summary(self) -> dict:
        """
        POLYMORPHISM: implementasi get_summary() khusus untuk reminder.
        """
        active = self.get_active_reminders()
        done = [r for r in self._reminders if r["is_done"]]
        return {
            "type": "reminder",
            "total_reminders": len(self._reminders),
            "active_count": len(active),
            "done_count": len(done),
            "reminders": self._reminders,
            "active_hours": self.active_hours,
            "free_slots": self.find_free_slots(),
            "last_updated": self.last_updated,
        }


class TaskManager(Manager):
    """
    Mengelola daftar tugas yang harus diselesaikan pengguna.

    ENCAPSULATION: daftar tugas (_tasks) hanya bisa diubah lewat
    add_task(), complete_task(), atau delete_task().
    """

    PRIORITY_LEVELS = ("rendah", "sedang", "tinggi")

    def __init__(self, owner_id: int):
        super().__init__(owner_id)
        self._tasks = []
        self._next_id = 1

    def add_task(self, title: str, deadline: str = None, priority: str = "sedang") -> dict:
        if not title.strip():
            raise ValueError("Judul tugas tidak boleh kosong")
        priority = priority.lower()
        if priority not in self.PRIORITY_LEVELS:
            priority = "sedang"
        task = {
            "id": self._next_id,
            "title": title.strip(),
            "deadline": deadline,
            "priority": priority,
            "is_done": False,
            "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        }
        self._tasks.append(task)
        self._next_id += 1
        self._touch()
        return task

    def complete_task(self, task_id: int) -> bool:
        for t in self._tasks:
            if t["id"] == task_id:
                t["is_done"] = True
                self._touch()
                return True
        return False

    def delete_task(self, task_id: int) -> bool:
        before = len(self._tasks)
        self._tasks = [t for t in self._tasks if t["id"] != task_id]
        self._touch()
        return len(self._tasks) < before

    def get_pending_tasks(self) -> list:
        return [t for t in self._tasks if not t["is_done"]]

    def get_tasks_needing_reminder(self) -> list:
        """
        Mengembalikan tugas yang BELUM selesai dan deadline-nya sudah
        tiba/lewat (hari ini atau sebelumnya). Dipakai untuk fitur
        pengingat berulang: selama tugas belum ditandai selesai, sistem
        akan terus mengingatkan, bukan cuma sekali saat deadline tercapai.
        """
        today_str = date.today().strftime("%Y-%m-%d")
        due = []
        for t in self.get_pending_tasks():
            if t["deadline"] and t["deadline"] <= today_str:
                due.append(t)
        return due

    def get_summary(self) -> dict:
        """
        POLYMORPHISM: implementasi get_summary() khusus untuk task manager.
        """
        pending = self.get_pending_tasks()
        done = [t for t in self._tasks if t["is_done"]]
        completion_rate = 0
        if self._tasks:
            completion_rate = round(len(done) / len(self._tasks) * 100, 1)
        return {
            "type": "task",
            "total_tasks": len(self._tasks),
            "pending_count": len(pending),
            "done_count": len(done),
            "completion_rate": completion_rate,
            "tasks": self._tasks,
            "needs_reminder": self.get_tasks_needing_reminder(),
            "last_updated": self.last_updated,
        }


def build_daily_report(screen_tracker: ScreenTimeTracker,
                        reminder_manager: ReminderManager,
                        task_manager: TaskManager) -> dict:
    """
    Fitur 'Daily productivity report'.

    Memanggil get_summary() dari TIGA jenis manager yang berbeda dengan
    cara pemanggilan yang sama persis -> contoh nyata POLYMORPHISM
    dalam aksi (di luar class, kode ini tidak perlu tahu detail
    implementasi tiap manager, cukup panggil .get_summary()).
    """
    managers = [screen_tracker, reminder_manager, task_manager]
    summaries = {}
    for m in managers:
        summary = m.get_summary()
        summaries[summary["type"]] = summary

    # Skor produktivitas sederhana berdasarkan 3 faktor
    score = 100
    if summaries["screen_time"]["over_limit"]:
        score -= 30
    if summaries["task"]["total_tasks"] > 0:
        score = score - (100 - summaries["task"]["completion_rate"]) * 0.4
    if summaries["reminder"]["active_count"] > 0:
        score -= min(summaries["reminder"]["active_count"] * 5, 20)
    score = max(0, round(score))

    return {
        "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "screen_time": summaries["screen_time"],
        "reminder": summaries["reminder"],
        "task": summaries["task"],
        "productivity_score": score,
    }
