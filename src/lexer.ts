import { createReadStream, createWriteStream } from "fs";
import { createInterface } from "readline/promises";
import { Cursor } from "./cursor";
import { Token, TokenType } from "./token";

export class Lexer {
  private line = 1;
  private cursor: Cursor<string> = new Cursor([]);

  constructor(private readonly sourceCodePath: string) {}

  public async tokenize() {
    const readableStream = createReadStream(this.sourceCodePath, "utf-8");
    const logTokenStream = createWriteStream("dist/source.dyd", "utf-8");
    const logErrorStream = createWriteStream("dist/source.err", "utf-8");
    const rl = createInterface({ input: readableStream });

    rl.on("line", (line) => {
      this.cursor = new Cursor(line.trim().split(""));

      while (this.cursor.isOpen()) {
        try {
          const token = this.getNextToken();
          logTokenStream.write(Lexer.formatToken(token));
        } catch (error) {
          if (error instanceof Error) {
            logErrorStream.write(`${error.message}\n`);
          } else {
            throw error;
          }
        }
      }

      const endOfLineToken = { type: TokenType.END_OF_LINE, value: "EOLN" };
      logTokenStream.write(Lexer.formatToken(endOfLineToken));

      this.line++;
    });

    rl.on("close", async () => {
      const endOfFileToken = { type: TokenType.END_OF_FILE, value: "EOF" };
      logTokenStream.write(Lexer.formatToken(endOfFileToken));

      logTokenStream.close();
      logErrorStream.close();
    });
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

  private static formatToken(token: Token) {
    const value = token.value.padStart(16);
    const type = token.type.toString().padStart(2, "0");
    return `${value} ${type}\n`;
  }
}
