export type BaseGradient = [
	string,
	{
		colorStops: (string | { color: string; level: number; pos?: number })[];
		bgColor?: string;
		dir?: string;
	},
];

export const PRISM = [
	"#a35",
	"#c66",
	"#e94",
	"#ed0",
	"#9d5",
	"#4d8",
	"#2cb",
	"#0bc",
	"#09c",
	"#36b",
];
export const GRADIENTS: BaseGradient[] = [
	[
		"classic",
		{
			colorStops: [
				"red",
				{ color: "yellow", level: 0.85, pos: 0.6 },
				{ color: "lime", level: 0.475 },
			],
		},
	],
	[
		"prism",
		{
			colorStops: PRISM,
		},
	],
	[
		"rainbow",
		{
			dir: "h",
			colorStops: ["#817", ...PRISM, "#639"],
		},
	],
	[
		"orangered",
		{
			bgColor: "#3e2f29",
			colorStops: ["OrangeRed"],
		},
	],
	[
		"steelblue",
		{
			bgColor: "#222c35",
			colorStops: ["SteelBlue"],
		},
	],
];
