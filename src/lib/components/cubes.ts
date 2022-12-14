import * as toolkitRaw from '@reduxjs/toolkit';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { createAction, createReducer } = ((toolkitRaw as any).default ??
	toolkitRaw) as typeof toolkitRaw;

export type CubeInfo = [string, string, boolean];
export interface CubesState {
	bluetoothSupported: boolean;
	autoReconnectSupported: boolean;
	overrideUsingCubes: boolean;
	knownCubes: CubeInfo[];
	connectedDevice?: CubeInfo;
	cubeIdToVersionMap: { [key: string]: string };
	cubeIdToMDMap: { [key: string]: string };
}

export const bluetooth_supported = createAction<boolean>('bluetooth_supported');
export const reconnect_supported = createAction<boolean>('reconnect_supported');
export const known_cubes = createAction<[string, string, boolean][]>('known_cubes');
export const known_version = createAction<{ id: string; version: string }>('known_version');
export const known_md = createAction<{ id: string; data: string }>('known_md');
export const connect = createAction<[string, boolean]>('connect');
export const override = createAction<boolean>('override');

export const initialState = {
	bluetoothSupported: false,
	autoReconnectSupported: false,
	overrideUsingCubes: false,
	knownCubes: [],
	connectedDevice: undefined,
	cubeIdToVersionMap: {},
	cubeIdToMDMap: {}
} as CubesState;

export const cubes = createReducer(initialState, (r) => {
	r.addCase(known_cubes, (state, action) => {
		state.knownCubes = [...action.payload];
		return state;
	})
		.addCase(known_version, (state, action) => {
			state.cubeIdToVersionMap[action.payload.id] = action.payload.version;
			return state;
		})
		.addCase(known_md, (state, action) => {
			state.cubeIdToMDMap[action.payload.id] = action.payload.data;
			return state;
		})
		.addCase(connect, (state, action) => {
			const cubeId = action.payload[0];
			const connectedState = action.payload[1];
			const otherCubes = state.knownCubes.filter((x) => x[0] !== cubeId);
			const thisCube = state.knownCubes.filter((x) => x[0] === cubeId)[0];
			const info: CubeInfo = [thisCube[0], thisCube[1], connectedState];
			state.knownCubes = [...otherCubes, info];
			state.connectedDevice = info;
			return state;
		})
		.addCase(bluetooth_supported, (state, action) => {
			state.bluetoothSupported = action.payload;
			return state;
		})
		.addCase(reconnect_supported, (state, action) => {
			state.autoReconnectSupported = action.payload;
			return state;
		})
		.addCase(override, (state, action) => {
			state.overrideUsingCubes = action.payload;
			return state;
		});
});
