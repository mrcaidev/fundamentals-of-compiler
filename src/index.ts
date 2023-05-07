import { Lexer } from "./lexer";
import { Parser } from "./parser";

function main() {
  const lexer = new Lexer();
  const lexerSuccess = lexer.tokenize();

  if (!lexerSuccess) {
    console.error(
      "Compilation aborted due to lexer error. A complete log of this run can be found in: source.err"
    );
    return;
  }

  const parser = new Parser();
  const parserSuccess = parser.parse();

  if (!parserSuccess) {
    console.error(
      "Compilation aborted due to parser error. A complete log of this run can be found in: source.err"
    );
    return;
  }
}

main();
