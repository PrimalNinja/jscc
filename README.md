# JSCC - JavaScript Cross Compiler

JSCC is a cross compiler for the JavaScript language that supports a small subset of the JavaScript keywords.  It is NOT able to parse itself, however code developed within it, could very well run inside a browser also.

The project started as an experiment and a few good feedbacks so far might be enough for this project to continue.

The infix to postfix logic is ok and it uses the shunting algorithm - still to be more thoroughly tested though.  Code generation currently is Z80, but it was only a POC, and will likely become more modular to support different target platforms.

- Julian
