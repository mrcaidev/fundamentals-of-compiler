import { readFileSync, writeFileSync } from "fs";
import { Cursor } from "./cursor";
import { Token, TokenType } from "./token";

const MAX_IDENTIFIER_LENGTH = 16;

export class Lexer {
  private line = 1;
  private cursor: Cursor<string>;

  constructor() {
    this.cursor = new Cursor(Lexer.readSource());
  }

  public tokenize() {
    const tokens: Token[] = [];
    const errors: Error[] = [];

    while (this.cursor.isOpen()) {
      try {
        const token = this.getNextToken();
        tokens.push(token);
      } catch (error) {
        if (error instanceof Error) {
          errors.push(error);
          continue;
        }
        throw error;
      }
    }

    tokens.push({ type: TokenType.END_OF_FILE, value: "EOF" });

    Lexer.writeTokens(tokens);
    Lexer.writeErrors(errors);

    return errors.length === 0;
  }

  private getNextToken(): Token {
    while (this.cursor.current === " ") {
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
      if (keywordType !== undefined) {
        return { type: keywordType, value };
      }

      if (value.length <= MAX_IDENTIFIER_LENGTH) {
        return { type: TokenType.IDENTIFIER, value };
      }

      throw new Error(
        `Line ${this.line}: Identifier name '${value}' exceeds ${MAX_IDENTIFIER_LENGTH} characters`
      );
    }

    if (Lexer.isDigit(initial)) {
      let value = initial;
      while (Lexer.isDigit(this.cursor.current)) {
        value += this.cursor.consume();
      }
      return { type: TokenType.CONSTANT, value };
    }

    if (initial === "=") {
      return { type: TokenType.EQUAL, value: "=" };
    }

    if (initial === "-") {
      return { type: TokenType.SUBTRACT, value: "-" };
    }

    if (initial === "*") {
      return { type: TokenType.MULTIPLY, value: "*" };
    }

    if (initial === "(") {
      return { type: TokenType.LEFT_PARENTHESES, value: "(" };
    }

    if (initial === ")") {
      return { type: TokenType.RIGHT_PARENTHESES, value: ")" };
    }

    if (initial === "<") {
      if (this.cursor.current === "=") {
        this.cursor.consume();
        return { type: TokenType.LESS_THAN_OR_EQUAL, value: "<=" };
      }

      if (this.cursor.current === ">") {
        this.cursor.consume();
        return { type: TokenType.NOT_EQUAL, value: "<>" };
      }

      return { type: TokenType.LESS_THAN, value: "<" };
    }

    if (initial === ">") {
      if (this.cursor.current === "=") {
        this.cursor.consume();
        return { type: TokenType.GREATER_THAN_OR_EQUAL, value: ">=" };
      }

      return { type: TokenType.GREATER_THAN, value: ">" };
    }

    if (initial === ":") {
      if (this.cursor.current === "=") {
        this.cursor.consume();
        return { type: TokenType.ASSIGN, value: ":=" };
      }

      throw new Error(`Line ${this.line}: Misused colon`);
    }

    if (initial === ";") {
      return { type: TokenType.SEMICOLON, value: ";" };
    }

    if (initial === "\n") {
      this.line++;
      return { type: TokenType.END_OF_LINE, value: "EOLN" };
    }

    throw new Error(`Line ${this.line}: Invalid character '${initial}'`);
  }

  private static isLetter(value: string) {
    return /^[a-z]$/i.test(value);
  }

  private static isDigit(value: string) {
    return /^\d$/.test(value);
  }

  private static getKeywordType(value: string) {
    switch (value.toLowerCase()) {
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

  private static readSource() {
    return readFileSync("input/source.pas").toString().trim().split("");
  }

  private static writeTokens(tokens: Token[]) {
    const text = tokens
      .map((token) => {
        const value = token.value.padStart(16);
        const type = token.type.toString().padStart(2, "0");
        return `${value} ${type}`;
      })
      .join("\n");
    writeFileSync("output/source.dyd", text);
  }

  private static writeErrors(errors: Error[]) {
    const text = errors.map((error) => error.message).join("\n");
    writeFileSync("output/source.err", text);
  }
}
