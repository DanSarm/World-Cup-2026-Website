"use client";

import { ensurePickLockAudio } from "@/lib/pickLockSound";

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

  function handleClick() {
    ensurePickLockAudio();
    onClick();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={lockDisabled}
      title={
        isLocked
          ? "Unlock to change your score"
          : canLock
            ? "Lock your pick"
            : "Set both scores before locking"
      }
      aria-label={isLocked ? "Unlock pick" : "Lock pick"}
      className={`pick-lock-btn ${
        isLocked ? "pick-lock-btn--locked" : "pick-lock-btn--open"
      } ${lockDisabled && !isLocked ? "pick-lock-btn--disabled" : ""}`}
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
        d="M4 11V8a6 6 0 0 1 11.3-2.8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M8 8V6a4 4 0 0 1 7.5-1.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.45"
      />
      <rect
        x="5"
        y="11"
        width="14"
        height="10"
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
