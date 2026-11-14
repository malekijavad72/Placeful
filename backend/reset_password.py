
from getpass import getpass

from app.database import SessionLocal
from app.models import User
from app.core.security import hash_password


def main():
    username = input("Enter username: ").strip()

    new_password = getpass("Enter new password: ")
    confirm_password = getpass("Confirm new password: ")

    if new_password != confirm_password:
        print("Passwords do not match.")
        return

    if len(new_password) < 8:
        print("Password must be at least 8 characters.")
        return

    user = None
    db = SessionLocal()

    try:
        user = (
            db.query(User)
            .filter(User.username == username)
            .first()
        )

        if user is None:
            print("User not found.")
            return

        user.password_hash = hash_password(new_password)

        db.commit()

        print("Password successfully reset for:", user.username)

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


if __name__ == "__main__":
    main()
