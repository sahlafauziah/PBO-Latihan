"""
base.py
--------
Berisi class User dan base class Manager.

Konsep OOP yang diterapkan di file ini:
- ENCAPSULATION : Semua atribut penting disimpan sebagai atribut "private"
  (diawali underscore) dan hanya bisa diakses/diubah lewat property atau
  method tertentu (getter/setter). Ini melindungi data agar tidak diubah
  sembarangan dari luar class.
- INHERITANCE   : class Manager adalah class dasar (parent) yang nantinya
  diturunkan oleh ScreenTimeTracker, ReminderManager, dan TaskManager
  di file managers.py. Semua manager otomatis punya atribut & method
  umum dari Manager tanpa harus menulis ulang kodenya.
- POLYMORPHISM  : Manager mendefinisikan method get_summary() sebagai
  "kontrak". Setiap class anak WAJIB punya isi implementasi get_summary()
  sendiri yang berbeda-beda, tapi tetap bisa dipanggil dengan cara yang
  sama: manager.get_summary().
"""

from datetime import datetime
from abc import ABC, abstractmethod


class User:
    """
    Merepresentasikan satu pengguna sistem.

    ENCAPSULATION:
    Atribut _username, _email, dan _join_date disembunyikan (private-like)
    dan hanya bisa dibaca lewat property, atau diubah lewat method
    set_username()/set_email() yang sudah punya validasi.
    Ini mencegah data User diisi dengan nilai yang tidak valid (misalnya
    username kosong) langsung dari luar class.
    """

    def __init__(self, user_id: int, username: str, email: str):
        self._user_id = user_id
        self._username = self._validate_username(username)
        self._email = self._validate_email(email)
        self._join_date = datetime.now()

    # ---------- Validasi internal (private helper) ----------
    @staticmethod
    def _validate_username(username: str) -> str:
        if not username or len(username.strip()) == 0:
            raise ValueError("Username tidak boleh kosong")
        return username.strip()

    @staticmethod
    def _validate_email(email: str) -> str:
        if not email or "@" not in email:
            raise ValueError("Format email tidak valid")
        return email.strip()

    # ---------- Getter (property) ----------
    @property
    def user_id(self) -> int:
        return self._user_id

    @property
    def username(self) -> str:
        return self._username

    @property
    def email(self) -> str:
        return self._email

    @property
    def join_date(self) -> datetime:
        return self._join_date

    # ---------- Setter terkontrol ----------
    def set_username(self, new_username: str) -> None:
        """Mengubah username dengan validasi (encapsulation)."""
        self._username = self._validate_username(new_username)

    def set_email(self, new_email: str) -> None:
        """Mengubah email dengan validasi (encapsulation)."""
        self._email = self._validate_email(new_email)

    def to_dict(self) -> dict:
        return {
            "user_id": self._user_id,
            "username": self._username,
            "email": self._email,
            "join_date": self._join_date.strftime("%Y-%m-%d %H:%M:%S"),
        }

    def __str__(self) -> str:
        return f"User({self._username})"


class Manager(ABC):
    """
    Base class abstrak untuk semua "manager" dalam sistem
    (ScreenTimeTracker, ReminderManager, TaskManager).

    INHERITANCE:
    Class ini menyimpan hal-hal umum yang dibutuhkan setiap manager,
    yaitu data siapa pemiliknya (owner_id) dan kapan terakhir diperbarui.
    Class anak tinggal melakukan super().__init__(owner_id) dan otomatis
    mendapat semua atribut serta method ini tanpa perlu menulis ulang.

    POLYMORPHISM:
    get_summary() didefinisikan sebagai abstractmethod di sini, artinya
    Manager TIDAK bisa di-instantiate langsung dan setiap class anak
    WAJIB punya implementasi get_summary() versinya masing-masing.
    Saat dipanggil dari luar, bentuk pemanggilannya selalu sama
    (manager.get_summary()) walau isi & formatnya berbeda untuk setiap
    jenis manager -> inilah polymorphism.
    """

    def __init__(self, owner_id: int):
        self._owner_id = owner_id
        self._last_updated = datetime.now()

    @property
    def owner_id(self) -> int:
        return self._owner_id

    @property
    def last_updated(self) -> str:
        return self._last_updated.strftime("%Y-%m-%d %H:%M:%S")

    def _touch(self) -> None:
        """Helper internal: update timestamp setiap kali data berubah."""
        self._last_updated = datetime.now()

    @abstractmethod
    def get_summary(self) -> dict:
        """
        Setiap class anak HARUS mengimplementasikan method ini sendiri.
        Inilah letak polymorphism: pemanggilan sama, hasil & logika beda.
        """
        raise NotImplementedError
