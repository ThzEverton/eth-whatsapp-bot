export class MessageDedup {
  private entries = new Map<string, number>();
  constructor(
    private limit = 10000,
    private ttl = 300000,
  ) {}
  seen(key: string, now = Date.now()): boolean {
    for (const [k, t] of this.entries) {
      if (t > now) break;
      this.entries.delete(k);
    }
    if (this.entries.has(key)) return true;
    this.entries.set(key, now + this.ttl);
    while (this.entries.size > this.limit)
      this.entries.delete(this.entries.keys().next().value!);
    return false;
  }
}
