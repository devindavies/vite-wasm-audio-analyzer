"use client";
import type RTANode from "../utils/RTANode";
import { setupAudio } from "../utils/setupAudio";
import { useCallback, useEffect, useRef, useState } from "react";

import { setupCanvas } from "../utils/setupCanvas";
import { DEBOUNCE_TIMEOUT, DOM_EVENT, REASON } from "../constants/strings";
import type { WasmCanvasEvent } from "../types/Event";

const AudioController: React.FC = () => {
	const [audio, setAudio] = useState<
		{ context: AudioContext; node: RTANode } | undefined
	>(undefined);

	const [running, setRunning] = useState(false);
	const [isFullscreen, setIsFullscreen] = useState(false);

	const canvas_worker = useRef<Worker | null>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const scaleXRef = useRef<HTMLCanvasElement>(null);
	const scaleRRef = useRef<HTMLCanvasElement>(null);
	const audioRef = useRef<HTMLAudioElement | null>(null);
	// Channel for communication between the AudioWorkletProcessor and the canvas Worker.
	const channel = useRef<MessageChannel | null>(null);
	if (!channel.current) {
		channel.current = new MessageChannel();
	}

	const fsTimeout = useRef<number | null>(null); // Fullscreen timeout
	const fsChanging = useRef(false); // Fullscreen changing

	// Send the latest signal to the canvas Worker.
	/** 
	const setLatestSignal = useCallback((signal: AnalysisResult[]) => {
		if (canvas_worker.current) {
			canvas_worker.current.postMessage({
				type: "startAnimation",
				data: signal,
			});
		}
	}, []);
	*/

	// Update canvas size on container / window resize and fullscreen events

	// Fullscreen changes are handled quite differently across browsers:
	// 1. Chromium browsers will trigger a `resize` event followed by a `fullscreenchange`
	// 2. Firefox triggers the `fullscreenchange` first and then the `resize`
	// 3. Chrome on Android (TV) won't trigger a `resize` event, only `fullscreenchange`
	// 4. Safari won't trigger `fullscreenchange` events at all, and on iPadOS the `resize`
	//    event is triggered **on the window** only (last tested on iPadOS 14)

	// helper function for resize events

	const onResize = useCallback(() => {
		if (!fsTimeout.current) {
			// delay the resize to prioritize a possible following `fullscreenchange` event
			fsTimeout.current = window.setTimeout(() => {
				if (!fsChanging.current) {
					canvas_worker.current?.postMessage({
						type: "setCanvas",
						data: {
							reason: REASON.RESIZE,
							ready: true,
							loRes: false,
							isFullscreen,
							width: 0,
							defaultWidth: 800,
							height: 0,
							defaultHeight: 600,
							overlay: false,
							fsStatus: false,
						},
					} as WasmCanvasEvent);
					fsTimeout.current = 0;
				}
			}, DEBOUNCE_TIMEOUT);
		}
	}, []);

	const toggleFullscreen = () => {
		if (isFullscreen) {
			if (document.exitFullscreen) document.exitFullscreen();
			else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
		} else {
			const fsEl = canvasRef.current;
			if (!fsEl) return;
			if (fsEl.requestFullscreen) fsEl.requestFullscreen();
			else if (fsEl.webkitRequestFullscreen) fsEl.webkitRequestFullscreen();
		}
	};

	useEffect(() => {
		if (
			canvasRef.current &&
			!canvas_worker.current &&
			channel.current &&
			scaleXRef.current &&
			scaleRRef.current
		) {
			const worker = setupCanvas(
				canvasRef.current,
				scaleXRef.current,
				scaleRRef.current,
				channel.current.port1,
			);
			canvas_worker.current = worker;
		}
	}, []);

	useEffect(() => {
		const observer = new ResizeObserver(onResize);
		observer.observe(document.body);

		window.addEventListener(DOM_EVENT.RESIZE, onResize);

		canvasRef.current?.addEventListener(DOM_EVENT.FULLSCREENCHANGE, () => {
			fsChanging.current = true;
			if (fsTimeout.current) {
				clearTimeout(fsTimeout.current);
				fsTimeout.current = 0;
			}
			//setCanvas(REASON.FULLSCREEN);
			fsChanging.current = false;
		});

		return () => {
			window.removeEventListener(DOM_EVENT.RESIZE, onResize);
			observer.disconnect();
		};
	}, [onResize]);

	return (
		<>
			<canvas id="wasm-canvas" width="800" height="600" ref={canvasRef} />
			<canvas id="scaleX" ref={scaleXRef} />
			<canvas id="scaleR" ref={scaleRRef} />
			{/* biome-ignore lint/a11y/useMediaCaption: <explanation> */}
			<audio
				src="https://icecast2.ufpel.edu.br/live"
				controls
				crossOrigin="anonymous"
				ref={audioRef}
			/>
			{!audio ? (
				<button
					type="button"
					onClick={async () => {
						if (audioRef.current && channel.current) {
							setAudio(
								await setupAudio(
									channel.current.port2,
									//setLatestSignal,
									audioRef.current,
								),
							);
							setRunning(true);
						}
					}}
				>
					Start listening
				</button>
			) : (
				<button
					type="button"
					onClick={async () => {
						if (running) {
							await audio.context.suspend();
							setRunning(audio.context.state === "running");
						} else {
							await audio.context.resume();
							setRunning(audio.context.state === "running");
						}
					}}
					disabled={
						audio.context.state !== "running" &&
						audio.context.state !== "suspended"
					}
				>
					{running ? "Pause" : "Resume"}
				</button>
			)}
		</>
	);
};

export default AudioController;
