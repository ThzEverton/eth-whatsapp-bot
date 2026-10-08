export class CooldownService {
  private times = new Map<string, number>();
  allow(key: string, ms: number, now = Date.now()) {
    for (const [k, t] of this.times) if (t <= now) this.times.delete(k);
    if ((this.times.get(key) || 0) > now) return false;
    this.times.set(key, now + ms);
    return true;
  }
  clear() {
    this.times.clear();
  }
}
