import { readFileSync, writeFileSync } from "fs";
import { DYD_PATH, DYS_PATH, ERR_PATH, PRO_PATH, VAR_PATH } from "./config";
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
  private shouldAddError = true;

  private correctTokens: Token[] = [];
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
      Parser.writeCorrectTokens(this.correctTokens);
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

    const { value } = this.consumeToken();
    this.throwError(`'${value}' is not a valid variable name`);
  }

  private parseVariableDeclaration() {
    const { value } = this.match(TokenType.IDENTIFIER);
    this.registerVariable(value);
  }

  private parseVariable() {
    const { value } = this.match(TokenType.IDENTIFIER);

    if (!this.findVariable(value)) {
      this.addError(`Undefined variable '${value}'`);
    }
  }

  private parseProcedureDeclaration() {
    this.match(TokenType.FUNCTION);
    this.parseProcedureNameDeclaration();
    this.match(TokenType.LEFT_PARENTHESES);
    this.parseParameterDeclaration();
    this.match(TokenType.RIGHT_PARENTHESES, "Unmatched '('");
    this.match(TokenType.SEMICOLON);
    this.parseProcedureBody();
  }

  private parseProcedureNameDeclaration() {
    const { value } = this.match(TokenType.IDENTIFIER);
    this.registerProcedure(value);
  }

  private parseProcedureName() {
    const { value } = this.match(TokenType.IDENTIFIER);

    if (!this.findProcedure(value)) {
      this.addError(`Undefined procedure '${value}'`);
    }
  }

  private parseParameterDeclaration() {
    const { value } = this.match(TokenType.IDENTIFIER);
    this.registerParameter(value);
  }

  private parseProcedureBody() {
    this.currentLevel++;

    this.match(TokenType.BEGIN);
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

    const { value } = this.consumeToken();
    this.throwError(
      `Expect executions, but got '${value}'. Please move all declarations to the beginning of the procedure`
    );
  }

  private parseRead() {
    this.match(TokenType.READ);
    this.match(TokenType.LEFT_PARENTHESES);
    this.parseVariable();
    this.match(TokenType.RIGHT_PARENTHESES, "Unmatched '('");
  }

  private parseWrite() {
    this.match(TokenType.WRITE);
    this.match(TokenType.LEFT_PARENTHESES);
    this.parseVariable();
    this.match(TokenType.RIGHT_PARENTHESES, "Unmatched '('");
  }

  private parseAssignment() {
    if (this.hasVariable()) {
      this.parseVariable();
    } else if (this.hasProcedure()) {
      this.parseProcedureName();
    } else {
      const { value } = this.consumeToken();
      this.addError(`Undefined variable or procedure '${value}'`);
    }

    this.match(TokenType.ASSIGN);
    this.parseArithmeticExpression();
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
      if (this.hasVariable()) {
        this.parseVariable();
        return;
      }

      if (this.hasProcedure()) {
        this.parseProcedureCall();
        return;
      }

      const { value } = this.consumeToken();
      this.throwError(`Undefined variable or procedure '${value}'`);
    }

    const { value } = this.consumeToken();
    this.throwError(
      `Expect variable, procedure or constant, but got '${value}'`
    );
  }

  private parseProcedureCall() {
    this.parseProcedureName();
    this.match(TokenType.LEFT_PARENTHESES);
    this.parseArithmeticExpression();
    this.match(TokenType.RIGHT_PARENTHESES, "Unmatched '('");
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

  private registerVariable(name: string) {
    const duplicateVariable = this.findDuplicateVariable(name);

    if (duplicateVariable) {
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

    const procedure = this.findProcedure(this.procedureStack[0] ?? "");

    if (!procedure) {
      return;
    }

    if (procedure.firstVariableAddress === -1) {
      procedure.firstVariableAddress = this.currentVariableAddress;
    }

    procedure.lastVariableAddress = this.currentVariableAddress;
  }

  private findDuplicateVariable(name: string) {
    return this.variables.find(
      (variable) =>
        variable.name === name &&
        variable.kind === 0 &&
        variable.level === this.currentLevel
    );
  }

  private findVariable(name: string) {
    return this.variables.find(
      (variable) =>
        variable.name === name &&
        variable.kind === 0 &&
        variable.level <= this.currentLevel
    );
  }

  private registerParameter(name: string) {
    const duplicateParameter = this.findDuplicateParameter(name);

    if (duplicateParameter) {
      this.addError(`Parameter '${name}' has already been declared`);
      return;
    }

    this.variables.push({
      name,
      procedure: this.procedureStack[0] ?? "",
      kind: 1,
      type: "integer",
      level: this.currentLevel + 1,
      address: ++this.currentVariableAddress,
    });
  }

  private findDuplicateParameter(name: string) {
    return this.variables.find(
      (variable) =>
        variable.name === name &&
        variable.kind === 1 &&
        variable.level === this.currentLevel + 1
    );
  }

  private registerProcedure(name: string) {
    const duplicateProcedure = this.findDuplicateProcedure(name);

    if (duplicateProcedure) {
      this.addError(`Procedure '${name}' has already been declared`);
      return;
    }

    this.procedures.push({
      name,
      type: "integer",
      level: this.currentLevel + 1,
      firstVariableAddress: -1,
      lastVariableAddress: -1,
    });

    this.procedureStack.unshift(name);
  }

  private findDuplicateProcedure(name: string) {
    return this.procedures.find(
      (procedure) =>
        procedure.name === name && procedure.level === this.currentLevel + 1
    );
  }

  private findProcedure(name: string) {
    return this.procedures.find(
      (procedure) =>
        procedure.name === name && procedure.level <= this.currentLevel + 1
    );
  }

  private hasVariable() {
    return this.findVariable(this.cursor.current.value) !== undefined;
  }

  private hasProcedure() {
    return this.findProcedure(this.cursor.current.value) !== undefined;
  }

  private hasType(expectation: TokenType) {
    return expectation === this.cursor.current.type;
  }

  private match(expectation: TokenType, message?: string) {
    if (!this.hasType(expectation)) {
      this.addError(
        message ??
          `Expect ${Parser.translateToken(expectation)}, but got '${
            this.cursor.current.value
          }'`
      );
    }

    return this.consumeToken();
  }

  private consumeToken() {
    this.goToNextLine();
    const token = this.cursor.consume();
    this.correctTokens.push(token);
    this.goToNextLine();
    return token;
  }

  private goToNextLine() {
    while (this.cursor.isOpen() && this.hasType(TokenType.END_OF_LINE)) {
      const token = this.cursor.consume();
      this.correctTokens.push(token);
      this.line++;
      this.shouldAddError = true;
    }
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

  private static translateToken(type: TokenType) {
    const tokenTranslation = {
      [TokenType.BEGIN]: "'begin'",
      [TokenType.END]: "'end'",
      [TokenType.INTEGER]: "'integer'",
      [TokenType.IF]: "'if'",
      [TokenType.THEN]: "'then'",
      [TokenType.ELSE]: "'else'",
      [TokenType.FUNCTION]: "'function'",
      [TokenType.READ]: "'read'",
      [TokenType.WRITE]: "'write'",
      [TokenType.IDENTIFIER]: "identifier",
      [TokenType.CONSTANT]: "constant",
      [TokenType.EQUAL]: "'='",
      [TokenType.NOT_EQUAL]: "'<>'",
      [TokenType.LESS_THAN_OR_EQUAL]: "'<='",
      [TokenType.LESS_THAN]: "'<'",
      [TokenType.GREATER_THAN_OR_EQUAL]: "'>='",
      [TokenType.GREATER_THAN]: "'>'",
      [TokenType.SUBTRACT]: "'-'",
      [TokenType.MULTIPLY]: "'*'",
      [TokenType.ASSIGN]: "':='",
      [TokenType.LEFT_PARENTHESES]: "'('",
      [TokenType.RIGHT_PARENTHESES]: "')'",
      [TokenType.SEMICOLON]: "';'",
      [TokenType.END_OF_LINE]: "EOLN",
      [TokenType.END_OF_FILE]: "EOF",
    };
    return tokenTranslation[type];
  }

  private static readTokens() {
    const text = readFileSync(DYD_PATH).toString().trim();

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

  private static writeCorrectTokens(tokens: Token[]) {
    const text = tokens
      .map((token) => {
        const { type, value } = token;
        return [value.padStart(16), type.toString().padStart(2, "0")].join(" ");
      })
      .join("\n");
    writeFileSync(DYS_PATH, text);
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
    writeFileSync(VAR_PATH, text);
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
    writeFileSync(PRO_PATH, text);
  }

  private static writeErrors(errors: string[]) {
    const text = errors.join("\n");
    writeFileSync(ERR_PATH, text);
  }
}
