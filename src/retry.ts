import { sleep } from './misc';

export default async function retry<Result>(action: () => Result | Promise<Result>, retries: number, delay = 100): Promise<Result> {
  try {
    return await action();
  } catch (e) {
    if (retries <= 0) throw e;
    await sleep(delay);
    return retry(action, retries - 1, delay * 10);
  }
}
