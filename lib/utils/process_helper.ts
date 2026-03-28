export function processItemWithTimeout(
	promise: Promise<void>,
	timeout: number = 10000,
) {
	const cb = new Promise((_, reject) =>
		setTimeout(() => reject(new Error("Timed out")), timeout),
	);
	return Promise.race([promise, cb]);
}
