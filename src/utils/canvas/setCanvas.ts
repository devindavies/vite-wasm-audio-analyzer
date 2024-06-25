import { REASON } from "../../constants/strings";

const setCanvas = (args: {
	reason: REASON;
	ready: boolean;
	canvas: HTMLCanvasElement;
	ctx: CanvasRenderingContext2D;
	loRes: boolean;
	scaleX: CanvasRenderingContext2D;
	isFullscreen: boolean;
	fsEl: HTMLElement;
	container: HTMLElement;
	height?: number;
	width?: number;
	defaultWidth: number;
	defaultHeight: number;
	overlay: boolean;
	setPixelRatio: (pixelRatio: number) => void;
	calcBars: () => void;
	//makeGrad: () => void,
}) => {
	if (!args.ready) return;

	const canvasX = args.scaleX.canvas;
	const pixelRatio = window.devicePixelRatio / (Number(args.loRes) + 1);

	let screenWidth = window.screen.width * pixelRatio;
	let screenHeight = window.screen.height * pixelRatio;

	// Fix for iOS Safari - swap width and height when in landscape
	if (
		Math.abs(window.screen.orientation.angle) === 90 &&
		screenWidth < screenHeight
	)
		[screenWidth, screenHeight] = [screenHeight, screenWidth];

	const isCanvasFs = args.isFullscreen && args.fsEl === args.canvas;
	const newWidth = isCanvasFs
		? screenWidth
		: ((args.width || args.container.clientWidth || args.defaultWidth) *
				pixelRatio) |
			0;
	const newHeight = isCanvasFs
		? screenHeight
		: ((args.height || args.container.clientHeight || args.defaultHeight) *
				pixelRatio) |
			0;

	// set/update object properties
	args.setPixelRatio(pixelRatio);

	// if this is not the constructor call and canvas dimensions haven't changed, quit
	if (
		args.reason !== REASON.CREATE &&
		args.canvas.width === newWidth &&
		args.canvas.height === newHeight
	)
		return;

	// apply new dimensions
	args.canvas.width = newWidth;
	args.canvas.height = newHeight;

	// if not in overlay mode, paint the canvas black
	if (!args.overlay) {
		args.ctx.fillStyle = "#000";
		args.ctx.fillRect(0, 0, newWidth, newHeight);
	}

	// set lineJoin property for area fill mode (this is reset whenever the canvas size changes)
	args.ctx.lineJoin = "bevel";

	// update dimensions of the scale canvas
	canvasX.width = newWidth;
	canvasX.height = Math.max(
		20 * pixelRatio,
		(Math.min(newWidth, newHeight) / 32) | 0,
	);

	// calculate bar positions and led options
	args.calcBars();

	// (re)generate gradient
	//makeGrad();

	// detect fullscreen changes (for Safari)
};

export default setCanvas;
