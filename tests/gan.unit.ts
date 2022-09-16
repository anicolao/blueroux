import { expect } from 'chai';
import { afterEach, describe, it, vi } from 'vitest';

import {
	getRawKey,
	getDecryptor,
	isProtocolEncrypted,
	GANCube
} from '$lib/bluetooth/gan/gan356i_v1';
import { Alg } from 'cubing/alg';
import { cube3x3x3 } from 'cubing/puzzles';

describe('GAN 356i', async () => {
	const kpuzzle = await cube3x3x3.kpuzzle();
	afterEach(() => {
		//vi.restoreAllMocks();
	});
	vi.mock('$lib/bluetooth/bluetooth', () => {
		const read = vi.fn();
		read.mockImplementationOnce(async () => new Uint8Array([1, 1, 3, 0, 0, 0]));
		read.mockImplementationOnce(async () => new Uint8Array([1, 1, 3, 0, 0, 0]));
		read.mockImplementationOnce(async () => new Uint8Array([1, 1, 3, 0, 0, 0]));
		read.mockImplementationOnce(async () => new Uint8Array([1, 1, 3, 0, 0, 0]));
		read.mockImplementationOnce(async () => new Uint8Array([29, 230, 8, 2, 48, 248]));
		read.mockImplementationOnce(async () => new Uint8Array([1, 1, 3, 0, 0, 0]));
		read.mockImplementationOnce(async () => new Uint8Array([1, 1, 3, 0, 0, 0]));
		//read.mockImplementation(async () => new Uint8Array([0,0,0,0,0,0]));
		return { read };
	});

	const dummyDevice = {
		id: 'GAN-deadf'
	};
	it('can version detect encryption', async () => {
		expect(await isProtocolEncrypted(dummyDevice)).to.be.true;
		expect((await getRawKey(dummyDevice))[0]).to.equal(67);
		const data = [
			146, 17, 135, 158, 63, 167, 219, 182, 126, 195, 156, 223, 254, 223, 79, 35, 248, 165, 28
		];
		const decrypted = [151, 6, 211, 255, 40, 63, 0, 0, 0, 1, 0, 0, 20, 3, 3, 6, 17, 0, 2];
		const data2 = [
			103, 183, 193, 78, 207, 56, 247, 255, 85, 164, 177, 231, 54, 122, 227, 248, 160, 71, 51
		];
		const decrypted2 = [139, 6, 208, 255, 41, 63, 0, 0, 0, 1, 0, 0, 20, 3, 3, 6, 17, 0, 2];
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		vi.stubGlobal('crypto', require('node:crypto').webcrypto);
		const decrypt = await getDecryptor(dummyDevice);
		const t1 = await decrypt(new Uint8Array(data));
		for (let i = 0; i < decrypted.length; ++i) {
			expect(t1[i]).to.equal(decrypted[i]);
		}
		const t2 = await decrypt(new Uint8Array(data2));
		for (let i = 0; i < decrypted.length; ++i) {
			expect(t2[i]).to.equal(decrypted2[i]);
		}
	});

	it('can stringify the version', async () => {
		const cube = new GANCube(dummyDevice);
		expect(await cube.getVersionAsString()).to.equal('1.1.3');
	});

	interface TestCase {
		from: number;
		to: string;
		afterRotations?: Alg;
	}

	function validateTransform({ from, to, afterRotations }: TestCase) {
		const startState = kpuzzle.startState();
		const state = afterRotations ? startState.applyAlg(afterRotations) : startState;
		const newMove = GANCube.colorToFaceMove(from, state.stateData);
		expect(newMove).to.equal(to);
	}

	// after an X rotation , ULFRBD <- FLDRUB
	const faceCases = [
		{ face: 0x06, originalFace: 'F', expectedFace: 'U' },
		{ face: 0x0c, originalFace: 'L', expectedFace: 'L' },
		{ face: 0x09, originalFace: 'D', expectedFace: 'F' },
		{ face: 0x03, originalFace: 'R', expectedFace: 'R' },
		{ face: 0x05, originalFace: "R'", expectedFace: "R'" },
		{ face: 0x00, originalFace: 'U', expectedFace: 'B' },
		{ face: 0x0f, originalFace: 'B', expectedFace: 'D' },
		{ face: 0x26, originalFace: 'z', expectedFace: 'z' }
	];
	for (const { face, originalFace, expectedFace } of faceCases) {
		it(`should not touch '${face}' moves`, () => {
			validateTransform({ from: face, to: originalFace });
		});

		it(`should modify '${face}' to '${expectedFace}' moves with x rotation`, () => {
			validateTransform({
				from: face,
				to: expectedFace,
				afterRotations: new Alg('x')
			});
		});
	}

	it('should throw an error on unexpected faces', () => {
		expect(() => validateTransform({ from: 0x42, to: 'M' })).to.throw(
			'Cannot read properties of undefined'
		);
	});

	describe('validate rotation', () => {
		it('call updateOrientation and validate', () => {
			const ganCube = new GANCube(dummyDevice);
			ganCube.setTrackingRotations(true);
			// we think this rotation goes from WG -> YG
			const homeState = new Uint8Array([
				0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 140, 12, 6, 6, 6, 5, 3
			]);
			ganCube.updateOrientation(homeState);
			expect(ganCube.getFacing()).to.equal('WG');
			const array = new Uint8Array([
				0x0, 0x0, 0, 0x40, 0, 0, 0, 0, 0, 0, 0, 0, 140, 12, 6, 6, 6, 5, 3
			]);
			// eslint-disable-next-line @typescript-eslint/no-empty-function
			const nullcallback = () => {};
			ganCube.handleMoves(array, nullcallback);
			expect(ganCube.getFacing()).to.equal('YG');
		});

		const facingToQuaterions: { [key: string]: [number, number, number] } = {
			WG: [0, 0, 0],
			WR: [0, -Math.sqrt(2) / 2, 0],
			WB: [0, -1, 0],
			WO: [0, Math.sqrt(2) / 2, 0], // negatives
			OG: [Math.sqrt(2) / 2, 0, 0], // negs
			OW: [0.5, -0.5, 0.5],
			OB: [0, Math.sqrt(2) / 2, -Math.sqrt(2) / 2],
			OY: [0.5, 0.5, -0.5],
			YG: [1, 0, 0],
			YO: [Math.sqrt(2) / 2, 0, Math.sqrt(2) / 2],
			YB: [0, 0, 1],
			YR: [-Math.sqrt(2) / 2, 0, Math.sqrt(2) / 2],
			RG: [-Math.sqrt(2) / 2, 0, 0],
			RY: [-0.5, -0.5, -0.5],
			RB: [0, -Math.sqrt(2) / 2, -Math.sqrt(2) / 2],
			RW: [-0.5, 0.5, 0.5], // negs
			GY: [0, 0, -Math.sqrt(2) / 2], // negs
			GR: [0.5, -0.5, -0.5], // negs
			GW: [-Math.sqrt(2) / 2, Math.sqrt(2) / 2, 0],
			GO: [-0.5, 0.5, -0.5],
			BW: [0, 0, Math.sqrt(2) / 2], // negs
			BR: [-0.5, -0.5, 0.5], // negs
			BY: [Math.sqrt(2) / 2, Math.sqrt(2) / 2, 0],
			BO: [0.5, 0.5, 0.5]
		};

		function quatToInvertedBytes(q: [number, number, number]) {
			const x = q[0];
			const y = q[1];
			const z = q[2];
			const max = 16384;
			return [-z, -x, y]
				.map((q) => Math.floor(q * max))
				.map((x) => [x & 0x00ff, (x & 0x00ff00) >> 8])
				.flat();
		}

		function encodeFacing(facing: string) {
			return quatToInvertedBytes(facingToQuaterions[facing]);
		}

		it('call updateOrientation for two moves and validate', () => {
			const ganCube = new GANCube(dummyDevice);
			ganCube.setTrackingRotations(true); //? [0,0.5,Math.sqrt(2)/2].map(x => Math.floor(x*16384))
			const homeState = new Uint8Array([
				0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 140, 12, 6, 6, 6, 5, 3
			]);
			// eslint-disable-next-line @typescript-eslint/no-empty-function
			const nullcallback = () => {};
			ganCube.updateOrientation(homeState);
			expect(ganCube.getFacing()).to.equal('WG');
			const tail = [0, 0, 0, 0, 0, 0, 140, 12, 6, 6, 6, 5, 3];
			const array = new Uint8Array([...encodeFacing('GO'), ...tail]);
			ganCube.handleMoves(array, nullcallback);
			expect(ganCube.getFacing()).to.equal('GO');
		});

		function orientationTest({ from, to }: { [k: string]: string }) {
			it(`handles from WG to ${from} to ${to}`, () => {
				const ganCube = new GANCube(dummyDevice);
				ganCube.setTrackingRotations(true);
				// set up WG.
				const homeState = new Uint8Array([
					0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 140, 12, 6, 6, 6, 5, 3
				]);
				// eslint-disable-next-line @typescript-eslint/no-empty-function
				const nullcallback = () => {};
				ganCube.updateOrientation(homeState);
				expect(ganCube.getFacing()).to.equal('WG');
				const tail = [0, 0, 0, 0, 0, 0, 140, 12, 6, 6, 6, 5, 3];
				const array = new Uint8Array([...encodeFacing(from), ...tail]);
				ganCube.handleMoves(array, nullcallback);
				expect(ganCube.getFacing()).to.equal(from);
				const move2 = new Uint8Array([...encodeFacing(to), ...tail]);
				ganCube.handleMoves(move2, nullcallback);
				expect(ganCube.getFacing()).to.equal(to);
			});
		}
		const facings = Object.keys(facingToQuaterions);
		facings.forEach((f1) => {
			facings.forEach((f2) => {
				if (f1 !== f2) {
					orientationTest({ from: f1, to: f2 });
				}
			});
		});

		it('ignores orientation by default', () => {
			const ganCube = new GANCube(dummyDevice);
			// we think this rotation goes from WG -> YG
			const homeState = new Uint8Array([
				0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 140, 12, 6, 6, 6, 5, 3
			]);
			const fail = () => {
				expect(true).to.be.false;
			};
			ganCube.handleMoves(homeState, fail);
			expect(ganCube.getFacing()).to.equal('WG');
			const array = new Uint8Array([
				0x0, 0x0, 0, 0x40, 0, 0, 0, 0, 0, 0, 0, 0, 140, 12, 6, 6, 6, 5, 3
			]);
			ganCube.handleMoves(array, fail);
			expect(ganCube.getFacing()).to.equal('WG');
			ganCube.handleMoves(homeState, fail);
			expect(ganCube.getFacing()).to.equal('WG');
			ganCube.handleMoves(array, fail);
			expect(ganCube.getFacing()).to.equal('WG');
		});

		function moveTest(numMoves: number) {
			it(`handles from ${numMoves} consecutive moves`, () => {
				const ganCube = new GANCube(dummyDevice);
				ganCube.setTrackingRotations(true);
				const homeState = new Uint8Array([
					0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 253, 12, 6, 6, 6, 5, 3
				]);
				let count = 0;
				const countcallback = () => {
					count++;
				};
				ganCube.handleMoves(homeState, countcallback);
				expect(count).to.equal(0);
				homeState[12] += numMoves;
				homeState[12] %= 256;
				ganCube.handleMoves(homeState, countcallback);
				expect(count).to.equal(Math.min(numMoves, 6));
			});
		}
		for (let i = 0; i < 9; ++i) {
			moveTest(i);
		}
	});
});