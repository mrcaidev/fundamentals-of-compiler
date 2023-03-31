export class Cursor<T> {
  private position = 0;

  constructor(private collection: T[]) {}

  public get current() {
    return this.collection[this.position] as T;
  }

  public consume() {
    const current = this.current;
    this.position++;
    return current;
  }

  public isOpen() {
    return this.position < this.collection.length;
  }
}
