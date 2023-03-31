import { Lexer } from "./lexer";

const lexer = new Lexer(`
  a := 1 + 2;
  b := 3 + 4;
`);
console.log(lexer.tokenize());
