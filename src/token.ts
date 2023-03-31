export enum TokenType {
  BEGIN = 1,
  END,
  INTEGER,
  IF,
  THEN,
  ELSE,
  FUNCTION,
  READ,
  WRITE,
  IDENTIFIER,
  CONSTANT,
  EQUAL,
  NOT_EQUAL,
  LESS_THAN_OR_EQUAL,
  LESS_THAN,
  GREATER_THAN_OR_EQUAL,
  GREATER_THAN,
  ADD,
  SUBTRACT,
  MULTIPLY,
  DIVIDE,
  ASSIGN,
  LEFT_PARENTHESES,
  RIGHT_PARENTHESES,
  SEMICOLON,
}

export type Token =
  | {
      type: TokenType.IDENTIFIER;
      value: string;
    }
  | {
      type: TokenType.CONSTANT;
      value: number;
    }
  | {
      type: Exclude<TokenType, TokenType.IDENTIFIER | TokenType.CONSTANT>;
    };
