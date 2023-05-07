import { Lexer } from "./lexer";

const lexer = new Lexer();
const success = lexer.tokenize();

console.log(success);
