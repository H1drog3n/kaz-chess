"use client";

import { useCallback, useEffect, useRef } from "react";

function parseBestmoveUci(line) {
  const s = typeof line === "string" ? line.trim() : "";
  if (!s.startsWith("bestmove")) return null;
  if (s.includes("(none)")) return null;
  const m = s.match(/bestmove ([a-h][1-8][a-h][1-8][qrbn]?)/);
  return m ? m[1] : null;
}

function parseInfoEval(line) {
  const s = typeof line === "string" ? line.trim() : "";
  if (!s.startsWith("info")) return null;

  const mateMatch = s.match(/\bscore mate (-?\d+)/);
  if (mateMatch) {
    return { kind: "mate", mate: Number(mateMatch[1]) };
  }

  const cpMatch = s.match(/\bscore cp (-?\d+)/);
  if (cpMatch) {
    return { kind: "cp", cp: Number(cpMatch[1]) };
  }

  return null;
}

/**
 * Single-threaded Stockfish worker (stockfish.js npm package).
 */
export function useStockfish() {
  const workerRef = useRef(null);
  const readyPromiseRef = useRef(null);

  useEffect(() => {
    if (typeof Worker === "undefined") return undefined;

    const worker = new Worker("/stockfish.wasm.js");
    workerRef.current = worker;

    readyPromiseRef.current = Promise.race([
      new Promise((resolve, reject) => {
        const onMessage = (e) => {
          const line = typeof e.data === "string" ? e.data.trim() : "";
          if (line === "uciok") worker.postMessage("isready");
          if (line === "readyok") {
            worker.removeEventListener("message", onMessage);
            resolve(true);
          }
        };
        worker.addEventListener("message", onMessage);
        worker.addEventListener(
          "error",
          () => {
            worker.removeEventListener("message", onMessage);
            reject(new Error("Stockfish worker error"));
          },
          { once: true }
        );
        worker.postMessage("uci");
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Stockfish init timeout")), 30000)
      ),
    ]).catch(() => false);

    return () => {
      worker.terminate();
      workerRef.current = null;
      readyPromiseRef.current = null;
    };
  }, []);

  const findBestMoveUci = useCallback(async (fen, depth) => {
    const d = Math.min(20, Math.max(1, Number(depth) || 10));
    const worker = workerRef.current;
    const readyP = readyPromiseRef.current;
    if (!worker || !readyP) return null;

    const ok = await readyP.catch(() => false);
    if (!ok) return null;

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        cleanup();
        resolve(null);
      }, 120000);

      function cleanup() {
        clearTimeout(timeout);
        worker.removeEventListener("message", onMessage);
      }

      function onMessage(e) {
        const line = typeof e.data === "string" ? e.data : "";
        const uci = parseBestmoveUci(line);
        if (uci !== null || (line && line.trim().startsWith("bestmove"))) {
          cleanup();
          resolve(uci);
        }
      }

      worker.addEventListener("message", onMessage);
      worker.postMessage("stop");
      worker.postMessage(`position fen ${fen}`);
      worker.postMessage(`go depth ${d}`);
    });
  }, []);

  /**
   * @param {string} fen
   * @param {number} [depth]
   * @param {number} [timeoutMs] — abort search after this (wasm Stockfish can stall on some terminal FENs).
   */
  const evaluateFen = useCallback(async (fen, depth, timeoutMs = 45000) => {
    const d = Math.min(20, Math.max(1, Number(depth) || 10));
    const ms = Math.min(180000, Math.max(3000, Number(timeoutMs) || 45000));
    const worker = workerRef.current;
    const readyP = readyPromiseRef.current;
    if (!worker || !readyP) return null;

    const ok = await readyP.catch(() => false);
    if (!ok) return null;

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        try {
          worker.postMessage("stop");
        } catch {
          /* ignore */
        }
        cleanup();
        resolve(null);
      }, ms);

      let lastEval = null;

      function cleanup() {
        clearTimeout(timeout);
        worker.removeEventListener("message", onMessage);
      }

      function onMessage(e) {
        const line = typeof e.data === "string" ? e.data : "";
        const ev = parseInfoEval(line);
        if (ev) lastEval = ev;

        const uci = parseBestmoveUci(line);
        if (uci !== null || (line && line.trim().startsWith("bestmove"))) {
          cleanup();
          resolve(lastEval);
        }
      }

      worker.addEventListener("message", onMessage);
      worker.postMessage("stop");
      worker.postMessage(`position fen ${fen}`);
      worker.postMessage(`go depth ${d}`);
    });
  }, []);

  return { findBestMoveUci, evaluateFen };
}
