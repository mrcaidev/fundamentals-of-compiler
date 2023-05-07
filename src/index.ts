import { Lexer } from "./lexer";
import { Parser } from "./parser";

async function main() {
  const lexer = new Lexer();
  const success = lexer.tokenize();

  if (!success) {
    console.warn("Quitting early as lexer has failed.");
  }

  await new Promise((resolve) => setTimeout(resolve, 10));

  const parser = new Parser();
  parser.parse();
}

main();
