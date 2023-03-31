import { Cursor } from "./cursor";
import { Token, TokenType } from "./token";

export class Lexer {
  private cursor: Cursor<string>;

  constructor(text: string) {
    this.cursor = new Cursor(text.trim().split(""));
  }

  public tokenize() {
    const tokens: Token[] = [];

    while (this.cursor.isOpen()) {
      const token = this.getNextToken();
      tokens.push(token);
    }

    return tokens;
  }

  private getNextToken(): Token {
    while (this.cursor.isOpen() && [" ", "\n"].includes(this.cursor.current)) {
      this.cursor.consume();
    }

    const initial = this.cursor.consume();

    if (Lexer.isLetter(initial)) {
      let value = initial;
      while (
        Lexer.isLetter(this.cursor.current) ||
        Lexer.isDigit(this.cursor.current)
      ) {
        value += this.cursor.consume();
      }

      const keywordType = Lexer.getKeywordType(value);
      if (keywordType) {
        return { type: keywordType };
      }

      return { type: TokenType.IDENTIFIER, value };
    }

    if (Lexer.isDigit(initial)) {
      let value = initial;
      while (Lexer.isDigit(this.cursor.current)) {
        value += this.cursor.consume();
      }
      return { type: TokenType.CONSTANT, value: +value };
    }

    if (initial === "=") {
      return { type: TokenType.EQUAL };
    }

    if (initial === "<") {
      if (this.cursor.current === "=") {
        this.cursor.consume();
        return { type: TokenType.LESS_THAN_OR_EQUAL };
      }

      if (this.cursor.current === ">") {
        this.cursor.consume();
        return { type: TokenType.NOT_EQUAL };
      }

      return { type: TokenType.LESS_THAN };
    }

    if (initial === ">") {
      if (this.cursor.current === "=") {
        this.cursor.consume();
        return { type: TokenType.GREATER_THAN_OR_EQUAL };
      }

      return { type: TokenType.GREATER_THAN };
    }

    if (initial === "+") {
      return { type: TokenType.ADD };
    }

    if (initial === "-") {
      return { type: TokenType.SUBTRACT };
    }

    if (initial === "*") {
      return { type: TokenType.MULTIPLY };
    }

    if (initial === "/") {
      return { type: TokenType.DIVIDE };
    }

    if (initial === ":") {
      if (this.cursor.current === "=") {
        this.cursor.consume();
        return { type: TokenType.ASSIGN };
      }

      throw new Error("Invalid character: " + initial);
    }

    if (initial === "(") {
      return { type: TokenType.LEFT_PARENTHESES };
    }

    if (initial === ")") {
      return { type: TokenType.RIGHT_PARENTHESES };
    }

    if (initial === ";") {
      return { type: TokenType.SEMICOLON };
    }

    throw new Error("Invalid character: " + initial);
  }

  private static isLetter(character: string) {
    return /^[a-z]$/i.test(character);
  }

  private static isDigit(character: string) {
    return /^\d$/.test(character);
  }

  private static getKeywordType(text: string) {
    switch (text.toLowerCase()) {
      case "begin":
        return TokenType.BEGIN;
      case "end":
        return TokenType.END;
      case "integer":
        return TokenType.INTEGER;
      case "if":
        return TokenType.IF;
      case "then":
        return TokenType.THEN;
      case "else":
        return TokenType.ELSE;
      case "function":
        return TokenType.FUNCTION;
      case "read":
        return TokenType.READ;
      case "write":
        return TokenType.WRITE;
      default:
        return undefined;
    }
  }
}
