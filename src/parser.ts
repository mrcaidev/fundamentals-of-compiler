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
  private errors: Error[] = [];

  private cursor: Cursor<Token>;

  constructor() {
    this.tokens = Parser.readTokens();
    this.cursor = new Cursor(this.tokens);
  }

  public parse() {
    this.parseProgram();

    Parser.writeTokens(this.tokens);
    Parser.writeVariables(this.variables);
    Parser.writeProcedures(this.procedures);
    Parser.writeErrors(this.errors);

    return this.errors.length === 0;
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

    this.addError(
      `'${this.cursor.current.value}' is not a valid variable name`
    );
  }

  private parseVariableDeclaration() {
    const name = this.match(
      TokenType.IDENTIFIER,
      `${this.cursor.current.value} is not a valid variable name`
    ).value;

    const existingVariable = this.variables.find(
      (variable) =>
        variable.name === name &&
        variable.kind === 0 &&
        variable.procedure === this.procedureStack[0]
    );
    if (existingVariable) {
      this.addError(`Variable '${name}' has already been declared`);
      return;
    }

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
    const name = this.match(
      TokenType.IDENTIFIER,
      `'${this.cursor.current.value}' is not a valid variable name`
    ).value;

    const variable = this.findVariable(name);
    if (!variable) {
      this.addError(`Undefined variable '${name}'`);
    }
  }

  private parseProcedureDeclaration() {
    this.match(TokenType.FUNCTION);

    const name = this.match(
      TokenType.IDENTIFIER,
      `'${this.cursor.current.value}' is not a valid procedure name`
    ).value;

    const existingProcedure = this.procedures.find(
      (procedure) =>
        procedure.name === name && procedure.level === this.currentLevel + 1
    );
    if (existingProcedure) {
      this.addError(`Procedure '${name}' has already been declared`);
    }

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
    const name = this.match(
      TokenType.IDENTIFIER,
      `'${this.cursor.current.value}' is not a valid procedure name`
    ).value;

    const procedure = this.findProcedure(name);
    if (!procedure) {
      this.addError(`Undefined procedure '${name}'`);
    }
  }

  private parseParameterDeclaration() {
    const name = this.match(
      TokenType.IDENTIFIER,
      `'${this.cursor.current.value}' is not a valid parameter name`
    ).value;

    const existingParameter = this.variables.find(
      (variable) =>
        variable.name === name &&
        variable.kind === 1 &&
        variable.procedure === this.procedureStack[0]
    );
    if (existingParameter) {
      this.addError(`Parameter '${name}' has already been declared`);
      return;
    }

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

    this.addError(
      "Expecting executions. Please move all declarations to the beginning of the procedure"
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

    this.addError(`Undefined variable or procedure '${name}'`);
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

      this.addError(`Undefined variable or procedure '${name}'`);
    }

    this.addError(
      "Arithmetic expression should only contain variables, constants and operators"
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

    this.addError(`${this.cursor.current.value} is not a valid operator`);
  }

  private hasType(expectation: TokenType) {
    if (Array.isArray(expectation)) {
      return expectation.includes(this.cursor.current.type);
    }
    return expectation === this.cursor.current.type;
  }

  private match(expectation: TokenType, message?: string) {
    if (!this.hasType(expectation)) {
      this.addError(
        message ??
          `Expecting ${tokenTranslation[expectation]} but got '${this.cursor.current.value}'`
      );
    }

    const token = this.cursor.consume();
    this.goToNextLine();
    return token;
  }

  private addError(message: string) {
    if (!this.shouldAddError) {
      return;
    }

    this.shouldAddError = false;
    this.errors.push(new Error(`Line ${this.line}: ${message}`));
  }

  private goToNextLine() {
    while (this.hasType(TokenType.END_OF_LINE)) {
      this.cursor.consume();
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

  private static writeErrors(errors: Error[]) {
    const text = errors.map((error) => error.message).join("\n");
    writeFileSync("output/source.err", text);
  }
}
