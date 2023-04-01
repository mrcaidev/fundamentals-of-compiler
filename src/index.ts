import { Lexer } from "./lexer";

async function lex() {
  const lexer = new Lexer("input/source.pas");
  await lexer.tokenize();
}

lex();
