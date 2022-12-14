import * as toolkitRaw from '@reduxjs/toolkit';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { configureStore } = ((toolkitRaw as any).default ?? toolkitRaw) as typeof toolkitRaw;
import { auth } from './components/auth';
import { cubes } from '$lib/components/cubes';
import { solves } from '$lib/components/solves';
import { nav } from '$lib/components/nav';
import type { Writable } from 'svelte/store';
import { methods } from './components/methods';
import { stages } from './components/stages';
import { preferences } from './components/preferences';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function svelteStoreEnhancer(createStoreApi: (arg0: any, arg1: any) => any) {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return function (reducer: any, initialState: any) {
		const reduxStore = createStoreApi(reducer, initialState);
		return {
			...reduxStore,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			subscribe(fn: (arg0: any) => void) {
				fn(reduxStore.getState());

				return reduxStore.subscribe(() => {
					fn(reduxStore.getState());
				});
			}
		};
	};
}

const reducer = {
	auth,
	cubes,
	nav,
	methods,
	stages,
	preferences,
	solves
};
const rawStore = configureStore({ reducer, enhancers: [svelteStoreEnhancer] });
export type ReduxStore = typeof rawStore;
export type GlobalState = ReturnType<typeof rawStore.getState>;
type SvelteStore = Writable<GlobalState>;

export const store = rawStore as ReduxStore & SvelteStore;
