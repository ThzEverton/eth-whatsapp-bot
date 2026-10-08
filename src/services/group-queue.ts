export class GroupQueue {
  private tails = new Map<string, Promise<unknown>>();
  run<T>(id: string, task: () => Promise<T>): Promise<T> {
    const next = (this.tails.get(id) || Promise.resolve()).then(task, task);
    this.tails.set(id, next);
    void next
      .finally(() => {
        if (this.tails.get(id) === next) this.tails.delete(id);
      })
      .catch(() => {});
    return next;
  }
}
