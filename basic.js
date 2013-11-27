var statementPatterns = [
	[/^cls$/i, function (context) {
		context.clear();
	}],
	[/^if\s+(.+?)\s+then\s+(.+?)(\s+else\s+(.+?))?$/i, function (context) {
		var condition = this.matches[1];
		var statement = this.matches[2];		
		var otherwise = this.matches[3];
		if (context.evaluate(condition)) {
			var s = new Statement(statement);
			s.execute(context);
		} else {
			if (otherwise) {
				var s = new Statement(otherwise);
				s.execute(context);
			}
		}
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
			context.variables[variable] = start;
			context.loops[variable] = {headLine: context.ln, start: start, end: end, step: step};
		} else {
			// Sanity check
			if (context.loops[variable].headLine != context.ln) {
				throw "FOR loop nested inside FOR loop on same variable on line " + context.ln;
			} else {
				// Continue the loop
				context.variables[variable] += context.loops[variable].step;
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
			if (!(loop.start <= loop.end && val >= loop.end) && !(val <= loop.end)) {
				// return to for line
				context.ln = loop.headLine;
			}			
		}
	}],
	[/^goto\s+(.+)$/i, function (context) {
		context.callstack.push(context.ln);
		context.ln = context.evaluate(this.matches[1]);
	}],
	[/^print\s+(.*?)(,)?$/i, function (context) {
		// TODO: Don't split literal strings
		var params = this.matches[1].split(",");
		for (var i in params) {
			var param = params[i].trim();			
			context.output.innerHTML += context.evaluate(param);
		}
		if (!this.matches[2]) {
			context.output.innerHTML += "\n";
		}
	}],
	[/^input\s+(.+?),\s*(.+?)$/i, function (context) {
		var variable = this.matches[2];
		var input = prompt(context.evaluate(this.matches[1]));
		context.setVar(variable, input); 
	}
	}],
	[/^(let\s+)?(.+?)\s*=\s*(.+?)$/i, function (context) {
		context.setVar(this.matches[2], context.evaluate(this.matches[3]));
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
	if (variable.indexOf("#")) {
		if (!isNumber(value)) {
			throw "Type mismatch on line " + this.ln;
		}
	} else {
		if (isNumber(value)) {
			throw "Type mismatch on line " + this.ln;
		}
	}
	
	this.variables[variable] = value;
}

Program.prototype.parse = function (text) {
	var rawLines = text.split("\n");
	for (var ln in rawLines) {
		var rawLine = rawLines[ln].trim();
		if (rawLine) {
			var parsedLine = rawLine.match(/^\s*(\d+)\s*(.*)$/);
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
	if (matches = expression.match(/^[A-Z_][A-Z_0-9]*[$#]$/i)) {
		return this.variables[expression];
	} else if (matches = expression.match(/^"(.*?)"$/i)) {
		return matches[1];
	} else if (matches = expression.match(/^(.+?)\s*\/\s*(.+?)$/i)) {
		return this.evaluate(matches[1]) / this.evaluate(matches[2]);
	} else if (matches = expression.match(/^(.+?)\s*\*\s*(.+?)$/i)) {
		return this.evaluate(matches[1]) * this.evaluate(matches[2]);
	} else if (matches = expression.match(/^(.+?)\s*\-\s*(.+?)$/i)) {
		return this.evaluate(matches[1]) - this.evaluate(matches[2]);
	} else if (matches = expression.match(/^(.+?)\s*\+\s*(.+?)$/i)) {
		return this.evaluate(matches[1]) + this.evaluate(matches[2]);
	} else if (matches = expression.match(/^(.+?)\s*\=\s*(.+?)$/i)) {
		return this.evaluate(matches[1]) == this.evaluate(matches[2]);
	} else if (matches = expression.match(/^(.+?)\s*\>\s*(.+?)$/i)) {
		return this.evaluate(matches[1]) > this.evaluate(matches[2]);
	} else if (matches = expression.match(/^(.+?)\s*\<\s*(.+?)$/i)) {
		return this.evaluate(matches[1]) < this.evaluate(matches[2]);
	} else if (matches = expression.match(/^(.+?)\s*\>=\s*(.+?)$/i)) {
		return this.evaluate(matches[1]) >= this.evaluate(matches[2]);
	} else if (matches = expression.match(/^(.+?)\s*\<=\s*(.+?)$/i)) {
		return this.evaluate(matches[1]) <= this.evaluate(matches[2]);
	} else if (matches = expression.match(/^(.+?)\s*\<>\s*(.+?)$/i)) {
		return this.evaluate(matches[1]) != this.evaluate(matches[2]);
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
