const rand_int = (r: number) => {
	return Math.floor(Math.random() * r);
};

const rand_incl = (l: number, r: number) => {
	return rand_int(r - l + 1) + l;
};
const rand_choice = function <T>(arr: T[]) {
	return arr[rand_int(arr.length)];
};

const rand_shuffle = function <T>(arr: T[]) {
	for (let i = 0, l = arr.length; i < l - 1; i++) {
		const j = rand_incl(i, l - 1);
		const tmp = arr[i];
		arr[i] = arr[j];
		arr[j] = tmp;
	}
	return arr;
};

function cartesianProduct<T>(...allEntries: T[][]): T[][] {
	return allEntries.reduce<T[][]>(
		(results, entries) =>
			results
				.map((result) => entries.map((entry) => result.concat([entry])))
				.reduce((subResults, result) => subResults.concat(result), []),
		[[]]
	);
}

const getParity = (perm: number[]) => {
	const visited = Array(perm.length).fill(false);
	const follow = (i: number, cnt: number): number => {
		if (visited[i]) {
			return 0;
		} else {
			visited[i] = 1;
			if (visited[perm[i]]) {
				return cnt;
			} else return follow(perm[i], cnt + 1);
		}
	};
	let res = 0;
	for (const x of perm) {
		res += follow(x, 0);
	}
	return res;
};

const arrayEqual = function <T>(arr1: T[], arr2: T[]) {
	if (arr1.length !== arr2.length) return false;
	for (let i = 0; i < arr1.length; i++) {
		if (arr1[i] !== arr2[i]) return false;
	}
	return true;
};

const encodeArr = function (base: number, rarr: number[]) {
	let int = 0;
	for (let i = rarr.length - 1; i >= 0; i--) int = rarr[i] + int * base;
	return int;
};

export { rand_int, rand_choice, rand_shuffle, getParity, arrayEqual, encodeArr, cartesianProduct };
