import { createWriteStream, readFileSync } from "fs";
import { Cursor } from "./cursor";
import { Token, TokenType } from "./token";

type Variable = {
  name: string;
  procedure: string;
  kind: 0 | 1;
  type: string;
  level: number;
  address: number;
};

type Procedure = {
  name: string;
  type: string;
  level: number;
  firstVariableAddress: number;
  lastVariableAddress: number;
};

export class Parser {
  private line = 1;
  private procedureStack: string[] = ["main"];
  private currentLevel = 1;
  private currentVariableAddress = -1;
  private variables: Variable[] = [];
  private procedures: Procedure[] = [];
  private cursor: Cursor<Token>;

  constructor() {
    this.cursor = new Cursor(Parser.readDyd());
  }

  public parse() {
    this.parseProgram();
    this.writeVariables();
    this.writeProcedures();
  }

  private parseProgram() {
    this.parseSubprogram();
  }

  private parseSubprogram() {
    this.match(TokenType.BEGIN);
    this.parseDeclarations();
    this.parseExecutions();
    this.match(TokenType.END);
  }

  private parseDeclarations() {
    if (this.cursor.current.type === TokenType.INTEGER) {
      this.parseDeclaration();
      this.parseDeclarations();
    }
  }

  private parseDeclaration() {
    this.match(TokenType.INTEGER);
    this.parseDeclaration_();
    this.match(TokenType.SEMICOLON);
  }

  private parseDeclaration_() {
    if (this.cursor.current.type === TokenType.IDENTIFIER) {
      this.parseVariableDeclaration();
      return;
    }

    if (this.cursor.current.type === TokenType.FUNCTION) {
      this.parseProcedureDeclaration();
      return;
    }

    throw new Error(
      `Line ${this.line}: Unexpected token ${this.cursor.current.value}`
    );
  }

  private parseVariableDeclaration() {
    const name = this.match(TokenType.IDENTIFIER).value;

    this.variables.push({
      name,
      procedure: this.procedureStack[0] ?? "",
      kind: 0,
      type: "integer",
      level: this.currentLevel,
      address: ++this.currentVariableAddress,
    });
  }

  private parseVariable() {
    const name = this.match(TokenType.IDENTIFIER).value;

    const variable = this.findVariable(name);
    if (!variable) {
      throw new Error(`Line ${this.line}: Undefined variable ${name}`);
    }
  }

  private parseProcedureDeclaration() {
    this.match(TokenType.FUNCTION);

    const name = this.match(TokenType.IDENTIFIER).value;

    const procedure = {
      name,
      type: "integer",
      level: this.currentLevel + 1,
      firstVariableAddress: 0,
      lastVariableAddress: 0,
    };
    this.procedures.push(procedure);
    this.procedureStack.unshift(name);

    this.match(TokenType.LEFT_PARENTHESES);
    this.parseParameterDeclaration();
    this.match(TokenType.RIGHT_PARENTHESES);
    this.match(TokenType.SEMICOLON);

    procedure.firstVariableAddress = this.currentVariableAddress + 1;
    this.parseProcedureBody();
    procedure.lastVariableAddress = this.currentVariableAddress;
  }

  private parseProcedure() {
    const name = this.match(TokenType.IDENTIFIER).value;

    const procedure = this.findProcedure(name);
    if (!procedure) {
      throw new Error(`Line ${this.line}: Undefined procedure ${name}`);
    }
  }

  private parseParameterDeclaration() {
    const name = this.match(TokenType.IDENTIFIER).value;

    this.variables.push({
      name,
      procedure: this.procedureStack[0] ?? "",
      kind: 1,
      type: "integer",
      level: this.currentLevel,
      address: ++this.currentVariableAddress,
    });
  }

  private parseProcedureBody() {
    this.match(TokenType.BEGIN);
    this.currentLevel++;

    this.parseDeclarations();
    this.parseExecutions();

    this.match(TokenType.END);
    this.currentLevel--;
    this.procedureStack.shift();
  }

  private parseExecutions() {
    this.parseExecution();
    this.parseExecutions_();
  }

  private parseExecutions_() {
    if (this.cursor.current.type === TokenType.SEMICOLON) {
      this.match(TokenType.SEMICOLON);
      this.parseExecution();
      this.parseExecutions_();
    }
  }

  private parseExecution() {
    if (this.cursor.current.type === TokenType.READ) {
      this.parseRead();
      return;
    }

    if (this.cursor.current.type === TokenType.WRITE) {
      this.parseWrite();
      return;
    }

    if (this.cursor.current.type === TokenType.IDENTIFIER) {
      this.parseAssignment();
      return;
    }

    if (this.cursor.current.type === TokenType.IF) {
      this.parseCondition();
      return;
    }

    throw new Error(
      `Line ${this.line}: Unexpected token: ${this.cursor.current.value}`
    );
  }

  private parseRead() {
    this.match(TokenType.READ);
    this.match(TokenType.LEFT_PARENTHESES);
    this.parseVariable();
    this.match(TokenType.RIGHT_PARENTHESES);
  }

  private parseWrite() {
    this.match(TokenType.WRITE);
    this.match(TokenType.LEFT_PARENTHESES);
    this.parseVariable();
    this.match(TokenType.RIGHT_PARENTHESES);
  }

  private parseAssignment() {
    const name = this.cursor.current.value;

    const variable = this.findVariable(name);
    if (variable) {
      this.parseVariable();
      this.match(TokenType.ASSIGN);
      this.parseArithmeticExpression();
      return;
    }

    const procedure = this.findProcedure(name);
    if (procedure) {
      this.parseProcedure();
      this.match(TokenType.ASSIGN);
      this.parseArithmeticExpression();
      return;
    }

    throw new Error(`Line ${this.line}: Undefined identifier '${name}'`);
  }

  private parseArithmeticExpression() {
    this.parseTerm();
    this.parseArithmeticExpression_();
  }

  private parseArithmeticExpression_() {
    if (this.cursor.current.type === TokenType.SUBTRACT) {
      this.match(TokenType.SUBTRACT);
      this.parseTerm();
      this.parseArithmeticExpression_();
    }
  }

  private parseTerm() {
    this.parseFactor();
    this.parseTerm_();
  }

  private parseTerm_() {
    if (this.cursor.current.type === TokenType.MULTIPLY) {
      this.match(TokenType.MULTIPLY);
      this.parseFactor();
      this.parseTerm_();
    }
  }

  private parseFactor() {
    if (this.cursor.current.type === TokenType.CONSTANT) {
      this.match(TokenType.CONSTANT);
      return;
    }

    if (this.cursor.current.type === TokenType.IDENTIFIER) {
      const name = this.cursor.current.value;

      const variable = this.findVariable(name);
      if (variable) {
        this.parseVariable();
        return;
      }

      const procedure = this.findProcedure(name);
      if (procedure) {
        this.parseProcedureCall();
        return;
      }

      throw new Error(`Line ${this.line}: Unknown identifier '${name}'`);
    }

    throw new Error(
      `Line ${this.line}: Unexpected token ${this.cursor.current.value}`
    );
  }

  private parseProcedureCall() {
    this.parseProcedure();
    this.match(TokenType.LEFT_PARENTHESES);
    this.parseArithmeticExpression();
    this.match(TokenType.RIGHT_PARENTHESES);
  }

  private parseCondition() {
    this.match(TokenType.IF);
    this.parseConditionExpression();
    this.match(TokenType.THEN);
    this.parseExecution();
    this.match(TokenType.ELSE);
    this.parseExecution();
  }

  private parseConditionExpression() {
    this.parseArithmeticExpression();
    this.parseOperator();
    this.parseArithmeticExpression();
  }

  private parseOperator() {
    this.match([
      TokenType.EQUAL,
      TokenType.NOT_EQUAL,
      TokenType.LESS_THAN,
      TokenType.LESS_THAN_OR_EQUAL,
      TokenType.GREATER_THAN,
      TokenType.GREATER_THAN_OR_EQUAL,
    ]);
  }

  private match(expectation: TokenType | TokenType[]) {
    if (!Parser.isMatched(expectation, this.cursor.current.type)) {
      throw new Error(
        `Line ${this.line}: Unexpected token '${this.cursor.current.value}'`
      );
    }

    const token = this.cursor.consume();

    while (this.cursor.current.type === TokenType.END_OF_LINE) {
      this.cursor.consume();
      this.line++;
    }

    return token;
  }

  private static isMatched(
    expectation: TokenType | TokenType[],
    type: TokenType
  ) {
    if (Array.isArray(expectation)) {
      return expectation.includes(type);
    }
    return expectation === type;
  }

  private findVariable(name: string) {
    return this.variables.find(
      (variable) =>
        variable.name === name && variable.level <= this.currentLevel
    );
  }

  private findProcedure(name: string) {
    return this.procedures.find(
      (procedure) =>
        procedure.name === name && procedure.level - 1 <= this.currentLevel
    );
  }

  private static readDyd() {
    const source = readFileSync("output/source.dyd").toString();

    const tokens: Token[] = [];

    for (const line of source.split("\n")) {
      if (line === "") {
        continue;
      }

      const [value, type] = line.trim().split(" ");

      if (!type || !value) {
        throw new Error(`Invalid DYD format: ${line}`);
      }

      tokens.push({ type: +type, value });
    }

    return tokens;
  }

  private writeVariables() {
    const stream = createWriteStream("output/source.var");
    for (const variant of this.variables) {
      const { name, procedure, kind, type, level, address } = variant;
      stream.write(
        `${name.padStart(16)} ${procedure.padStart(
          16
        )} ${kind} ${type} ${level} ${address}\n`
      );
    }
  }

  private writeProcedures() {
    const stream = createWriteStream("output/source.pro");
    for (const procedure of this.procedures) {
      const { name, type, level, firstVariableAddress, lastVariableAddress } =
        procedure;
      stream.write(
        `${name.padStart(
          16
        )} ${type} ${level} ${firstVariableAddress} ${lastVariableAddress}\n`
      );
    }
  }
}
