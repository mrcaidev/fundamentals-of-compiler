import { readFileSync, writeFileSync } from "fs";
import { Cursor } from "./cursor";
import { Token, TokenType, tokenTranslation } from "./token";

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
  private shouldAddError = true;

  private tokens: Token[] = [];
  private variables: Variable[] = [];
  private procedures: Procedure[] = [];
  private errors: string[] = [];

  private cursor: Cursor<Token>;

  constructor() {
    this.cursor = new Cursor(Parser.readTokens());
  }

  public parse() {
    try {
      this.parseProgram();
      return this.errors.length === 0;
    } catch (error) {
      if (error instanceof Error) {
        this.errors.push(error.message + " [FATAL]");
      }
      return false;
    } finally {
      Parser.writeTokens(this.tokens);
      Parser.writeVariables(this.variables);
      Parser.writeProcedures(this.procedures);
      Parser.writeErrors(this.errors);
    }
  }

  private parseProgram() {
    this.parseSubprogram();
    this.match(TokenType.END_OF_FILE);
  }

  private parseSubprogram() {
    this.match(TokenType.BEGIN);
    this.parseDeclarations();
    this.parseExecutions();
    this.match(TokenType.END);
  }

  private parseDeclarations() {
    this.parseDeclaration();
    this.parseDeclarations_();
  }

  private parseDeclarations_() {
    if (this.hasType(TokenType.INTEGER)) {
      this.parseDeclaration();
      this.parseDeclarations_();
    }
  }

  private parseDeclaration() {
    this.match(TokenType.INTEGER);
    this.parseDeclaration_();
    this.match(TokenType.SEMICOLON);
  }

  private parseDeclaration_() {
    if (this.hasType(TokenType.IDENTIFIER)) {
      this.parseVariableDeclaration();
      return;
    }

    if (this.hasType(TokenType.FUNCTION)) {
      this.parseProcedureDeclaration();
      return;
    }

    this.throwError(
      `'${this.cursor.current.value}' is not a valid variable name`
    );
  }

  private parseVariableDeclaration() {
    const { value } = this.match(
      TokenType.IDENTIFIER,
      `${this.cursor.current.value} is not a valid variable name`
    );

    const existingVariable = this.variables.find(
      (variable) =>
        variable.name === value &&
        variable.kind === 0 &&
        variable.procedure === this.procedureStack[0]
    );
    if (existingVariable) {
      this.addError(`Variable '${value}' has already been declared`);
      return;
    }

    this.variables.push({
      name: value,
      procedure: this.procedureStack[0] ?? "",
      kind: 0,
      type: "integer",
      level: this.currentLevel,
      address: ++this.currentVariableAddress,
    });
  }

  private parseVariable() {
    const { value } = this.match(
      TokenType.IDENTIFIER,
      `'${this.cursor.current.value}' is not a valid variable name`
    );

    const variable = this.findVariable(value);
    if (!variable) {
      this.addError(`Undefined variable '${value}'`);
    }
  }

  private parseProcedureDeclaration() {
    this.match(TokenType.FUNCTION);

    const { value } = this.match(
      TokenType.IDENTIFIER,
      `'${this.cursor.current.value}' is not a valid procedure name`
    );

    const existingProcedure = this.procedures.find(
      (procedure) =>
        procedure.name === value && procedure.level === this.currentLevel + 1
    );
    if (existingProcedure) {
      this.addError(`Procedure '${value}' has already been declared`);
    }

    const procedure = {
      name: value,
      type: "integer",
      level: this.currentLevel + 1,
      firstVariableAddress: 0,
      lastVariableAddress: 0,
    };
    this.procedures.push(procedure);
    this.procedureStack.unshift(value);

    this.match(TokenType.LEFT_PARENTHESES);
    this.parseParameterDeclaration();
    this.match(TokenType.RIGHT_PARENTHESES);
    this.match(TokenType.SEMICOLON);

    procedure.firstVariableAddress = this.currentVariableAddress + 1;
    this.parseProcedureBody();
    procedure.lastVariableAddress = this.currentVariableAddress;
  }

  private parseProcedure() {
    const { value } = this.match(
      TokenType.IDENTIFIER,
      `'${this.cursor.current.value}' is not a valid procedure name`
    );

    const procedure = this.findProcedure(value);
    if (!procedure) {
      this.addError(`Undefined procedure '${value}'`);
    }
  }

  private parseParameterDeclaration() {
    const { value } = this.match(
      TokenType.IDENTIFIER,
      `'${this.cursor.current.value}' is not a valid parameter name`
    );

    const existingParameter = this.variables.find(
      (variable) =>
        variable.name === value &&
        variable.kind === 1 &&
        variable.procedure === this.procedureStack[0]
    );
    if (existingParameter) {
      this.addError(`Parameter '${value}' has already been declared`);
      return;
    }

    this.variables.push({
      name: value,
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
    if (this.hasType(TokenType.SEMICOLON)) {
      this.match(TokenType.SEMICOLON);
      this.parseExecution();
      this.parseExecutions_();
    }
  }

  private parseExecution() {
    if (this.hasType(TokenType.READ)) {
      this.parseRead();
      return;
    }

    if (this.hasType(TokenType.WRITE)) {
      this.parseWrite();
      return;
    }

    if (this.hasType(TokenType.IDENTIFIER)) {
      this.parseAssignment();
      return;
    }

    if (this.hasType(TokenType.IF)) {
      this.parseCondition();
      return;
    }

    this.throwError(
      `Expect executions, but got '${this.cursor.current.value}'. Please move all declarations to the beginning of the procedure`
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
    const variable = this.findVariable(this.cursor.current.value);
    if (variable) {
      this.parseVariable();
      this.match(TokenType.ASSIGN);
      this.parseArithmeticExpression();
      return;
    }

    const procedure = this.findProcedure(this.cursor.current.value);
    if (procedure) {
      this.parseProcedure();
      this.match(TokenType.ASSIGN);
      this.parseArithmeticExpression();
      return;
    }

    this.throwError(
      `Undefined variable or procedure '${this.cursor.current.value}'`
    );
  }

  private parseArithmeticExpression() {
    this.parseTerm();
    this.parseArithmeticExpression_();
  }

  private parseArithmeticExpression_() {
    if (this.hasType(TokenType.SUBTRACT)) {
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
    if (this.hasType(TokenType.MULTIPLY)) {
      this.match(TokenType.MULTIPLY);
      this.parseFactor();
      this.parseTerm_();
    }
  }

  private parseFactor() {
    if (this.hasType(TokenType.CONSTANT)) {
      this.match(TokenType.CONSTANT);
      return;
    }

    if (this.hasType(TokenType.IDENTIFIER)) {
      const variable = this.findVariable(this.cursor.current.value);
      if (variable) {
        this.parseVariable();
        return;
      }

      const procedure = this.findProcedure(this.cursor.current.value);
      if (procedure) {
        this.parseProcedureCall();
        return;
      }

      this.throwError(
        `Undefined variable or procedure '${this.cursor.current.value}'`
      );
    }

    this.throwError(
      `Expect variable or constant, but got '${this.cursor.current.value}'`
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
    if (this.hasType(TokenType.EQUAL)) {
      this.match(TokenType.EQUAL);
      return;
    }

    if (this.hasType(TokenType.NOT_EQUAL)) {
      this.match(TokenType.NOT_EQUAL);
      return;
    }

    if (this.hasType(TokenType.LESS_THAN)) {
      this.match(TokenType.LESS_THAN);
      return;
    }

    if (this.hasType(TokenType.LESS_THAN_OR_EQUAL)) {
      this.match(TokenType.LESS_THAN_OR_EQUAL);
      return;
    }

    if (this.hasType(TokenType.GREATER_THAN)) {
      this.match(TokenType.GREATER_THAN);
      return;
    }

    if (this.hasType(TokenType.GREATER_THAN_OR_EQUAL)) {
      this.match(TokenType.GREATER_THAN_OR_EQUAL);
      return;
    }

    const { value } = this.consumeToken();
    this.addError(`${value} is not a valid operator`);
  }

  private hasType(expectation: TokenType) {
    return expectation === this.cursor.current.type;
  }

  private match(expectation: TokenType, message?: string) {
    if (!this.hasType(expectation)) {
      this.addError(
        message ??
          `Expect ${tokenTranslation[expectation]}, but got '${this.cursor.current.value}'`
      );
    }

    return this.consumeToken();
  }

  private consumeToken() {
    this.goToNextLine();
    const token = this.cursor.consume();
    this.tokens.push(token);
    this.goToNextLine();
    return token;
  }

  private throwError(error: string) {
    throw new Error(`Line ${this.line}: ${error}`);
  }

  private addError(error: string) {
    if (!this.shouldAddError) {
      return;
    }

    this.shouldAddError = false;
    this.errors.push(`Line ${this.line}: ${error}`);
  }

  private goToNextLine() {
    while (this.cursor.isOpen() && this.hasType(TokenType.END_OF_LINE)) {
      const token = this.cursor.consume();
      this.tokens.push(token);
      this.line++;
      this.shouldAddError = true;
    }
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

  private static readTokens() {
    const text = readFileSync("output/source.dyd").toString().trim();

    const tokens: Token[] = [];

    for (const line of text.split("\n")) {
      const [value, type] = line.trim().split(" ");

      if (!type || !value) {
        continue;
      }

      tokens.push({ type: +type, value });
    }

    return tokens;
  }

  private static writeTokens(tokens: Token[]) {
    const text = tokens
      .map((token) => {
        const { type, value } = token;
        return [value.padStart(16), type.toString().padStart(2, "0")].join(" ");
      })
      .join("\n");
    writeFileSync("output/source.dys", text);
  }

  private static writeVariables(variables: Variable[]) {
    const text = variables
      .map((variable) => {
        const { name, procedure, kind, type, level, address } = variable;
        return [
          name.padStart(16),
          procedure.padStart(16),
          kind,
          type,
          level,
          address,
        ].join(" ");
      })
      .join("\n");
    writeFileSync("output/source.var", text);
  }

  private static writeProcedures(procedures: Procedure[]) {
    const text = procedures
      .map((procedure) => {
        const { name, type, level, firstVariableAddress, lastVariableAddress } =
          procedure;
        return [
          name.padStart(16),
          type,
          level,
          firstVariableAddress,
          lastVariableAddress,
        ].join(" ");
      })
      .join("\n");
    writeFileSync("output/source.pro", text);
  }

  private static writeErrors(errors: string[]) {
    const text = errors.join("\n");
    writeFileSync("output/source.err", text);
  }
}
