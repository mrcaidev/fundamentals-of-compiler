import { readFileSync } from "fs";
import { appendFile } from "fs/promises";
import { Cursor } from "./cursor";
import { Token, TokenType } from "./token";

export class Lexer {
  private line = 1;
  private cursor: Cursor<string>;

  constructor(sourceCodePath: string) {
    const sourceCode = Lexer.readSourceCode(sourceCodePath);
    this.cursor = new Cursor(sourceCode.trim().split(""));
  }

  public async tokenize() {
    while (this.cursor.isOpen()) {
      try {
        const token = this.getNextToken();
        await Lexer.logToken(token);
      } catch (error) {
        await Lexer.logError(error);
      }
    }

    await Lexer.logToken({ type: TokenType.END_OF_FILE, value: "EOF" });
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
      if (keywordType) {
        return { type: keywordType, value };
      }

      if (value.length > 16) {
        throw new Error(
          `Line ${this.line}: Identifier '${value}' exceeds 16 characters`
        );
      }

      return { type: TokenType.IDENTIFIER, value };
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

    throw new Error(`LINE ${this.line}: Invalid character '${initial}'`);
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

  private static readSourceCode(filePath: string) {
    const text = readFileSync(filePath, "utf-8");
    return text;
  }

  private static async logToken(token: Token) {
    const value = token.value.padStart(16);
    const type = token.type.toString().padStart(2, "0");
    await appendFile("dist/source.dyd", `${value} ${type}\n`, "utf-8");
  }

  private static async logError(error: unknown) {
    if (error instanceof Error) {
      await appendFile("dist/source.err", `${error.message}\n`, "utf-8");
      return;
    }

    throw error;
  }
}
