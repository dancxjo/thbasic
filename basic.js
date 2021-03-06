function tokenize(str) {
	var tokens = [];
	var patterns = {				
		stringLiteral: '"(.+?)"',		
		word: '([A-Za-z][A-Za-z_0-9]*[$%!#]?)',
		num: '([0-9]+(\.[0-9]+)?([eE]([+-]?[0-9]+))?)',
		whitespace: '( |\s)+'
	};
	for (var i = 0; i < str.length; i++) {
		var matched = false;
		for (var p in patterns) {
			var pattern = new RegExp("^(" + patterns[p] + ")");
			var matches = str.substring(i).match(pattern);			
			if (matches) {
				if (p != "whitespace") {
					tokens.push({type: p, value: matches[2]});
				}
				i += matches[0].length - 1;				
				matched = true;
				break;
			}
		}
		if (!matched) {
			tokens.push({type: "other", value: str[i]});
		}
	}
	return tokens;
}

var statementPatterns = [
	[/^cls$/i, function (context) {
		context.clear();
	}],
	[/^if\s+(.+?)\s+then\s+(.+?)(\s+else\s+(.+?))?$/i, function (context) {
		var condition = this.matches[1];
		var statement = this.matches[2];		
		var otherwise = this.matches[4];
		if (context.evaluate(condition)) {
			var s = new Statement(statement);
			s.execute(context);
			console.log("TRUE: ");
		} else {
			if (otherwise) {
				var s = new Statement(otherwise);
				s.execute(context);
			}
			console.log("FALSE: ");
		}
		console.log(condition);
	}],
	[/^for\s+(.+?)\s*=\s*(.+?)\s+to\s+(.+?)(\s+step\s+(.+?))?$/i, function (context) {
		var variable = this.matches[1];
		if (!context.loops[variable]) {
			// Initialize the loop
			var start = context.evaluate(this.matches[2]);
			var end = context.evaluate(this.matches[3]);
			var step = 1;
			if (this.matches[5])
				step = context.evaluate(this.matches[5]);			
			context.setVar(variable, start);
			context.loops[variable] = {headLine: context.ln, start: start, end: end, step: step};
		} else {
			// Sanity check
			if (context.loops[variable].headLine != context.ln) {
				throw "FOR loop nested inside FOR loop on same variable on line " + context.ln;
			} else {
				// Continue the loop				
				context.setVar(variable, context.variables[variable] + context.loops[variable].step);
			}
		}
	}],
	[/^next\s+(.+?)$/i, function (context) {
		var variable = this.matches[1];
		if (!context.loops[variable]) {
			throw "NEXT without FOR on line " + context.ln;
		} else {
			var loop = context.loops[variable];
			var val = context.evaluate(variable);
			if ((loop.step > 0 && val < loop.end) || (val > loop.end)) {
				context.ln = loop.headLine;
			}
		}
	}],
	[/^goto\s+(.+)$/i, function (context) {
		context.callstack.push(context.ln);
		context.ln = context.evaluate(this.matches[1]);
	}],
	[/^print(\s+(.*?))?$/i, function (context) {		
		var params = tokenize(this.matches[2]);		
		console.log(params);
		var dangling = false;
		for (var i in params) {
			var param = params[i];
			if (param.type == "other" && param.value == ",") {
				// Tab to next column
				dangling = true;
			} else if (param.type == "other" && param.value == ";") {
				// Just keep going
				dangling = true;
			} else {
				var v = param.value;
				if (param.type == "word") {
					v = context.evaluate(param.value);
				}				
				console.log(v);
				//context.print((isNumber(v)?v>=0?" ":"":"") + v + isNumber(v)?" ":"");
				context.print(v);
				dangling = false;
			}			
		}
		if (!dangling) {
			context.print("\n");
		}
	}],
	[/^input\s+(.+?),\s*(.+?)$/i, function (context) {
		var variable = this.matches[2];
		var input = prompt(context.evaluate(this.matches[1]));
		context.setVar(variable, input); 
	}],
	[/^(let\s+)?(.+?)\s*=\s*(.+?)$/i, function (context) {
		context.setVar(this.matches[2], context.evaluate(this.matches[3]));
	}],
	[/^end$/i, function (context) {
		context.terminated = true;
	}],
];

function Statement(text) {
	this.text = text;
	this.execute = function (context) { 
		context.output.innerHTML += "Unknown command on line " + context.ln + "\n";/*throw "Unknown command";*/ 
	};
	this.parse();
}


Statement.prototype.parse = function () {
	for (var pn in statementPatterns) {
		var sPat = statementPatterns[pn];
		var pattern = sPat[0];
		var execute = sPat[1];
		var matches = this.text.match(pattern);
		if (matches) {
			this.matches = matches;
			this.execute = execute;
			break;
		}
	}
}

function Program(text) {
	this.lines = [];
	this.variables = [];
	this.loops = [];
	this.callstack = [];
	if (text) {
		this.parse(text);
	}
}

Program.prototype.clear = function () {
	this.output.innerHTML = "";
}

Program.prototype.print = function (stuff) {
	this.output.innerHTML += stuff;
}

function isNumber(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}

Program.prototype.setVar = function (variable, value) {
	if (variable.indexOf("$") > -1) {
		/*
		if (isNumber(value)) {
			throw "Type mismatch on line " + this.ln;
		}
		*/
	} else {
		if (!isNumber(value)) {
			throw "Type mismatch on line " + this.ln;
		}
	}
	
	this.variables[variable] = value;
	console.log(this.variables);
}

Program.prototype.parse = function (text) {
	var rawLines = text.split("\n");
	for (var ln in rawLines) {
		var rawLine = rawLines[ln];
		if (rawLine) {
			//var parsedLine = tokenize(rawLine);
			var parsedLine = rawLine.match(/^\s*(\d+)\s+(.+?)\s*$/i);
			if (!parsedLine) {
				throw "Could not parse line: '" + rawLine + "'"; 
			} else {				
				this.lines[parsedLine[1]] = new Statement(parsedLine[2]); 
			}
		}
	}
}

Program.prototype.getCurrentLine = function () {
	return this.lines[this.ln];
}

Program.prototype.evaluate = function (expression) {
	var matches;
	if (matches = expression.match(/^[A-Z_][A-Z_0-9]*[$%!#]?$/i)) {
		console.log("Variable " + expression);
		return this.variables[expression];
	} else if (matches = expression.match(/^"(.*?)"$/i)) {
		console.log("String literal " + expression);
		return matches[1];
	} else if (matches = expression.match(/^(.+?)\s*AND\s*(.+?)$/i)) {
		console.log("AND " + expression);
		return this.evaluate(matches[1]) && this.evaluate(matches[2]);
	} else if (matches = expression.match(/^(.+?)\s*OR\s*(.+?)$/i)) {
		console.log("OR " + expression);
		return this.evaluate(matches[1]) || this.evaluate(matches[2]);
	} else if (matches = expression.match(/^(.+?)\s*\=\s*(.+?)$/i)) {
		console.log("== " + expression);
		return this.evaluate(matches[1]) == this.evaluate(matches[2]);
	} else if (matches = expression.match(/^(.+?)\s*\>\s*(.+?)$/i)) {
		console.log("> " + expression);
		return this.evaluate(matches[1]) > this.evaluate(matches[2]);
	} else if (matches = expression.match(/^(.+?)\s*\<\s*(.+?)$/i)) {
		console.log("< " + expression);
		return this.evaluate(matches[1]) < this.evaluate(matches[2]);
	} else if (matches = expression.match(/^(.+?)\s*\>=\s*(.+?)$/i)) {
		console.log(">= " + expression);
		return this.evaluate(matches[1]) >= this.evaluate(matches[2]);
	} else if (matches = expression.match(/^(.+?)\s*\<=\s*(.+?)$/i)) {
		console.log("<= " + expression);
		return this.evaluate(matches[1]) <= this.evaluate(matches[2]);
	} else if (matches = expression.match(/^(.+?)\s*\<>\s*(.+?)$/i)) {
		console.log("!= " + expression);
		return this.evaluate(matches[1]) != this.evaluate(matches[2]);
	} else if (matches = expression.match(/^(.+?)\s*\/\s*(.+?)$/i)) {
		console.log("/ " + expression);
		return this.evaluate(matches[1]) / this.evaluate(matches[2]);
	} else if (matches = expression.match(/^(.+?)\s*\*\s*(.+?)$/i)) {
		console.log("* " + expression);
		return this.evaluate(matches[1]) * this.evaluate(matches[2]);
	} else if (matches = expression.match(/^(.+?)\s*\-\s*(.+?)$/i)) {
		console.log("- " + expression);
		return this.evaluate(matches[1]) - this.evaluate(matches[2]);
	} else if (matches = expression.match(/^(.+?)\s*\+\s*(.+?)$/i)) {
		console.log("+ " + expression);
		return this.evaluate(matches[1]) + this.evaluate(matches[2]);
	} else if (matches = expression.match(/^"(.+?)"$/)) {
		return matches[1];
	} 
	
	return Number(expression);
}

Program.prototype.step = function () {
	var oldLn = this.ln;	
	var line = this.lines[this.ln];
	console.log("Executing line " + this.ln);
	line.execute(this);
	if (oldLn == this.ln) {
		this.nextLine();
	}
}

Program.prototype.nextLine = function () {	
	do {
		this.ln++;
	} while (this.ln < this.lines.length && this.lines[this.ln] == undefined);			
	
}

Program.prototype.execute = function (output) {
	this.output = output;			
	
	// Move to first line of code
	for (this.ln in this.lines) {
		break;
	}
	
	while (!this.terminated && this.ln < this.lines.length) {		
		this.step();
	}
}
