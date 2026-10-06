"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { uploadAvatar, type PublicUser } from "@/lib/auth-api";
import { avatarUploadErrorMessage, validateAvatarFile } from "@/lib/avatar";

interface Selection {
  file: File;
  previewUrl: string;
}

export function useAvatarUpload(onUploaded: (user: PublicUser) => void) {
  const [selection, setSelection] = useState<Selection | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const inFlight = useRef(false);
  const live = useRef<Selection | null>(null);
  const controller = useRef<AbortController | null>(null);

  const replaceSelection = useCallback((next: Selection | null) => {
    if (live.current) URL.revokeObjectURL(live.current.previewUrl);
    live.current = next;
    setSelection(next);
  }, []);

  useEffect(
    () => () => {
      controller.current?.abort();
      if (live.current) URL.revokeObjectURL(live.current.previewUrl);
    },
    [],
  );

  function select(file: File) {
    if (inFlight.current) return;
    setSaved(false);
    const problem = validateAvatarFile(file);
    if (problem) {
      setError(problem);
      replaceSelection(null);
      return;
    }
    setError(null);
    replaceSelection({ file, previewUrl: URL.createObjectURL(file) });
  }

  function cancel() {
    if (inFlight.current) return;
    setError(null);
    replaceSelection(null);
  }

  async function save() {
    const current = live.current;
    if (!current || inFlight.current) return;
    inFlight.current = true;
    const abort = new AbortController();
    controller.current = abort;
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      const { user } = await uploadAvatar(current.file, abort.signal);
      if (abort.signal.aborted) return;
      replaceSelection(null);
      setSaved(true);
      onUploaded(user);
    } catch (err) {
      if (abort.signal.aborted) return;
      setError(avatarUploadErrorMessage(err));
    } finally {
      if (!abort.signal.aborted) {
        inFlight.current = false;
        setPending(false);
      }
    }
  }

  return {
    file: selection?.file ?? null,
    previewUrl: selection?.previewUrl ?? null,
    pending,
    error,
    saved,
    select,
    cancel,
    save,
  };
}
