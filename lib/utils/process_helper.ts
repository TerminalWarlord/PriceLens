export async function processItemWithTimeout(
	fn: () => Promise<void>,
	timeout: number = 60000,
) {
	let timeoutId: NodeJS.Timeout;
	const cb = new Promise(
		(_, reject) =>
			(timeoutId = setTimeout(() => reject(new Error("Timed out")), timeout)),
	);
	const race = Promise.race([fn(), cb]);
	race.catch(() => {});
	return race.finally(() => {
		clearTimeout(timeoutId);
	});
}
