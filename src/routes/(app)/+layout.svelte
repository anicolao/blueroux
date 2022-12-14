<script lang="ts">
	import { goto } from '$app/navigation';
	/* app bar */
	import type TopAppBarComponentDev from '@smui/top-app-bar';
	import TopAppBar, { Row, Section, AutoAdjust, Title } from '@smui/top-app-bar';
	import IconButton from '@smui/icon-button';
	import Avatar from '$lib/components/Avatar.svelte';
	import Login from '$lib/components/Login.svelte';
	import Pair from '$lib/components/Pair.svelte';
	import Card, { Content as CardContent, Actions } from '@smui/card';
	import Button, { Label } from '@smui/button';
	import { store } from '$lib/store';
	import { override } from '$lib/components/cubes';

	let topAppBar: TopAppBarComponentDev;

	/* drawer */
	import Drawer, { AppContent, Content, Header, Subtitle, Scrim } from '@smui/drawer';
	import List, { Item, Text, Graphic, Separator, Subheader } from '@smui/list';
	import { navigate_to } from '$lib/components/nav';
	import {
		collection,
		collectionGroup,
		onSnapshot,
		orderBy,
		query,
		setDoc,
		where,
		type Unsubscribe
	} from 'firebase/firestore';
	import firebase from '$lib/firebase';
	import { add_scramble, add_solve } from '$lib/components/solves';
	import type { AnyAction } from '@reduxjs/toolkit';

	$: open = width > 720;
	$: active = $store.nav.active.split('/')[0];

	function setActive(value: string) {
		store.dispatch(navigate_to(value));
		open = false || width > 720;
		goto('/' + value);
	}

	let width = 0;

	const i18n: { [key: string]: string } = {
		unknown: 'Unknown',
		timer: 'Speed Solving',
		trending_down: 'Efficient Solving',
		history_edu: 'Solve Analysis',
		analysis: 'Solve Analysis',
		school: 'Roux Academy',
		account_circle: 'Profile',
		mask_editor: 'Method Editor',
		bluetooth: 'Cubes'
	};
	const icons: { [key: string]: string } = {
		analysis: 'history_edu',
		mask_editor: 'edit'
	};
	function getIconName(s: string) {
		if (icons[s]) return icons[s];
		return s;
	}
	function textLookup(key: string) {
		return i18n[key];
	}

	let loading = true;

	let unsubSolves: Unsubscribe | undefined;
	let unsubScrambles: Unsubscribe | undefined;
	let unsubActions: Unsubscribe | undefined;

	$: if ($store.auth.signedIn && !unsubSolves) {
		if (!unsubScrambles) {
			const scrambles = collection(firebase.firestore, 'scrambles');
			unsubScrambles = onSnapshot(query(scrambles, orderBy('timestamp')), (querySnapshot) => {
				querySnapshot.docChanges().forEach((change) => {
					if (change.type === 'added') {
						let doc = change.doc;
						store.dispatch(add_scramble({ scramble: doc.data().setup, id: doc.id }));
					}
				});
			});
		}

		if ($store.auth.uid && !unsubSolves) {
			// always true
			const solves = collectionGroup(firebase.firestore, 'solves');
			unsubSolves = onSnapshot(
				query(solves, where('creator', '==', $store.auth.uid), orderBy('timestamp')),
				(querySnapshot) => {
					querySnapshot.docChanges().forEach((change) => {
						if (change.type === 'added') {
							let doc = change.doc;
							store.dispatch(
								add_solve({
									solveId: doc.id,
									scramble: doc.data().scramble,
									moves: doc.data().moves,
									time: doc.data().time
								})
							);
							if (!doc.data().solveId) {
								console.log('solveId missing for ', doc.id);
								const newData = { ...doc.data(), solveId: doc.id };
								setDoc(doc.ref, newData);
							}
						}
					});
				},
				(error) => {
					console.log('solves query failing: ');
					console.error(error);
				}
			);
		}
		if ($store.auth.uid && !unsubActions) {
			const actions = collectionGroup(firebase.firestore, 'requests');
			unsubSolves = onSnapshot(
				query(actions, where('target', '==', $store.auth.uid), orderBy('timestamp')),
				(querySnapshot) => {
					querySnapshot.docChanges().forEach((change) => {
						if (change.type === 'added') {
							let doc = change.doc;
							let action = doc.data() as AnyAction;
							delete action.timestamp;
							store.dispatch(action);
						}
					});
				},
				(error) => {
					console.log('actions query failing: ');
					console.error(error);
				}
			);
		}
	}

	$: if (unsubSolves && !$store.auth.signedIn) {
		unsubSolves();
		unsubSolves = undefined;
	}

	$: if (unsubScrambles && !$store.auth.signedIn) {
		unsubScrambles();
		unsubScrambles = undefined;
	}
</script>

<svelte:window bind:innerWidth={width} />

{#if loading || $store.auth.signedIn === undefined}
	<h2>Loading ...</h2>
	<div style="display: none"><Pair /><Login />{(loading = false)}</div>
{:else if !$store.auth.signedIn}
	<div class="card-display">
		<div class="card-container">
			<Card>
				{#if !$store.cubes.bluetoothSupported && !$store.cubes.overrideUsingCubes}
					<CardContent>
						<h2>Blue Roux</h2>
						<p>Make the most of your bluetooth cube as you master the Roux speedsolving method.</p>
						<p>
							Your web browser doesn't support bluetooth. Try using Google Chrome or installing the
							app version of blueroux.
						</p>
					</CardContent>
					<Actions fullBleed>
						<Button on:click={() => store.dispatch(override(true))}>
							<Label>Ignore and continue</Label>
							<i class="material-icons" aria-hidden="true">arrow_forward</i>
						</Button>
					</Actions>
				{:else}
					<CardContent>
						<h2>Blue Roux</h2>
						<p>Make the most of your bluetooth cube as you master the Roux speedsolving method.</p>
						<p>Sign in with Google to proceed.</p>
					</CardContent>
					<Login />
				{/if}
			</Card>
		</div>
	</div>
{:else}
	<div class="drawer-container">
		<TopAppBar bind:this={topAppBar} variant="fixed">
			<Row>
				<div class={width > 720 ? 'desk-margin' : 'mobile-margin'}>
					<Section>
						{#if width <= 720}
							<IconButton class="material-icons" on:click={() => (open = !open || width > 720)}
								>menu</IconButton
							>
						{:else}
							<IconButton class="material-icons" on:click={() => (open = !open || width > 720)}
								>{getIconName(active)}</IconButton
							>
						{/if}
						<Title>{textLookup(active)}</Title>
					</Section>
				</div>
				<Section align="end" toolbar>
					<IconButton
						class="material-icons"
						aria-label="Connect Cube"
						on:click={() => setActive('bluetooth')}>settings_bluetooth</IconButton
					>
					<span on:click={() => setActive('account_circle')}><Avatar /></span>
				</Section>
			</Row>
		</TopAppBar>

		<AutoAdjust {topAppBar} />

		<Drawer
			variant={width > 720 ? undefined : 'modal'}
			fixed={width > 720 ? undefined : false}
			bind:open
		>
			<Header>
				<Title>Blue Roux</Title>
				<Subtitle>Bluetooth training FTW</Subtitle>
			</Header>
			<Content>
				<List>
					<Item
						href="javascript:void(0)"
						on:click={() => setActive('timer')}
						activated={active === 'timer'}
					>
						<Graphic class="material-icons" aria-hidden="true">{getIconName('timer')}</Graphic>
						<Text>{textLookup('timer')}</Text>
					</Item>
					<Item
						href="javascript:void(0)"
						on:click={() => setActive('trending_down')}
						activated={active === 'trending_down'}
					>
						<Graphic class="material-icons" aria-hidden="true"
							>{getIconName('trending_down')}</Graphic
						>
						<Text>{textLookup('trending_down')}</Text>
					</Item>
					<Item
						href="javascript:void(0)"
						on:click={() => setActive('history_edu')}
						activated={active === 'history_edu'}
					>
						<Graphic class="material-icons" aria-hidden="true">{getIconName('history_edu')}</Graphic
						>
						<Text>{textLookup('history_edu')}</Text>
					</Item>
					<Item
						href="javascript:void(0)"
						on:click={() => setActive('school')}
						activated={active === 'school'}
					>
						<Graphic class="material-icons" aria-hidden="true">{getIconName('school')}</Graphic>
						<Text>{textLookup('school')}</Text>
					</Item>
					<Item
						href="javascript:void(0)"
						on:click={() => setActive('mask_editor')}
						activated={active === 'mask_editor'}
					>
						<Graphic class="material-icons" aria-hidden="true">{getIconName('mask_editor')}</Graphic
						>
						<Text>{textLookup('mask_editor')}</Text>
					</Item>

					<Separator />
					<Subheader>Settings</Subheader>
					<Item
						href="javascript:void(0)"
						on:click={() => setActive('account_circle')}
						activated={active === 'account_circle'}
					>
						<Graphic class="material-icons" aria-hidden="true"
							>{getIconName('account_circle')}</Graphic
						>
						<Text>{textLookup('account_circle')}</Text>
					</Item>
					<Item
						href="javascript:void(0)"
						on:click={() => setActive('bluetooth')}
						activated={active === 'bluetooth'}
					>
						<Graphic class="material-icons" aria-hidden="true">{getIconName('bluetooth')}</Graphic>
						<Text>{textLookup('bluetooth')}</Text>
					</Item>
				</List>
			</Content>
		</Drawer>

		<Scrim fixed={false} />
		<AppContent class="app-content">
			<slot />
		</AppContent>
	</div>
{/if}

<style>
	/* Hide everything above this component. */
	:global(app),
	:global(body),
	:global(html) {
		display: block !important;
		height: auto !important;
		width: auto !important;
		position: static !important;
		margin: 0;
		padding: 0;
	}

	.drawer-container {
		position: relative;
		display: flex;
		height: 100vh;
		max-width: 100vw;
		border: 1px solid var(--mdc-theme-text-hint-on-background, rgba(0, 0, 0, 0.1));
		overflow: hidden;
		z-index: 0;
		flex-grow: 1;
	}

	* :global(.app-content) {
		flex: auto;
		overflow: auto;
		position: relative;
		flex-grow: 1;

		margin-top: 64px;
		display: flex;
		padding: 0.5em;
	}

	.mobile-margin {
		margin-left: 0;
	}
	.desk-margin {
		margin-left: 256px;
	}

	.card-display {
		margin: 25%;
		margin-top: 5%;
	}

	p {
		padding-top: 0.5em;
	}

	h2 {
		font-family: 'Roboto', sans-serif;
		font-size: large;
	}
</style>
