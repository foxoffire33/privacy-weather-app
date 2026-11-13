export function fireAndForget(task: PromiseLike<unknown>): void {
  void Promise.allSettled([task]);
}
