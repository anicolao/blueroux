<script>
	import firebase from '$lib/firebase';
	import { store } from '$lib/store';
	import Button, { Label } from '@smui/button';
	import { Actions } from '@smui/card';
	import { setDoc, doc } from 'firebase/firestore';
	import Avatar from '$lib/components/Avatar.svelte';

	const auth = firebase.auth;
	const gAuthProvider = firebase.google_auth_provider;
	import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
	import { error, signed_in, signed_out } from './auth';
	onAuthStateChanged(auth, (user) => {
		if (user) {
			store.dispatch(
				signed_in({
					uid: user.uid,
					name: user.displayName,
					email: user.email,
					photo: user.photoURL,
					signedIn: true,
					authMessage: ''
				})
			);
			if (user.email) {
				// always true
				setDoc(doc(firebase.firestore, 'users', user.email), {
					uid: user.uid,
					name: user.displayName,
					email: user.email,
					photo: user.photoURL,
					activity_timestamp: new Date().getTime()
				}).catch((message) => {
					// TODO: Surface this error state in the UI.
					console.error(message);
				});
			}
		} else {
			store.dispatch(signed_out());
		}
	});

	function signin() {
		signInWithPopup(auth, gAuthProvider).catch((message) => {
			store.dispatch(error(message));
		});
	}
	function signout() {
		signOut(auth).catch((message) => {
			store.dispatch(error(message));
		});
	}
</script>

{#if $store.auth.signedIn !== true}
	<Actions fullBleed>
		<Button on:click={signin}>
			<Label>Sign In</Label>
			<i class="material-icons" aria-hidden="true">arrow_forward</i>
		</Button>
	</Actions>
{:else}
	<div class="row">
		<div class="column">
			<Avatar />
		</div>
		<div class="column">
			<p>{$store.auth.name}</p>
			<p>{$store.auth.email}</p>
		</div>
		<div class="column">
			<Button on:click={signout} variant="raised">Sign Out</Button>
		</div>
	</div>
{/if}

<style>
	.row {
		display: flex;
		flex-direction: row;
	}

	.column {
		display: flex;
		flex-direction: column;
		padding: 0.5em;
		justify-content: center;
	}

	p {
		margin: 0;
		padding: 0;
		margin-left: 1em;
		margin-right: 4em;
	}
</style>
