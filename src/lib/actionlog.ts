import firebase from '$lib/firebase';
import type { AnyAction } from '@reduxjs/toolkit';
import {
	addDoc,
	collection,
	query,
	onSnapshot,
	orderBy,
	serverTimestamp
} from 'firebase/firestore';
import { store } from '$lib/store';
import type { Unsubscribe } from 'firebase/auth';

export async function create(type: string, uid: string) {
	const c = collection(firebase.firestore, type);
	return addDoc(c, { creator: uid });
}

export async function dispatch(type: string, id: string, uid: string, action: AnyAction) {
	const actions = collection(firebase.firestore, type, id, 'actions');
	return addDoc(actions, { ...action, timestamp: serverTimestamp(), creator: uid }).catch(
		(message) => {
			console.error(message);
		}
	);
}

const watching: { [k: string]: Unsubscribe } = {};
export async function watchAll(type: string) {
	const documents = collection(firebase.firestore, type);
	return onSnapshot(
		query(documents),
		(querySnapshot) => {
			querySnapshot.docChanges().forEach(async (change) => {
				if (change.type === 'added' || (change.type === 'modified' && change.doc)) {
					const docId = change.doc.id;
					if (watching[docId]) {
						watching[docId]();
					}
					watching[docId] = await watch(type, docId);
				}
			});
		},
		(error) => {
			console.log('watch all query failing: ');
			console.error(error);
		}
	);
}

export async function watch(type: string, id: string) {
	const actions = collection(firebase.firestore, type, id, 'actions');
	return onSnapshot(
		query(actions, orderBy('timestamp')),
		{ includeMetadataChanges: true },
		(querySnapshot) => {
			querySnapshot.docChanges().forEach((change) => {
				if (change.type === 'added' || (change.type === 'modified' && change.doc)) {
					let doc = change.doc;
					let action = doc.data() as any;
					if (action.timestamp) {
						//console.log('server side action: ', action);
						delete action.timestamp;
						store.dispatch(action);
					} else {
						//console.log('Ignore local echo for consistency', action);
					}
				}
			});
		},
		(error) => {
			console.log('actions query failing: ');
			console.error(error);
		}
	);
}
