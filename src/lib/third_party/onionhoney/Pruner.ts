/* ignore file coverage */
import { getUpFaceRotation } from '$lib/optimizer/optimizer';
import { CubieCube, Mask, Move, type MaskT } from './CubeLib';
import { cartesianProduct } from './Math';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if ((globalThis as any).$RefreshReg$ === undefined) {
	// hack for disabling refresh plugin in web worker
	// eslint-disable-next-line @typescript-eslint/no-empty-function, @typescript-eslint/no-explicit-any
	(globalThis as any).$RefreshReg$ = () => {};
	// eslint-disable-next-line @typescript-eslint/no-empty-function, @typescript-eslint/no-explicit-any
	(globalThis as any).$RefreshSig$ = () => () => {};
}

export type PrunerConfig = {
	size: number;
	encode: (cube: CubieCube) => bigint;
	solved_states: CubieCube[];
	max_depth: number;
	moveset: string[];
	rev_lookup_depth?: number;
	name: string;
};

export type PrunerT = {
	init: () => void;
	query: (c: CubieCube) => number;
	equal: (c1: CubieCube, c2: CubieCube) => boolean;
	encode: (c: CubieCube) => bigint;
	moveset: Move[];
	max_depth: number;
	size: number;
};

enum PrunerPiece {
	S,
	O,
	I,
	X
} // Solved, Oriented, Ignore, Exclude
const { S, I, O, X } = PrunerPiece;

export type PrunerDef = {
	corner: PrunerPiece[];
	edge: PrunerPiece[];
	center: PrunerPiece[];
	solved_states: string[];
	moveset: string[];
	max_depth: number;
	name: string;
};

export const htm_rwm = [
	'U',
	'U2',
	"U'",
	'F',
	'F2',
	"F'",
	'R',
	'R2',
	"R'",
	'r',
	'r2',
	"r'",
	'D',
	'D2',
	"D'",
	'M',
	"M'",
	'M2',
	'B',
	"B'",
	'B2'
];
export const rrwmu = ['U', "U'", 'U2', 'R', "R'", 'R2', 'r', "r'", 'r2', "M'", 'M', 'M2'];
const rrwmu_m_first = ['U', "U'", 'U2', 'R', "R'", 'R2', "M'", 'M', 'M2', 'r', "r'", 'r2'];
const rrwmu_f = [
	'U',
	"U'",
	'U2',
	'R',
	"R'",
	'R2',
	'r',
	"r'",
	'r2',
	"M'",
	'M',
	'M2',
	"F'",
	'F',
	'F2'
];
const rrwmu_b = [
	'U',
	"U'",
	'U2',
	'R',
	"R'",
	'R2',
	'r',
	"r'",
	'r2',
	"M'",
	'M',
	'M2',
	"B'",
	'B',
	'B2'
];

export function Pruner(config: PrunerConfig): PrunerT {
	let dist: Uint8Array | undefined;
	let table: { [x: string]: number } = {};
	const { size, encode, solved_states, max_depth, moveset: moveset_str } = config;
	const moveset = moveset_str.map((x) => Move.all[x]);
	let initialized = false;
	const level_states = [[...solved_states]];
	function recordDist(cube: CubieCube, d: number) {
		const coordinate = encode(cube);
		if (dist !== undefined) {
			const index = Number(coordinate);
			if (dist[index] === 255) {
				dist[index] = d;
				return true;
			}
		} else {
			const index = String(coordinate);
			if (table[index] === undefined) {
				table[index] = d;
				return true;
			}
		}
		return false;
	}
	function init() {
		if (initialized) return;
		initialized = true;
		//try {
		//dist = new Uint8Array(size).fill(255);
		//} catch (invalidArrayLength) {
		console.log('Use slow lookup for size ', size);
		//}
		for (const state of solved_states) {
			recordDist(state, 0);
		}
		let frontier = [...solved_states];
		let total_expanded = frontier.length;
		for (let i = 0; i < max_depth; i++) {
			//console.log("pruner: expanding depth ", i)
			const new_frontier = [];
			for (const state of frontier) {
				for (const move of moveset) {
					const newState = state.apply(move); // clone
					if (recordDist(newState, i + 1)) {
						new_frontier.push(newState);
					}
				}
			}
			frontier = new_frontier;
			if (config.rev_lookup_depth && i + 1 <= config.rev_lookup_depth) {
				level_states.push([...frontier]);
			}
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			total_expanded += frontier.length;
		}
		console.log(
			`${config.name} pruning table generated. depth = ${max_depth}. size = ${total_expanded}`
		);
		if (config.rev_lookup_depth) {
			// console.log(`${name} pruning reverse lookup generated. depth = ${config.rev_lookup_depth}. size = ${level_states.map(x => x.length).reduce((x,y)=>x+y)}`)
		}
	}
	function query(cube: CubieCube) {
		if (dist !== undefined) {
			const d = dist[Number(encode(cube))];
			if (d === 255) return max_depth + 0.5;
			return d;
		} else {
			const d = table[String(encode(cube))];
			if (d !== undefined) return d;
			return max_depth + 0.5;
		}
	}
	function equal(cube1: CubieCube, cube2: CubieCube) {
		return encode(cube1) === encode(cube2);
	}
	return {
		init,
		query,
		equal,
		encode,
		moveset,
		max_depth,
		size
	};
}

const prunerFactory = function (def: PrunerDef): PrunerConfig {
	// edge
	if (def.corner.length !== 8 || def.edge.length !== 12 || def.center.length !== 6) {
		throw new Error('Invalid pruner def');
	}
	const { S, O, I, X } = PrunerPiece;
	const def_to_idx = (d: PrunerPiece[], count_all?: boolean) => {
		let curr_idx = 0;
		const idx_arr = [];
		for (let i = 0; i < d.length; i++) {
			if (d[i] === S || (count_all && (d[i] === O || d[i] === I))) {
				idx_arr.push(curr_idx++);
			} else idx_arr.push(-1);
		}
		return idx_arr;
	};
	const eosize = def.edge.filter((x) => x === S || x === O).length;
	const epsize = def.edge.filter((x) => x === S).length;
	const eisize = def.edge.filter((x) => x !== X).length;
	const esize = Math.pow(2, eosize) * Math.pow(eisize, epsize);
	const ep_idx = def_to_idx(def.edge, false);
	const e_idx = def_to_idx(def.edge, true);

	const cosize = def.corner.filter((x) => x === S || x === O).length;
	const cpsize = def.corner.filter((x) => x === S).length;
	const cisize = def.corner.filter((x) => x !== X).length;
	const csize = Math.pow(3, cosize) * Math.pow(cisize, cpsize);
	const cp_idx = def_to_idx(def.corner, false);
	const c_idx = def_to_idx(def.corner, true);

	const size = esize * csize;

	function encode(cube: CubieCube) {
		let eo = BigInt(0),
			ep = BigInt(0),
			co = BigInt(0),
			cp = BigInt(0);
		for (let i = 0; i < 12; i++) {
			switch (def.edge[cube.ep[i]]) {
				case S:
					eo = eo * 2n + BigInt(cube.eo[i]);
					ep = ep + BigInt(eisize) ** BigInt(ep_idx[cube.ep[i]]) * BigInt(e_idx[i]);
					break;
				case O:
					eo = eo * 2n + BigInt(cube.eo[i]);
					break;
			}
		}
		const e = ep * 2n ** BigInt(eosize) + eo;
		for (let i = 0; i < 8; i++) {
			switch (def.corner[cube.cp[i]]) {
				case S:
					co = co * 3n + BigInt(cube.co[i]);
					cp = cp + BigInt(cisize) ** BigInt(cp_idx[cube.cp[i]]) * BigInt(c_idx[i]);
					break;
				case O:
					co = co * 3n + BigInt(cube.co[i]);
					break;
			}
		}
		let t = 0n;
		for (let i = 0; i < 6; ++i) {
			if (def.center[cube.tp[i]] === S) {
				t += 2n ** BigInt(i);
			}
		}
		const c = cp * 3n ** BigInt(cosize) + co;
		return (e * BigInt(csize) + c) * 64n + t;
	}

	const solved_states = def.solved_states.map((m) => new CubieCube().apply(m));
	const moveset = def.moveset;
	const max_depth = def.max_depth;
	const name = def.name;
	return {
		size,
		encode,
		solved_states,
		max_depth,
		moveset,
		name
	};
};

export function makePrunerConfigFromMask(name: string, mask: MaskT, allowedMoves?: string[]) {
	const tp = mask.tp ? mask.tp : new Array(6).fill(0);
	const prunerConfig = {
		name,
		corner: mask.cp.map((p, i) => (p === 1 ? S : mask.co ? (mask.co[i] === 1 ? O : I) : I)),
		edge: mask.ep.map((p, i) => (p === 1 ? S : mask.eo ? (mask.eo[i] === 1 ? O : I) : I)),
		center: tp.map((p, i) => (p === 1 ? S : I)),
		solved_states: [''],
		moveset: [...htm_rwm],
		max_depth: 5
	};
	if (allowedMoves) {
		prunerConfig.moveset = allowedMoves;
	}
	prunerConfig.max_depth = Math.floor(Math.log(20000000) / Math.log(prunerConfig.moveset.length));
	const ret = prunerFactory(prunerConfig);
	return ret;
}

const fbdrPrunerConfigGen = (max_depth: number): PrunerConfig => {
	const esize = Math.pow(24, 4);
	const csize = Math.pow(24, 2);
	const size = esize * csize;

	function encode(cube: CubieCube) {
		let c1 = 0,
			c2 = 0;
		for (let i = 0; i < 8; i++) {
			if (cube.cp[i] === 4) {
				c1 = i * 3 + cube.co[i];
			} else if (cube.cp[i] === 5) {
				c2 = i * 3 + cube.co[i];
			}
		}
		const enc_c = c1 * 24 + c2;
		let e1 = 0,
			e2 = 0,
			e3 = 0,
			e4 = 0;
		for (let i = 0; i < 12; i++) {
			switch (cube.ep[i]) {
				case 5:
					e1 = i * 2 + cube.eo[i];
					break;
				case 8:
					e2 = i * 2 + cube.eo[i];
					break;
				case 9:
					e3 = i * 2 + cube.eo[i];
					break;
				case 7:
					e4 = i * 2 + cube.eo[i];
					break;
			}
		}
		const enc_e = e1 * (24 * 24 * 24) + e2 * (24 * 24) + e3 * 24 + e4;
		return BigInt(enc_c + 24 * 24 * enc_e);
	}

	const moves = [[]]; //, Move.parse("L R'"), Move.parse("L' R"), Move.parse("L2 R2")]
	const solved_states = moves.map((move: Move[]) => new CubieCube().apply(move));
	const moveset = htm_rwm;

	return {
		size,
		encode,
		solved_states,
		max_depth,
		moveset,
		name: 'fbdr'
	};
};

const fbdrPrunerConfig = fbdrPrunerConfigGen(5);

// let fbPrunerConfigAuto = prunerFactory({
//     corner: [I,I,I,I,S,S,I,I],
//     edge:   [I,I,I,I,I,S,I,I,S,S,I,I],
//     center: [I,I,I,I,S,I],
//     solved_states: ["id"],
//     moveset: htm_rwm,
//     max_depth: 5
// });

const fbPrunerConfigGen = (max_depth: number): PrunerConfig => {
	const esize = Math.pow(24, 3);
	const csize = Math.pow(24, 2);
	const size = esize * csize;

	function encode(cube: CubieCube) {
		let c1 = 0,
			c2 = 0;
		for (let i = 0; i < 8; i++) {
			switch (cube.cp[i]) {
				case 4:
					c1 = i * 3 + cube.co[i];
					break;
				case 5:
					c2 = i * 3 + cube.co[i];
					break;
			}
		}
		const enc_c = c1 * 24 + c2;
		let e1 = 0,
			e2 = 0,
			e3 = 0;
		for (let i = 0; i < 12; i++) {
			switch (cube.ep[i]) {
				case 5:
					e1 = i * 2 + cube.eo[i];
					break;
				case 8:
					e2 = i * 2 + cube.eo[i];
					break;
				case 9:
					e3 = i * 2 + cube.eo[i];
					break;
			}
		}
		const enc_e = e1 * (24 * 24) + e2 * 24 + e3;
		return BigInt(enc_e * (24 * 24) + enc_c);
	}

	const moves = [[]]; //, Move.parse("L R'"), Move.parse("L' R"), Move.parse("L2 R2")]
	const solved_states = moves.map((move: Move[]) => new CubieCube().apply(move));

	const moveset = htm_rwm;
	return {
		size,
		encode,
		solved_states,
		max_depth,
		moveset,
		// rev_lookup_depth: 3,
		name: 'fb'
	};
};

const fbPrunerConfig = fbPrunerConfigGen(5);
const ssPrunerConfig = (is_front: boolean) => {
	const size = Math.pow(24, 3);
	const c1 = is_front ? 7 : 6;
	const e1 = is_front ? 11 : 10;
	const e2 = 7;
	function encode(cube: CubieCube) {
		const v = [0, 0, 0];
		for (let i = 0; i < 8; i++) {
			if (cube.cp[i] === c1) v[0] = i * 3 + cube.co[i];
		}
		for (let i = 0; i < 12; i++) {
			if (cube.ep[i] === e1) v[1] = i * 2 + cube.eo[i];
			else if (cube.ep[i] === e2) v[2] = i * 2 + cube.eo[i];
		}
		return BigInt(v[0] + v[1] * 24 + v[2] * 24 * 24);
	}

	const moves = [[]];
	const solved_states = moves.map((move: Move[]) => new CubieCube().apply(move));
	const max_depth = 8;
	const moveset = rrwmu;

	return {
		size,
		encode,
		solved_states,
		max_depth,
		moveset,
		name: 'ss' + (is_front ? '-front' : '-back')
	};
};

const ssDpPrunerConfig = (is_front: boolean) => {
	const size = Math.pow(24, 2);
	const c1 = is_front ? 7 : 6;
	const e1 = 7;
	function encode(cube: CubieCube) {
		let v0 = 0,
			v1 = 0;
		for (let i = 0; i < 8; i++) {
			if (cube.cp[i] === c1) v0 = i * 3 + cube.co[i];
		}
		for (let i = 0; i < 12; i++) {
			if (cube.ep[i] === e1) v1 = i * 2 + cube.eo[i];
		}
		return BigInt(v0 + v1 * 24);
	}

	const moves = ['', 'R', 'R2', "R'"];
	const solved_states = moves.map((move: string) => new CubieCube().apply(move));
	const max_depth = 8;
	const moveset = rrwmu_m_first;

	return {
		size,
		encode,
		solved_states,
		max_depth,
		moveset,
		name: 'ssdp' + (is_front ? '-front' : '-back')
	};
};

const sbPrunerConfig = (function () {
	const esize = Math.pow(24, 3);
	const csize = Math.pow(24, 2);
	const size = esize * csize;

	function encode(cube: CubieCube) {
		let c1 = 0,
			c2 = 0;
		for (let i = 0; i < 8; i++) {
			switch (cube.cp[i]) {
				case 6:
					c1 = i * 3 + cube.co[i];
					break;
				case 7:
					c2 = i * 3 + cube.co[i];
					break;
			}
		}
		const enc_c = c1 * 24 + c2;
		let e1 = 0,
			e2 = 0,
			e3 = 0;
		for (let i = 0; i < 12; i++) {
			switch (cube.ep[i]) {
				case 7:
					e1 = i * 2 + cube.eo[i];
					break;
				case 10:
					e2 = i * 2 + cube.eo[i];
					break;
				case 11:
					e3 = i * 2 + cube.eo[i];
					break;
			}
		}
		const enc_e = e1 * (24 * 24) + e2 * 24 + e3;
		return BigInt(enc_e * (24 * 24) + enc_c);
	}

	const moves = [[]];
	const solved_states = moves.map((move: Move[]) => new CubieCube().apply(move));

	const moveset = rrwmu;
	return {
		size,
		encode,
		solved_states,
		max_depth: 6,
		moveset,
		// rev_lookup_depth: 3,
		name: 'sb_rRUM'
	};
})();

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const lpSbPrunerConfigsAuto = (lp_front: boolean) => [
	prunerFactory({
		corner: lp_front ? [I, I, I, I, S, I, I, S] : [I, I, I, I, I, S, S, I],
		edge: lp_front ? [I, I, I, I, I, I, I, S, S, I, I, S] : [I, I, I, I, I, I, I, S, I, S, S, I],
		center: [I, I, I, I, I, I],
		solved_states: ['id'],
		moveset: lp_front ? rrwmu_f : rrwmu_b,
		max_depth: 5,
		name: 'FBLP+SSdiag'
	}),
	prunerFactory({
		// SB
		corner: [I, I, I, I, I, I, S, S],
		edge: [I, I, I, I, I, I, I, S, I, I, S, S],
		center: [I, I, I, I, I, I],
		solved_states: ['id'],
		moveset: lp_front ? rrwmu_f : rrwmu_b,
		max_depth: 5,
		name: 'SB with LP'
	})
];

const lpSbSbPrunerConfigGen = (lp_front: boolean, max_depth: number): PrunerConfig => {
	const esize = Math.pow(24, 3);
	const csize = Math.pow(24, 2);
	const size = esize * csize;
	function encode(cube: CubieCube) {
		let c1 = 0,
			c2 = 0;
		for (let i = 0; i < 8; i++) {
			switch (cube.cp[i]) {
				case 6:
					c1 = i * 3 + cube.co[i];
					break;
				case 7:
					c2 = i * 3 + cube.co[i];
					break;
			}
		}
		const enc_c = c1 * 24 + c2;
		let e1 = 0,
			e2 = 0,
			e3 = 0;
		for (let i = 0; i < 12; i++) {
			switch (cube.ep[i]) {
				case 7:
					e1 = i * 2 + cube.eo[i];
					break;
				case 10:
					e2 = i * 2 + cube.eo[i];
					break;
				case 11:
					e3 = i * 2 + cube.eo[i];
					break;
			}
		}
		const enc_e = e1 * (24 * 24) + e2 * 24 + e3;
		return BigInt(enc_e * (24 * 24) + enc_c);
	}

	const moves = [[]]; //, Move.parse("L R'"), Move.parse("L' R"), Move.parse("L2 R2")]
	const solved_states = moves.map((move: Move[]) => new CubieCube().apply(move));

	const moveset = lp_front ? rrwmu_f : rrwmu_b;

	return {
		size,
		encode,
		solved_states,
		max_depth,
		moveset,
		name: 'lpsb-sb' + (lp_front ? '+front-lp' : '+back-lp')
	};
};

const lpSbDiagPrunerConfigGen = (lp_front: boolean, max_depth: number): PrunerConfig => {
	const esize = Math.pow(24, 3);
	const csize = Math.pow(24, 2);
	const size = esize * csize;
	function encode_f(cube: CubieCube) {
		let c1 = 0,
			c2 = 0;
		for (let i = 0; i < 8; i++) {
			switch (cube.cp[i]) {
				case 4:
					c1 = i * 3 + cube.co[i];
					break;
				case 7:
					c2 = i * 3 + cube.co[i];
					break;
			}
		}
		const enc_c = c1 * 24 + c2;
		let e1 = 0,
			e2 = 0,
			e3 = 0;
		for (let i = 0; i < 12; i++) {
			switch (cube.ep[i]) {
				case 7:
					e1 = i * 2 + cube.eo[i];
					break;
				case 8:
					e2 = i * 2 + cube.eo[i];
					break;
				case 11:
					e3 = i * 2 + cube.eo[i];
					break;
			}
		}
		const enc_e = e1 * (24 * 24) + e2 * 24 + e3;
		return BigInt(enc_e * (24 * 24) + enc_c);
	}
	function encode_b(cube: CubieCube) {
		let c1 = 0,
			c2 = 0;
		for (let i = 0; i < 8; i++) {
			switch (cube.cp[i]) {
				case 5:
					c1 = i * 3 + cube.co[i];
					break;
				case 6:
					c2 = i * 3 + cube.co[i];
					break;
			}
		}
		const enc_c = c1 * 24 + c2;
		let e1 = 0,
			e2 = 0,
			e3 = 0;
		for (let i = 0; i < 12; i++) {
			switch (cube.ep[i]) {
				case 7:
					e1 = i * 2 + cube.eo[i];
					break;
				case 9:
					e2 = i * 2 + cube.eo[i];
					break;
				case 10:
					e3 = i * 2 + cube.eo[i];
					break;
			}
		}
		const enc_e = e1 * (24 * 24) + e2 * 24 + e3;
		return BigInt(enc_e * (24 * 24) + enc_c);
	}

	const moves = [[]]; //, Move.parse("L R'"), Move.parse("L' R"), Move.parse("L2 R2")]
	const solved_states = moves.map((move: Move[]) => new CubieCube().apply(move));

	const moveset = lp_front ? rrwmu_f : rrwmu_b;

	return {
		size,
		encode: lp_front ? encode_f : encode_b,
		solved_states,
		max_depth,
		moveset,
		name: 'lpsb-2sq' + (lp_front ? '+front-lp' : '+back-lp')
	};
};

const lpSbPrunerConfigs = (lp_front: boolean) => [
	lpSbSbPrunerConfigGen(lp_front, 5),
	lpSbDiagPrunerConfigGen(lp_front, 5)
];

const fsPrunerConfig = (is_front: boolean) => {
	const size = Math.pow(24, 3);
	const c1 = is_front ? 4 : 5;
	const e1 = is_front ? 8 : 9;
	const e2 = 5;
	function encode(cube: CubieCube) {
		let v0 = 0,
			v1 = 0,
			v2 = 0;
		for (let i = 0; i < 8; i++) {
			if (cube.cp[i] === c1) v0 = i * 3 + cube.co[i];
		}
		for (let i = 0; i < 12; i++) {
			if (cube.ep[i] === e1) v1 = i * 2 + cube.eo[i];
			else if (cube.ep[i] === e2) v2 = i * 2 + cube.eo[i];
		}
		return BigInt(v0 + v1 * 24 + v2 * 24 * 24);
	}

	const moves = [[]];
	const solved_states = moves.map((move: Move[]) => new CubieCube().apply(move));

	const max_depth = 5;
	const moveset = htm_rwm;

	return {
		size,
		encode,
		solved_states,
		max_depth,
		moveset,
		name: 'fs' + (is_front ? '-front' : '-back')
	};
};

// let fsPrunerConfigAuto = (is_front: boolean) => prunerFactory({
//         corner: is_front ? [I,I,I,I,S,I,I,I] : [I,I,I,I,I,S,I,I] ,
//         edge:   is_front ? [I,I,I,I,I,S,I,I,S,I,I,I] : [I,I,I,I,I,S,I,I,I,S,I,I] ,
//         center: [I,I,I,I,S,I],
//         solved_states: ["id"],
//         moveset: htm_rwm,
//         max_depth: 4
// });

const fbssPrunerConfigsManual = (is_front: boolean, max_depth?: number): PrunerConfig[] => {
	// make a line+ss solver
	max_depth = max_depth || 5;
	const esize = Math.pow(24, 3); // 3 edges
	const csize = Math.pow(24, 3); // 3 corners
	const size = esize * csize;

	function encode_front(cube: CubieCube) {
		let c1 = 0,
			c2 = 0,
			c3 = 0;
		for (let i = 0; i < 8; i++) {
			switch (cube.cp[i]) {
				case 4:
					c1 = i * 3 + cube.co[i];
					break;
				case 5:
					c2 = i * 3 + cube.co[i];
					break;
				case 7:
					c3 = i * 3 + cube.co[i];
					break;
			}
		}
		const enc_c = c1 * (24 * 24) + c2 * 24 + c3;
		let e1 = 0,
			e2 = 0,
			e3 = 0;
		for (let i = 0; i < 12; i++) {
			switch (cube.ep[i]) {
				case 5:
					e1 = i * 2 + cube.eo[i];
					break;
				case 7:
					e2 = i * 2 + cube.eo[i];
					break;
				case 11:
					e3 = i * 2 + cube.eo[i];
					break;
			}
		}
		const enc_e = e1 * (24 * 24) + e2 * 24 + e3;
		return BigInt(enc_c + csize * enc_e);
	}

	function encode_back(cube: CubieCube) {
		let c1 = 0,
			c2 = 0,
			c3 = 0;
		for (let i = 0; i < 8; i++) {
			switch (cube.cp[i]) {
				case 4:
					c1 = i * 3 + cube.co[i];
					break;
				case 5:
					c2 = i * 3 + cube.co[i];
					break;
				case 6:
					c3 = i * 3 + cube.co[i];
					break;
			}
		}
		const enc_c = c1 * (24 * 24) + c2 * 24 + c3;
		let e1 = 0,
			e2 = 0,
			e3 = 0;
		for (let i = 0; i < 12; i++) {
			switch (cube.ep[i]) {
				case 5:
					e1 = i * 2 + cube.eo[i];
					break;
				case 7:
					e2 = i * 2 + cube.eo[i];
					break;
				case 10:
					e3 = i * 2 + cube.eo[i];
					break;
			}
		}
		const enc_e = e1 * (24 * 24) + e2 * 24 + e3;
		return BigInt(enc_c + csize * enc_e);
	}

	const moves = [[]]; //, Move.parse("L R'"), Move.parse("L' R"), Move.parse("L2 R2")]
	const solved_states = moves.map((move: Move[]) => new CubieCube().apply(move));

	//const moveset : Move[] = ["U", "U2", "U'", "F", "F2", "F'", "R", "R2", "R'",
	//"r", "r2", "r'", "D", "D2", "D'", "M", "M'", "M2", "B", "B'", "B2"].map(s => Move.all[s])

	const moveset = htm_rwm;

	return [
		fbdrPrunerConfigGen(max_depth),
		{
			size,
			encode: is_front ? encode_front : encode_back,
			solved_states,
			max_depth,
			moveset,
			name: 'liness-' + (is_front ? 'front' : 'back')
		}
	];
};

// let fbssPrunerConfigsAuto = (is_front: boolean) => [
//     prunerFactory({
//         corner: is_front ? [I,I,I,I,S,S,I,S]: [I,I,I,I,S,S,S,I],
//         edge:   [I,I,I,I,I,I,I,I,I,I,I,I],
//         center: [I,I,I,I,I,I],
//         solved_states: ["id"],
//         moveset: htm_rwm,
//         max_depth: 5,
//         name: "fbss-corner"
//     }),
//     prunerFactory({
//         corner: [I,I,I,I,I,I,I,I],
//         edge:   [I,I,I,I,I,S,I,S,S,S,is_front ? I : S,is_front ? S : I],
//         center: [I,I,I,I,I,I],
//         solved_states: ["id"],
//         moveset: htm_rwm,
//         max_depth: 5,
//         name: "fbss-edge"
//     }),
// ]

const fbssPrunerConfigs = fbssPrunerConfigsManual;

const lsePrunerConfig: PrunerConfig = (function () {
	const size = (Math.pow(12, 6) * 4 * 4) / 2; // TODO: optimize this plz
	const edge_encode = [0, 1, 2, 3, 4, -1, 5, -1, -1, -1, -1, -1];
	function encode(cube: CubieCube) {
		const enc = [0, 0, 0, 0, 0, 0];
		for (let i = 0; i < 12; i++) {
			const idx = edge_encode[cube.ep[i]];
			if (idx > 0) {
				enc[idx] = edge_encode[i] * 2 + cube.eo[i];
			}
		}
		let edge_enc = 0;
		for (let i = 0; i < 6; i++) {
			edge_enc = edge_enc * 12 + enc[i];
		}
		return BigInt(edge_enc * 4 * 4 + cube.tp[0] * 4 + cube.cp[0]); // center[0] and cp[0] must be (0-3)
	}

	const moves = [Move.all['id']];
	const solved_states = moves.map((m) => new CubieCube().apply(m));

	const max_depth = 7;
	const moveset = ['U', "U'", 'U2', "M'", 'M', 'M2'];

	return {
		size,
		encode,
		solved_states,
		max_depth,
		moveset,
		name: 'lse'
	};
})();

function eolrPrunerConfig(center_flag: number, barbie_mode?: string): PrunerConfig {
	const size = 6 * 6 * Math.pow(2, 6) * 4 * 2; // TODO: optimize this plz

	const edge_encode = [0, 1, 0, 2, 0, -1, 0, -1, -1, -1, -1, -1];
	const edge_idx = [0, 1, 2, 3, 4, -1, 5, -1, -1, -1, -1, -1];
	function encode(cube: CubieCube) {
		let eo = 0,
			ep = 0;
		for (let i = 0; i < 12; i++) {
			const idx = edge_encode[cube.ep[i]];
			if (idx >= 0) {
				eo = eo * 2 + cube.eo[i];
			}
			if (idx > 0) {
				ep += Math.pow(6, idx - 1) * edge_idx[i];
			}
		}
		// make no distinction between centers M2 apart
		return BigInt((eo * 36 + ep) * 4 * 2 + ~~(cube.tp[0] / 2) * 4 + cube.cp[0]); // center[0] and cp[0] must be (0-3)
	}

	const moves_ac = cartesianProduct(["U'", 'U'], ['M2'], ['', 'U', "U'", 'U2']).map((x) =>
		x.join(' ')
	);
	const moves_mc = cartesianProduct(["M'"], ['U', "U'"], ['M2'], ['', 'U', "U'", 'U2']).map((x) =>
		x.join(' ')
	);
	let moves: string[] = [];
	if (center_flag & 0x01) moves = moves.concat(moves_ac);
	if (center_flag & 0x10) moves = moves.concat(moves_mc);

	const barb_moves_ac = ['U', "U'"];
	const barb_moves_mc = ['M U', "M U'"];
	let barb_moves: string[] = [];
	if (center_flag & 0x01) barb_moves = barb_moves.concat(barb_moves_ac);
	if (center_flag & 0x10) barb_moves = barb_moves.concat(barb_moves_mc);

	const pre_moves = barbie_mode === 'barbie' ? barb_moves : barbie_mode === 'ab4c' ? ['id'] : moves;

	const solved_states = pre_moves.map((m) => new CubieCube().apply(m));

	const max_depth = 20;
	const moveset = ['U', "U'", 'U2', "M'", 'M', 'M2'];

	return {
		size,
		encode,
		solved_states,
		max_depth,
		moveset,
		name: 'eolr-' + center_flag + '-' + barbie_mode
	};
}

export {
	fbdrPrunerConfig,
	fsPrunerConfig,
	sbPrunerConfig,
	ssPrunerConfig,
	ssDpPrunerConfig,
	fbPrunerConfig,
	lsePrunerConfig,
	eolrPrunerConfig,
	prunerFactory,
	fbssPrunerConfigs,
	lpSbPrunerConfigs
};
