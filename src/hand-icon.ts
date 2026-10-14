export const EMPTY_HAND_ICON = 12;

export class HandIconDeck {
  private regular: number[] = [];
  private lucky: number[] = [];
  private previous = -1;
  private key = '';
  private frame = EMPTY_HAND_ICON;
  private random: () => number;

  constructor(random: () => number = Math.random) { this.random = random; }

  update(throwId: number, hasFood: boolean, lucky: boolean): number {
    if (!hasFood) { this.key = ''; this.frame = EMPTY_HAND_ICON; return this.frame; }
    const key = `${throwId}:${lucky}`;
    if (this.key === key) return this.frame;
    this.key = key;
    const deck = lucky ? this.lucky : this.regular;
    if (deck.length === 0) {
      deck.push(...(lucky ? [10, 11] : Array.from({ length: 10 }, (_, index) => index)));
      for (let index = deck.length - 1; index > 0; index--) {
        const other = Math.floor(this.random() * (index + 1));
        [deck[index], deck[other]] = [deck[other], deck[index]];
      }
      if (deck.at(-1) === this.previous) [deck[0], deck[deck.length - 1]] = [deck[deck.length - 1], deck[0]];
    }
    this.frame = deck.pop()!;
    this.previous = this.frame;
    return this.frame;
  }
}
