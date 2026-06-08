"use client";

export function PickLockButton({
  isLocked,
  isSaving,
  onClick,
  canLock,
}: {
  isLocked: boolean;
  isSaving: boolean;
  onClick: () => void;
  /** When unlocked, lock is only allowed if the pick is complete */
  canLock: boolean;
}) {
  const lockDisabled = isSaving || (!isLocked && !canLock);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={lockDisabled}
      title={
        isLocked
          ? "Unlock to change your score"
          : canLock
            ? "Lock your pick"
            : "Set both scores before locking"
      }
      aria-label={isLocked ? "Unlock pick" : "Lock pick"}
      className={`pick-lock-btn ${isLocked ? "pick-lock-btn--locked" : ""} ${
        lockDisabled && !isLocked ? "pick-lock-btn--disabled" : ""
      }`}
    >
      {isSaving ? (
        <span className="pick-lock-spinner" aria-hidden />
      ) : isLocked ? (
        <LockClosedIcon />
      ) : (
        <LockOpenIcon />
      )}
    </button>
  );
}

function LockOpenIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 10V8a5 5 0 0 1 9.9-1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <rect
        x="5"
        y="10"
        width="14"
        height="11"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}

function LockClosedIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="5"
        y="11"
        width="14"
        height="10"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M8 11V8a4 4 0 0 1 8 0v3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
