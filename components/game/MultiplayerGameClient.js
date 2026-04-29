"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { useAuth } from "../../contexts/AuthContext";
import { useLocale } from "../../contexts/LocaleContext";
import { getFirebaseDb } from "../../lib/firebase";
import { BOARD_THEMES, coerceBoardTheme } from "../../lib/boardThemes";
import { safeLocalStorageGet } from "../../lib/clientStorage";
import { makeCustomPieces } from "../chess/makeCustomPieces";

function tryMove(game, sourceSquare, targetSquare) {
  const piece = game.get(sourceSquare);
  const rank = targetSquare[1];
  const isPromotion = piece?.type === "p" && (rank === "8" || rank === "1");
  return game.move({
    from: sourceSquare,
    to: targetSquare,
    ...(isPromotion ? { promotion: "q" } : {}),
  });
}

function gameResultLabel(game, t) {
  if (!game.isGameOver()) return game.turn() === "w" ? t("white_to_move") : t("black_to_move");
  if (game.isCheckmate()) return t("reason_checkmate");
  if (game.isStalemate()) return t("reason_stalemate");
  if (game.isThreefoldRepetition()) return t("reason_repetition");
  if (game.isInsufficientMaterial()) return t("reason_insufficient");
  if (game.isDraw()) return "Draw";
  return "Game over";
}

export function MultiplayerGameClient() {
  const { user, loading } = useAuth();
  const { t } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomId = String(searchParams.get("room") || "");

  const [room, setRoom] = useState(null);
  const [roomErr, setRoomErr] = useState(null);
  const [joining, setJoining] = useState(false);
  const [boardThemeKey, setBoardThemeKey] = useState("classic");
  const [pieceSetKey, setPieceSetKey] = useState("classic");

  useEffect(() => {
    const v = safeLocalStorageGet("boardTheme", "classic");
    setBoardThemeKey(coerceBoardTheme(v));
    const ps = safeLocalStorageGet("pieceSet", "classic");
    if (typeof ps === "string") setPieceSetKey(ps);
  }, []);

  const db = getFirebaseDb();
  const roomRef = useMemo(() => (db && roomId ? doc(db, "liveRooms", roomId) : null), [db, roomId]);

  const myColor = useMemo(() => {
    if (!user || !room) return null;
    if (room.whiteUid === user.uid) return "w";
    if (room.blackUid === user.uid) return "b";
    return null;
  }, [room, user]);

  useEffect(() => {
    if (!roomRef) return;
    const unsub = onSnapshot(
      roomRef,
      (snap) => {
        if (!snap.exists()) {
          setRoom(null);
          setRoomErr("Room not found");
          return;
        }
        setRoom(snap.data());
        setRoomErr(null);
      },
      (e) => setRoomErr(e?.message || "Failed to subscribe room")
    );
    return () => unsub();
  }, [roomRef]);

  const createRoom = useCallback(async () => {
    if (!db || !user) return;
    const startFen = new Chess().fen();
    const ref = await addDoc(collection(db, "liveRooms"), {
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      whiteUid: user.uid,
      blackUid: null,
      movesSan: [],
      fen: startFen,
      status: "waiting",
      turn: "w",
    });
    router.push(`/multiplayer?room=${ref.id}`);
  }, [db, user, router]);

  const joinRoom = useCallback(async () => {
    if (!db || !roomRef || !user) return;
    setJoining(true);
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(roomRef);
        if (!snap.exists()) throw new Error("Room not found");
        const data = snap.data() || {};
        const whiteUid = data.whiteUid || null;
        const blackUid = data.blackUid || null;
        if (whiteUid === user.uid || blackUid === user.uid) return;
        if (whiteUid && blackUid) throw new Error("Room already full");
        if (!whiteUid) {
          tx.update(roomRef, {
            whiteUid: user.uid,
            status: "waiting",
            updatedAt: serverTimestamp(),
          });
          return;
        }
        tx.update(roomRef, {
          blackUid: user.uid,
          status: "active",
          updatedAt: serverTimestamp(),
        });
      });
      setRoomErr(null);
    } catch (e) {
      setRoomErr(e?.message || "Could not join room");
    } finally {
      setJoining(false);
    }
  }, [db, roomRef, user]);

  const game = useMemo(() => {
    const g = new Chess();
    for (const san of room?.movesSan || []) {
      try {
        g.move(san);
      } catch {
        break;
      }
    }
    return g;
  }, [room?.movesSan]);

  const onPieceDrop = useCallback(
    async (sourceSquare, targetSquare) => {
      if (!db || !roomRef || !room || !myColor) return false;
      if (game.isGameOver()) return false;
      if (game.turn() !== myColor) return false;

      try {
        await runTransaction(db, async (tx) => {
          const snap = await tx.get(roomRef);
          if (!snap.exists()) throw new Error("Room not found");
          const data = snap.data();
          const g = new Chess();
          for (const san of data.movesSan || []) g.move(san);
          const turnColor = g.turn();
          const actorUid = turnColor === "w" ? data.whiteUid : data.blackUid;
          if (!actorUid || actorUid !== user?.uid) throw new Error("Not your turn");

          const move = tryMove(g, sourceSquare, targetSquare);
          if (!move) throw new Error("Illegal move");

          tx.update(roomRef, {
            movesSan: [...(data.movesSan || []), move.san],
            fen: g.fen(),
            turn: g.turn(),
            status: g.isGameOver() ? "finished" : "active",
            updatedAt: serverTimestamp(),
            lastMoveBy: user.uid,
          });
        });
        return true;
      } catch {
        return false;
      }
    },
    [db, roomRef, room, myColor, game, user]
  );

  const shareUrl = useMemo(() => {
    if (!roomId || typeof window === "undefined") return "";
    return `${window.location.origin}/multiplayer?room=${roomId}`;
  }, [roomId]);

  const copyLink = useCallback(async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      // ignore
    }
  }, [shareUrl]);

  const boardTheme = BOARD_THEMES[boardThemeKey] || BOARD_THEMES.classic;
  const customPieces = useMemo(() => {
    if (!pieceSetKey || pieceSetKey === "classic") return undefined;
    return makeCustomPieces(pieceSetKey);
  }, [pieceSetKey]);

  if (loading) return <div className="p-8 text-center text-zinc-500">{t("loading")}</div>;
  if (!user) {
    return (
      <div className="p-8 text-center">
        <Link href="/login" className="text-blue-600 underline">
          {t("replay_login_prompt")}
        </Link>
      </div>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col items-center px-4 py-8">
      <div className="mb-4 flex w-full items-center justify-between">
        <h1 className="text-2xl font-bold">Multiplayer 1v1</h1>
        <Link href="/lobby" className="text-sm text-blue-600 underline">
          ← {t("back_to_list")}
        </Link>
      </div>

      {!roomId && (
        <div className="w-full rounded-xl border border-zinc-200 bg-white p-6 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-300">
            Создай комнату и отправь другу ссылку. Он зайдет по URL и подключится в реальном времени.
          </p>
          <button
            type="button"
            onClick={createRoom}
            className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-500"
          >
            Создать комнату
          </button>
        </div>
      )}

      {roomId && (
        <div className="w-full">
          <div className="mb-3 rounded-lg border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-1">Комната: <span className="font-mono">{roomId}</span></div>
            <div className="mb-2 truncate">Ссылка: <span className="font-mono">{shareUrl || "..."}</span></div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={copyLink} className="rounded border px-3 py-1">
                Копировать ссылку
              </button>
              {!myColor && (
                <button
                  type="button"
                  onClick={joinRoom}
                  disabled={joining}
                  className="rounded bg-blue-600 px-3 py-1 text-white disabled:opacity-60"
                >
                  {joining ? "Подключение..." : "Войти в комнату"}
                </button>
              )}
            </div>
            {roomErr && <p className="mt-2 text-xs text-rose-600">{roomErr}</p>}
          </div>

          <div className="mb-2 text-center text-sm text-zinc-600 dark:text-zinc-300">
            {myColor
              ? `Ты играешь: ${myColor === "w" ? "белыми" : "черными"}`
              : "Ты наблюдатель (комната занята или еще не присоединился)"}
            {" · "}
            {gameResultLabel(game, t)}
          </div>

          <div className="mx-auto w-full max-w-[560px]">
            <Chessboard
              position={game.fen()}
              onPieceDrop={onPieceDrop}
              boardOrientation={myColor === "b" ? "black" : "white"}
              customPieces={customPieces}
              arePiecesDraggable={Boolean(myColor) && !game.isGameOver()}
              customLightSquareStyle={{ backgroundColor: boardTheme.light }}
              customDarkSquareStyle={{ backgroundColor: boardTheme.dark }}
              customBoardStyle={{ borderRadius: 8 }}
            />
          </div>
        </div>
      )}
    </main>
  );
}

